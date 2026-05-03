import asyncio
from pathlib import Path

from celery_app import celery_app
from database import SessionLocal, Job, Episode
from routes.upload import (
    extract_audio,
    transcribe_audio,
    _cleanup_files,
    _download_with_ytdlp,
    UPLOAD_DIR
)

@celery_app.task(bind=True)
def process_file_job(self, job_id: str, saved_path_str: str, original_filename: str, content_type: str, title: str | None):
    db = SessionLocal()
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        db.close()
        return

    saved_path = Path(saved_path_str)
    audio_path = None

    try:
        job.status = "transcribing"
        job.progress = 50
        db.commit()

        if content_type.startswith("video/"):
            print(f"[ffmpeg] Extracting audio for Job {job_id}...")
            audio_path = extract_audio(saved_path)
        else:
            audio_path = saved_path

        job.progress = 70
        db.commit()

        print(f"[deepgram] Transcribing Job {job_id}...")
        transcription = asyncio.run(transcribe_audio(audio_path))

        job.progress = 90
        db.commit()

        episode = Episode(
            id=job_id,
            title=title or original_filename or "Untitled Podcast",
            filename=original_filename,
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
        paths_to_delete = []
        if content_type.startswith("video/"):
            paths_to_delete.append(saved_path)
            if audio_path: paths_to_delete.append(audio_path)
        else:
            paths_to_delete.append(saved_path)
            
        _cleanup_files(*paths_to_delete)
        db.close()


@celery_app.task(bind=True)
def process_url_job(self, job_id: str, url: str, title: str | None):
    """
    Background worker function executed by Celery.
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
