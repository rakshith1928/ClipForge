# backend/routes/upload.py
# Handles receiving the uploaded file, saving it, extracting audio, and transcribing it
# Each function has one clear job — easier to debug

import os
import uuid
import subprocess
from pathlib import Path
from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
import aiofiles
from deepgram import DeepgramClient, PrerecordedOptions
from dotenv import load_dotenv

load_dotenv()

router = APIRouter(prefix="/upload", tags=["upload"])

UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", "uploads"))
UPLOAD_DIR.mkdir(exist_ok=True)

DEEPGRAM_API_KEY = os.getenv("DEEPGRAM_API_KEY")


# ── Helper: save the uploaded file to disk ──────────────────────────────────

async def save_upload(file: UploadFile) -> Path:
    """Save the incoming file to disk with a unique ID so filenames never clash."""
    ext = Path(file.filename).suffix  # e.g. ".mp4" or ".mp3"
    unique_name = f"{uuid.uuid4()}{ext}"
    file_path = UPLOAD_DIR / unique_name

    async with aiofiles.open(file_path, "wb") as out:
        while chunk := await file.read(1024 * 1024):  # read 1MB at a time
            await out.write(chunk)

    return file_path


# ── Helper: extract audio from video using FFmpeg ───────────────────────────

def extract_audio(video_path: Path) -> Path:
    """
    Use FFmpeg to strip just the audio track from the video.
    We work with audio only for AI analysis — it's ~10x smaller than the video.
    Returns path to the extracted .mp3 file.
    """
    audio_path = video_path.with_suffix(".mp3")

    result = subprocess.run(
        [
            "ffmpeg",
            "-i", str(video_path),   # input file
            "-vn",                    # no video
            "-acodec", "libmp3lame", # encode as mp3
            "-ar", "16000",          # 16kHz sample rate (enough for speech)
            "-ac", "1",              # mono (halves file size)
            "-q:a", "4",             # quality level
            str(audio_path),
            "-y",                    # overwrite if exists
        ],
        capture_output=True,
        text=True,
    )

    if result.returncode != 0:
        raise RuntimeError(f"FFmpeg failed: {result.stderr}")

    return audio_path


# ── Helper: send audio to Deepgram for transcription ────────────────────────

async def transcribe_audio(audio_path: Path) -> dict:
    """
    Send the audio file to Deepgram.
    We get back:
    - Full transcript text
    - Every word with its start/end timestamp (crucial for clipping!)
    - Speaker labels (who said what)
    """
    if not DEEPGRAM_API_KEY:
        raise RuntimeError("DEEPGRAM_API_KEY not set in .env")

    client = DeepgramClient(DEEPGRAM_API_KEY)

    with open(audio_path, "rb") as audio_file:
        buffer_data = audio_file.read()

    options = PrerecordedOptions(
        model="nova-2",          # Deepgram's best model
        smart_format=True,       # adds punctuation
        utterances=True,         # groups words into sentences
        diarize=True,            # speaker detection (Speaker 0, Speaker 1...)
        paragraphs=True,         # groups into paragraphs
    )

    response = client.listen.prerecorded.v("1").transcribe_file(
        {"buffer": buffer_data, "mimetype": "audio/mp3"},
        options,
        timeout=300
    )

    # v3 returns objects, not dicts — use dot notation
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

    return {
        "transcript": alternative.transcript,
        "words": words,
        "paragraphs": paragraphs,
    }

# ── Main route: POST /upload ─────────────────────────────────────────────────

@router.post("/")
async def upload_episode(file: UploadFile = File(...)):
    """
    Full pipeline:
    1. Save uploaded file
    2. Extract audio (if video)
    3. Transcribe with Deepgram
    4. Return transcript + word timestamps
    """
    allowed_types = ["video/mp4", "video/quicktime", "audio/mpeg", "audio/wav", "audio/mp3"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {file.content_type}")

    try:
        # Step 1: Save file
        print(f"Saving file: {file.filename}")
        saved_path = await save_upload(file)

        # Step 2: Extract audio if it's a video file
        if file.content_type.startswith("video/"):
            print("Extracting audio from video...")
            audio_path = extract_audio(saved_path)
        else:
            audio_path = saved_path  # already audio

        # Step 3: Transcribe
        print("Sending to Deepgram for transcription...")
        transcription = await transcribe_audio(audio_path)

        print("Done! Returning transcript.")
        return JSONResponse({
            "success": True,
            "file_id": saved_path.stem,   # unique ID for this episode
            "transcript": transcription["transcript"],
            "words": transcription["words"],
            "paragraphs": transcription["paragraphs"],
            "word_count": len(transcription["words"]),
        })

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))