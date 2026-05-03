# backend/routes/upload.py
# Handles receiving the uploaded file, saving it, extracting audio, and transcribing it

import os
import uuid
import subprocess
from pathlib import Path
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends, BackgroundTasks
from fastapi.responses import JSONResponse
import aiofiles
from deepgram import DeepgramClient, PrerecordedOptions
from dotenv import load_dotenv
from sqlalchemy.orm import Session

from database import get_db, Episode, Job, SessionLocal

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

def process_url_job(job_id: str, url: str, title: str | None):
    """
    Background worker function executed by FastAPI's thread pool.
    Updates the Job row in PostgreSQL at each step so the frontend can poll.
    """
    db = SessionLocal()
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        db.close()
        return

    actual_path = None
    audio_path = None

    try:
        # 1. Download
        job.status = "uploading"
        job.progress = 10
        db.commit()

        video_path = UPLOAD_DIR / f"{job_id}.mp4"
        print(f"[yt-dlp] Downloading Job {job_id}: {url}")
        
        # Since this entire function runs in a background thread, yt-dlp won't block the web server
        _download_with_ytdlp(url, str(video_path))

        actual_path = video_path
        if not actual_path.exists():
            candidates = list(UPLOAD_DIR.glob(f"{job_id}.*"))
            if not candidates:
                raise RuntimeError("yt-dlp did not produce an output file.")
            actual_path = candidates[0]

        # 2. Extract Audio
        job.status = "transcribing"
        job.progress = 50
        db.commit()

        print(f"[ffmpeg] Extracting audio for Job {job_id}...")
        audio_path = extract_audio(actual_path)

        # 3. Transcribe
        job.progress = 70
        db.commit()

        print(f"[deepgram] Transcribing Job {job_id}...")
        # Background task is sync, but transcribe_audio is async. Run it via asyncio:
        transcription = asyncio.run(transcribe_audio(audio_path))

        # 4. Save to Database
        job.progress = 90
        db.commit()

        episode = Episode(
            id=job_id,
            title=title or f"Video from {url[:60]}",
            filename=str(actual_path.name),
            transcript=transcription["transcript"],
            words=transcription["words"],
            word_count=len(transcription["words"]),
            duration=transcription.get("duration", 0),
        )
        db.add(episode)
        job.status = "done"
        job.progress = 100
        job.file_id = job_id
        db.commit()
        print(f"[db] Job & Episode saved: {job_id}")

    except Exception as e:
        db.rollback()
        job.status = "error"
        job.error = str(e)
        db.commit()
        print(f"[error] Job {job_id} failed: {e}")

    finally:
        # Guaranteed Cleanup — no more disk leaks!
        paths_to_delete = []
        if actual_path: paths_to_delete.append(actual_path)
        if audio_path: paths_to_delete.append(audio_path)
        _cleanup_files(*paths_to_delete)
        
        # Catch any stray temp files
        for f in UPLOAD_DIR.glob(f"{job_id}*"):
            try:
                f.unlink()
            except:
                pass
                
        db.close()

class UrlUploadRequest(BaseModel):
    url: str
    title: str | None = None

@router.post("/url")
async def start_upload_from_url(
    body: UrlUploadRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """
    Receives URL, immediately creates a Job ticket in DB, passes work to BackgroundTasks,
    and returns the ticket ID to the user in milliseconds.
    """
    job_id = str(uuid.uuid4())
    
    new_job = Job(
        id=job_id,
        url=body.url,
        title=body.title,
        status="queued",
        progress=0
    )
    db.add(new_job)
    db.commit()

    background_tasks.add_task(process_url_job, job_id, body.url, body.title)

    return JSONResponse({
        "job_id": job_id,
        "status": "queued"
    })


@router.get("/status/{job_id}")
async def get_job_status(job_id: str, db: Session = Depends(get_db)):
    """
    Frontend polls this endpoint every 2 seconds to get real-time progress.
    """
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    response = {
        "job_id": job.id,
        "status": job.status,
        "progress": job.progress,
    }

    if job.status == "done":
        # Fetch the Episode data so the frontend can display the success screen
        ep = db.query(Episode).filter(Episode.id == job.file_id).first()
        if ep:
            response["transcript"] = ep.transcript
            response["file_id"] = ep.id
    elif job.status == "error":
        response["error"] = job.error

    return JSONResponse(response)