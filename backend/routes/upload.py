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
    Receives file, saves it to disk, creates a Job ticket, and passes audio extraction
    and transcription to Celery workers. Returns job ticket instantly.
    """
    allowed_types = ["video/mp4", "video/quicktime", "audio/mpeg", "audio/wav", "audio/mp3"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {file.content_type}")

    print(f"Saving file: {file.filename}")
    saved_path = await save_upload(file)
    job_id = saved_path.stem

    new_job = Job(
        id=job_id,
        url=None,
        title=title or file.filename,
        status="uploading",
        progress=100
    )
    db.add(new_job)
    db.commit()

    # Import worker locally to avoid circular import
    from worker import process_file_job
    process_file_job.delay(
        job_id, 
        str(saved_path), 
        file.filename, 
        file.content_type, 
        title
    )

    return JSONResponse({
        "job_id": job_id,
        "status": "queued"
    })


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
async def start_upload_from_url(
    body: UrlUploadRequest,
    db: Session = Depends(get_db),
):
    """
    Receives URL, fetches metadata to enforce limits, immediately creates a Job ticket in DB, 
    passes work to Celery, and returns the ticket ID.
    """
    # 1. Fetch metadata to check duration limit (runs in threadpool to prevent blocking)
    try:
        loop = asyncio.get_event_loop()
        def fetch_info():
            with yt_dlp.YoutubeDL({"quiet": True, "noplaylist": True, "extract_flat": True}) as ydl:
                return ydl.extract_info(body.url, download=False)
        
        info = await loop.run_in_executor(None, fetch_info)
        
        # Some flat extractions don't give exact duration, but we try:
        duration = info.get("duration") or 0
        
        # Max limit: 3600 seconds (1 hour)
        if duration > 3600:
            raise HTTPException(status_code=400, detail="Video exceeds the 1 hour maximum duration limit.")
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid URL or failed to fetch video info.")
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

    # Import worker locally to avoid circular import
    from worker import process_url_job
    process_url_job.delay(job_id, body.url, body.title)

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