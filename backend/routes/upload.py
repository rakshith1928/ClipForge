# backend/routes/upload.py
# Handles receiving the uploaded file, saving it, extracting audio, and transcribing it

import os
import uuid
import subprocess
from pathlib import Path
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
from fastapi.responses import JSONResponse
import aiofiles
from deepgram import DeepgramClient, PrerecordedOptions
from dotenv import load_dotenv
from sqlalchemy.orm import Session

from database import get_db, Episode

load_dotenv()

router = APIRouter(prefix="/upload", tags=["upload"])

UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", "uploads"))
UPLOAD_DIR.mkdir(exist_ok=True)

DEEPGRAM_API_KEY = os.getenv("DEEPGRAM_API_KEY")


# ── Helper: save the uploaded file to disk ──────────────────────────────────

async def save_upload(file: UploadFile) -> Path:
    """Save the incoming file to disk with a unique ID so filenames never clash."""
    ext = Path(file.filename).suffix
    unique_name = f"{uuid.uuid4()}{ext}"
    file_path = UPLOAD_DIR / unique_name

    async with aiofiles.open(file_path, "wb") as out:
        while chunk := await file.read(1024 * 1024):
            await out.write(chunk)

    return file_path


# ── Helper: extract audio from video using FFmpeg ───────────────────────────

def extract_audio(video_path: Path) -> Path:
    """Strip audio from video using FFmpeg. Returns path to extracted .mp3."""
    audio_path = video_path.with_suffix(".mp3")

    result = subprocess.run(
        [
            "ffmpeg",
            "-i", str(video_path),
            "-vn",
            "-acodec", "libmp3lame",
            "-ar", "16000",
            "-ac", "1",
            "-q:a", "4",
            str(audio_path),
            "-y",
        ],
        capture_output=True,
        text=True,
    )

    if result.returncode != 0:
        raise RuntimeError(f"FFmpeg failed: {result.stderr}")

    return audio_path


# ── Helper: clean up temp files after transcription ─────────────────────────

def _cleanup_files(*paths: Path) -> None:
    """Delete files from disk — called after transcription so we don't accumulate GBs."""
    for p in paths:
        try:
            if p and p.exists():
                p.unlink()
                print(f"[cleanup] Deleted: {p}")
        except Exception as e:
            print(f"[cleanup] Warning: could not delete {p}: {e}")


# ── Helper: send audio to Deepgram for transcription ────────────────────────

async def transcribe_audio(audio_path: Path) -> dict:
    """Send audio to Deepgram and return transcript, words, paragraphs, duration."""
    if not DEEPGRAM_API_KEY:
        raise RuntimeError("DEEPGRAM_API_KEY not set in .env")

    client = DeepgramClient(DEEPGRAM_API_KEY)

    with open(audio_path, "rb") as audio_file:
        buffer_data = audio_file.read()

    options = PrerecordedOptions(
        model="nova-2",
        smart_format=True,
        utterances=True,
        diarize=True,
        paragraphs=True,
    )

    response = client.listen.prerecorded.v("1").transcribe_file(
        {"buffer": buffer_data, "mimetype": "audio/mp3"},
        options,
        timeout=300
    )

    alternative = response.results.channels[0].alternatives[0]

    words = [
        {
            "word": w.word,
            "start": w.start,
            "end": w.end,
            "speaker": getattr(w, "speaker", 0),
        }
        for w in alternative.words
    ]

    paragraphs = []
    if hasattr(alternative, "paragraphs") and alternative.paragraphs:
        paragraphs = [
            {
                "sentences": [
                    {"text": s.text, "start": s.start, "end": s.end}
                    for s in p.sentences
                ]
            }
            for p in alternative.paragraphs.paragraphs
        ]

    duration = words[-1]["end"] if words else 0

    return {
        "transcript": alternative.transcript,
        "words": words,
        "paragraphs": paragraphs,
        "duration": duration,
    }


# ── Main route: POST /upload ─────────────────────────────────────────────────

@router.post("/")
async def upload_episode(
    file: UploadFile = File(...),
    title: str = Form(None),
    db: Session = Depends(get_db)
):
    """
    Full pipeline:
    1. Save uploaded file
    2. Extract audio (if video)
    3. Transcribe with Deepgram
    4. Save Episode to PostgreSQL
    5. Return transcript + word timestamps + file_id
    """
    allowed_types = ["video/mp4", "video/quicktime", "audio/mpeg", "audio/wav", "audio/mp3"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {file.content_type}")

    try:
        print(f"Saving file: {file.filename}")
        saved_path = await save_upload(file)
        file_id = saved_path.stem

        if file.content_type.startswith("video/"):
            print("Extracting audio from video...")
            audio_path = extract_audio(saved_path)
        else:
            audio_path = saved_path

        print("Sending to Deepgram for transcription...")
        transcription = await transcribe_audio(audio_path)

        # Save Episode to DB so analyze.py can find it by file_id
        episode = Episode(
            id=file_id,
            title=title or file.filename or "Untitled Podcast",
            filename=file.filename,
            transcript=transcription["transcript"],
            words=transcription["words"],
            word_count=len(transcription["words"]),
            duration=transcription.get("duration", 0),
        )
        db.add(episode)
        db.commit()
        print(f"Episode saved to DB: {file_id}")

        # Clean up raw files — transcript is now safely in the DB
        if file.content_type.startswith("video/"):
            _cleanup_files(saved_path, audio_path)  # delete both video + mp3
        else:
            _cleanup_files(saved_path)               # audio-only upload: delete mp3

        return JSONResponse({
            "success": True,
            "title": title or file.filename,
            "file_id": file_id,
            "transcript": transcription["transcript"],
            "words": transcription["words"],
            "paragraphs": transcription["paragraphs"],
            "word_count": len(transcription["words"]),
            "duration": transcription.get("duration", 0),
        })

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


# ── URL-based ingestion: POST /upload/url ────────────────────────────────────

import asyncio
import yt_dlp
from pydantic import BaseModel


def _download_with_ytdlp(url: str, out_path: str) -> None:
    """
    Blocking download — runs in a thread pool so it doesn't stall the event loop.
    Downloads the best available mp4 (or falls back to best audio) to out_path.
    """
    ydl_opts = {
        "format": "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
        "outtmpl": out_path,
        "quiet": True,
        "no_warnings": True,
        "noplaylist": True,
    }
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        ydl.download([url])


class UrlUploadRequest(BaseModel):
    url: str
    title: str | None = None


@router.post("/url")
async def upload_from_url(
    body: UrlUploadRequest,
    db: Session = Depends(get_db),
):
    """
    Full pipeline from a URL (YouTube, Vimeo, Twitch):
    1. yt-dlp downloads the video to /uploads/<uuid>.mp4
    2. FFmpeg extracts audio  (reuses extract_audio())
    3. Deepgram transcribes  (reuses transcribe_audio())
    4. Save Episode to DB    (same as file upload)
    5. Return identical JSON response shape
    """
    file_id = str(uuid.uuid4())
    video_path = UPLOAD_DIR / f"{file_id}.mp4"

    try:
        # 1. Download video in thread pool (yt-dlp is synchronous)
        print(f"[yt-dlp] Downloading: {body.url}")
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(
            None,
            _download_with_ytdlp,
            body.url,
            str(video_path),
        )

        # yt-dlp may append the actual extension — find the downloaded file
        actual_path = video_path
        if not actual_path.exists():
            # search for the uuid file regardless of extension
            candidates = list(UPLOAD_DIR.glob(f"{file_id}.*"))
            if not candidates:
                raise RuntimeError("yt-dlp did not produce an output file.")
            actual_path = candidates[0]

        print(f"[yt-dlp] Downloaded to: {actual_path}")

        # 2. Extract audio with FFmpeg
        print("[ffmpeg] Extracting audio...")
        audio_path = extract_audio(actual_path)

        # 3. Transcribe with Deepgram
        print("[deepgram] Transcribing...")
        transcription = await transcribe_audio(audio_path)

        # 4. Save Episode to DB
        episode = Episode(
            id=file_id,
            title=body.title or f"Video from {body.url[:60]}",
            filename=str(actual_path.name),
            transcript=transcription["transcript"],
            words=transcription["words"],
            word_count=len(transcription["words"]),
            duration=transcription.get("duration", 0),
        )
        db.add(episode)
        db.commit()
        print(f"[db] Episode saved: {file_id}")

        # Clean up raw files — transcript is safely in DB, no need to keep GBs of video
        _cleanup_files(actual_path, audio_path)

        # 5. Return same shape as file upload
        return JSONResponse({
            "success": True,
            "title": body.title or f"Video from {body.url[:60]}",
            "file_id": file_id,
            "transcript": transcription["transcript"],
            "words": transcription["words"],
            "paragraphs": transcription.get("paragraphs", []),
            "word_count": len(transcription["words"]),
            "duration": transcription.get("duration", 0),
        })

    except Exception as e:
        db.rollback()
        # Clean up any partial downloads
        for f in UPLOAD_DIR.glob(f"{file_id}*"):
            try:
                f.unlink()
            except Exception:
                pass
        raise HTTPException(status_code=500, detail=str(e))