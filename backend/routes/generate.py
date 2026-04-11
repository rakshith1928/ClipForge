# backend/routes/generate.py
# This route does the actual heavy lifting:
# 1. Cuts video clips using FFmpeg
# 2. Generates quote card images using Pillow
# All output files go to the uploads/ folder and are served back as download links

import os
import uuid
import subprocess
from pathlib import Path
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from PIL import Image, ImageDraw, ImageFont
import textwrap
from sqlalchemy.orm import Session

from database import get_db, GeneratedContent

router = APIRouter(prefix="/generate", tags=["generate"])

UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", "uploads"))
UPLOAD_DIR.mkdir(exist_ok=True)


# ── Request shapes ───────────────────────────────────────────────────────────

class ClipRequest(BaseModel):
    file_id: str        # the unique ID from Phase 2 upload
    episode_id: str     # links to the Episode table
    start_time: float   # start in seconds
    end_time: float     # end in seconds
    title: str = ""     # optional title for filename


class QuoteCardRequest(BaseModel):
    episode_id: str     # links to the Episode table
    quote_text: str
    speaker: str = ""
    theme: str = ""
    # Brand kit defaults — Phase 6 will let users customize these
    bg_color: str = "#0f0f0f"
    text_color: str = "#ffffff"
    accent_color: str = "#7c3aed"


# ── Helper: find the original uploaded video file ────────────────────────────

def find_video_file(file_id: str) -> Path:
    """
    Look for the original video file by its UUID.
    Tries common video extensions.
    """
    for ext in [".mp4", ".mov", ".webm", ".avi", ".mkv"]:
        path = UPLOAD_DIR / f"{file_id}{ext}"
        if path.exists():
            return path

    # If no video found, check for audio
    for ext in [".mp3", ".wav", ".m4a"]:
        path = UPLOAD_DIR / f"{file_id}{ext}"
        if path.exists():
            return path

    raise FileNotFoundError(f"No file found for ID: {file_id}")


# ── Helper: cut a clip using FFmpeg ─────────────────────────────────────────

def cut_clip(video_path: Path, start: float, end: float, output_path: Path):
    """
    Use FFmpeg to cut a specific segment from the video.
    -ss: start time
    -t: duration (not end time)
    -c:v copy: copy video stream without re-encoding (fast)
    -c:a aac: encode audio as AAC
    """
    duration = end - start

    result = subprocess.run(
        [
            "ffmpeg",
            "-ss", str(start),          # seek to start
            "-i", str(video_path),       # input file
            "-t", str(duration),         # duration to cut
            "-c:v", "libx264",           # re-encode video (more compatible)
            "-c:a", "aac",               # encode audio
            "-preset", "fast",           # fast encoding
            "-crf", "23",                # quality (lower = better, 18-28 is good)
            str(output_path),
            "-y",                        # overwrite if exists
        ],
        capture_output=True,
        text=True,
    )

    if result.returncode != 0:
        raise RuntimeError(f"FFmpeg clip failed: {result.stderr}")


# ── Helper: generate a quote card image using Pillow ────────────────────────

def generate_quote_card(
    quote_text: str,
    speaker: str,
    theme: str,
    bg_color: str,
    text_color: str,
    accent_color: str,
    output_path: Path,
):
    """
    Generate a 1080x1080 quote card image.
    This is the standard size for Instagram posts.
    """
    W, H = 1080, 1080

    # Create base image
    img = Image.new("RGB", (W, H), color=bg_color)
    draw = ImageDraw.Draw(img)

    # ── Background design elements ───────────────────────────────────────────

    # Top accent bar
    draw.rectangle([(0, 0), (W, 8)], fill=accent_color)

    # Bottom accent bar
    draw.rectangle([(0, H - 8), (W, H)], fill=accent_color)

    # Subtle quote mark background
    draw.text((60, 80), "\u201c", fill=accent_color + "40", font=None)

    # ── Try to load a nice font, fall back to default ────────────────────────
    # On Windows, Arial is available. We'll use different sizes.

    try:
        font_large = ImageFont.truetype("arial.ttf", 58)
        font_medium = ImageFont.truetype("arial.ttf", 32)
        font_small = ImageFont.truetype("arial.ttf", 26)
    except:
        # Fallback to PIL default font
        font_large = ImageFont.load_default()
        font_medium = ImageFont.load_default()
        font_small = ImageFont.load_default()

    # ── Draw quote mark ──────────────────────────────────────────────────────
    draw.text((80, 100), "\u201c", fill=accent_color, font=font_large)

    # ── Wrap and draw the quote text ─────────────────────────────────────────
    # textwrap breaks long quotes into multiple lines
    margin = 100
    max_width = 42  # characters per line
    wrapped = textwrap.fill(quote_text, width=max_width)
    lines = wrapped.split("\n")

    # Calculate vertical center
    line_height = 70
    total_text_height = len(lines) * line_height
    y_start = (H - total_text_height) // 2 - 40

    for i, line in enumerate(lines):
        y = y_start + (i * line_height)
        draw.text((margin, y), line, fill=text_color, font=font_large)

    # ── Closing quote mark ───────────────────────────────────────────────────
    last_line_y = y_start + (len(lines) * line_height)
    draw.text((W - 120, last_line_y), "\u201d", fill=accent_color, font=font_large)

    # ── Speaker name ─────────────────────────────────────────────────────────
    if speaker:
        speaker_text = f"— {speaker}"
        draw.text((margin, H - 180), speaker_text, fill=accent_color, font=font_medium)

    # ── Theme tag ────────────────────────────────────────────────────────────
    if theme:
        theme_text = f"#{theme.upper()}"
        draw.text((margin, H - 130), theme_text, fill=text_color + "80", font=font_small)

    # ── PodClip watermark ────────────────────────────────────────────────────
    draw.text((W - 180, H - 60), "made with PodClip", fill=text_color + "40", font=font_small)

    # Save the image
    img.save(str(output_path), "PNG", quality=95)


# ── Route: POST /generate/clip ───────────────────────────────────────────────

@router.post("/clip")
async def create_clip(body: ClipRequest, db: Session = Depends(get_db)):
    """Cut a video clip, save it to DB, and return a download URL."""
    try:
        video_path = find_video_file(body.file_id)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))

    clip_id = str(uuid.uuid4())[:8]
    safe_title = body.title.replace(" ", "_")[:30] if body.title else "clip"
    output_filename = f"clip_{safe_title}_{clip_id}.mp4"
    output_path = UPLOAD_DIR / output_filename

    try:
        cut_clip(video_path, body.start_time, body.end_time, output_path)
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))

    # Save to DB so we can track every generated clip
    content = GeneratedContent(
        id=str(uuid.uuid4()),
        episode_id=body.episode_id,
        content_type="clip_file",
        title=body.title or f"Clip {clip_id}",
        body="",
        file_path=str(output_path),
        metadata={
            "start_time": body.start_time,
            "end_time": body.end_time,
            "duration": round(body.end_time - body.start_time, 1),
            "download_url": f"/files/{output_filename}",
        },
    )
    db.add(content)
    db.commit()

    return {
        "success": True,
        "clip_id": clip_id,
        "filename": output_filename,
        "download_url": f"/files/{output_filename}",
        "duration": round(body.end_time - body.start_time, 1),
    }


# ── Route: POST /generate/quote-card ────────────────────────────────────────

@router.post("/quote-card")
async def create_quote_card(body: QuoteCardRequest, db: Session = Depends(get_db)):
    """Generate a quote card image, save it to DB, and return a download URL."""
    card_id = str(uuid.uuid4())[:8]
    output_filename = f"quote_card_{card_id}.png"
    output_path = UPLOAD_DIR / output_filename

    try:
        generate_quote_card(
            quote_text=body.quote_text,
            speaker=body.speaker,
            theme=body.theme,
            bg_color=body.bg_color,
            text_color=body.text_color,
            accent_color=body.accent_color,
            output_path=output_path,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    # Save to DB so we can track every generated quote card
    content = GeneratedContent(
        id=str(uuid.uuid4()),
        episode_id=body.episode_id,
        content_type="quote_card",
        title=f"Quote Card — {body.speaker}" if body.speaker else "Quote Card",
        body=body.quote_text,
        file_path=str(output_path),
        metadata={
            "speaker": body.speaker,
            "theme": body.theme,
            "download_url": f"/files/{output_filename}",
        },
    )
    db.add(content)
    db.commit()

    return {
        "success": True,
        "card_id": card_id,
        "filename": output_filename,
        "download_url": f"/files/{output_filename}",
    }