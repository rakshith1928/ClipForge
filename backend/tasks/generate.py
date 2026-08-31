import os
import re
import subprocess
import uuid
from pathlib import Path

from celery_app import celery_app
from database import GeneratedContent, SessionLocal

UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", "uploads"))
UPLOAD_DIR.mkdir(exist_ok=True)


def sanitize_filename(name: str, default: str, max_len: int = 50) -> str:
    if not name:
        return default
    cleaned = re.sub(r"[^A-Za-z0-9_\-]", "_", name)
    return cleaned[:max_len] or default


def _ensure_within_upload_dir(path: Path) -> Path:
    base = UPLOAD_DIR.resolve()
    resolved = path.resolve()
    if resolved != base and base not in resolved.parents:
        raise ValueError("Invalid path: file must reside inside the upload directory")
    return resolved


def find_video_file(file_id: str) -> Path:
    if "/" in file_id or "\\" in file_id or ".." in file_id:
        raise ValueError("Invalid file_id")
    base = UPLOAD_DIR.resolve()
    for ext in [".mp4", ".mov", ".webm", ".avi", ".mkv"]:
        candidate = (base / f"{file_id}{ext}").resolve()
        if candidate.parent == base and candidate.exists():
            return candidate
    for ext in [".mp3", ".wav", ".m4a"]:
        candidate = (base / f"{file_id}{ext}").resolve()
        if candidate.parent == base and candidate.exists():
            return candidate
    raise FileNotFoundError(f"No file found for ID: {file_id}")


def cut_clip(video_path: Path, start: float, end: float, output_path: Path):
    duration = end - start
    result = subprocess.run(
        [
            "ffmpeg",
            "-ss", str(start),
            "-i", str(video_path),
            "-t", str(duration),
            "-c:v", "libx264",
            "-c:a", "aac",
            "-preset", "fast",
            "-crf", "23",
            str(output_path),
            "-y",
        ],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        raise RuntimeError(f"FFmpeg clip failed: {result.stderr}")


@celery_app.task(bind=True, acks_late=True, time_limit=300, soft_time_limit=240)
def generate_clip_task(self, file_id: str, episode_id: str, start_time: float, end_time: float, title: str, user_id: str):
    db = SessionLocal()
    try:
        try:
            video_path = find_video_file(file_id)
        except FileNotFoundError:
            return

        clip_id = str(uuid.uuid4())[:8]
        safe_title = sanitize_filename(title, "clip", max_len=30)
        output_filename = f"clip_{safe_title}_{clip_id}.mp4"
        output_path = _ensure_within_upload_dir(UPLOAD_DIR / output_filename)

        cut_clip(video_path, start_time, end_time, output_path)

        content = GeneratedContent(
            id=str(uuid.uuid4()),
            episode_id=episode_id,
            content_type="clip_file",
            user_id=user_id,
            title=title or f"Clip {clip_id}",
            body="",
            file_path=str(output_path),
            content_metadata={
                "start_time": start_time,
                "end_time": end_time,
                "duration": round(end_time - start_time, 1),
                "download_url": f"/files/{output_filename}",
            },
        )
        db.add(content)
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
