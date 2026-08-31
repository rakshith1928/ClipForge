from datetime import datetime

from fastapi import HTTPException
from sqlalchemy.orm import Session

from database import Job, GeneratedContent

DAILY_ANALYZE_LIMIT = 20
DAILY_CLIP_LIMIT = 50


def _today_start() -> datetime:
    return datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)


def check_analyze_quota(db: Session, user_id: str) -> None:
    """Raise 429 if user has already created 20 Jobs today (analyze quota)."""
    start = _today_start()
    count = db.query(Job).filter(Job.user_id == user_id, Job.created_at >= start).count()
    if count >= DAILY_ANALYZE_LIMIT:
        raise HTTPException(status_code=429, detail="Daily analyze quota exceeded (20/day)")


def check_clip_quota(db: Session, user_id: str) -> None:
    """Raise 429 if user has created 50 clips/jobs today (clip quota)."""
    start = _today_start()
    # Count Jobs (which includes clip dispatch jobs) — quota 50 is higher than analyze 20
    # so 20 jobs won't trigger this, but 50 will.
    count = db.query(Job).filter(Job.user_id == user_id, Job.created_at >= start).count()
    if count >= DAILY_CLIP_LIMIT:
        raise HTTPException(status_code=429, detail="Daily clip quota exceeded (50/day)")
    # Also check GeneratedContent clip count as secondary guard
    clip_count = (
        db.query(GeneratedContent)
        .filter(
            GeneratedContent.user_id == user_id,
            GeneratedContent.content_type == "clip",
            GeneratedContent.created_at >= start,
        )
        .count()
    )
    if clip_count >= DAILY_CLIP_LIMIT:
        raise HTTPException(status_code=429, detail="Daily clip quota exceeded (50/day)")
