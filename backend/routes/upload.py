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