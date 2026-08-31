from datetime import datetime, timedelta

from celery_app import celery_app
from database import Job, SessionLocal


@celery_app.task
def sweep_stale_jobs():
    """Fail jobs stuck >30 min in queued/uploading/transcribing (B4, B5)."""
    db = SessionLocal()
    try:
        cutoff = datetime.utcnow() - timedelta(minutes=30)
        stale = (
            db.query(Job)
            .filter(
                Job.status.in_(["queued", "uploading", "transcribing"]),
                Job.created_at < cutoff,
            )
            .all()
        )
        for job in stale:
            job.status = "error"
            job.error = "Job timed out (stale) - timeout"
        if stale:
            db.commit()
    finally:
        db.close()
