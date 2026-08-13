# backend/routes/calendar.py
# Handles saving episodes, generating the content calendar,
# and returning scheduled posts to the frontend.

import os
import uuid
from typing import List
from datetime import datetime, timedelta , date
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel , validator
from sqlalchemy.orm import Session
from database import get_db, Episode, GeneratedContent, ScheduledPost, init_db
from dotenv import load_dotenv

load_dotenv()

router = APIRouter(prefix="/calendar", tags=["calendar"])

class ScheduleRequest(BaseModel):
    episode_id: str
    start_date: date
    platforms: List[str] = ["twitter", "linkedin", "instagram"]

    @validator("episode_id")
    def episode_id_not_empty(cls, v):
        if not v or not v.strip():
            raise ValueError("episode_id cannot be empty")
        return v

@router.post("/schedule")
def schedule_content(body: ScheduleRequest, db: Session = Depends(get_db)):
    episode = db.query(Episode).filter(Episode.id == body.episode_id).first()
    if not episode:
        raise HTTPException(status_code=404, detail="Episode not found in database. Save it first.")

    content_items = db.query(GeneratedContent).filter(
        GeneratedContent.episode_id == body.episode_id
    ).all()

    if not content_items:
        raise HTTPException(status_code=404, detail="No content found. Save content first.")

    clips = [c for c in content_items if c.content_type == "clip"]
    quotes = [c for c in content_items if c.content_type == "quote"]
    threads = [c for c in content_items if c.content_type == "twitter_thread"]
    linkedin = [c for c in content_items if c.content_type == "linkedin"]
    instagram = [c for c in content_items if c.content_type == "instagram"]

    # Sort by viral score — best content first
    clips.sort(key=lambda x: x.content_metadata.get("viral_score", 0) if x.content_metadata else 0, reverse=True)
    quotes.sort(key=lambda x: x.content_metadata.get("viral_score", 0) if x.content_metadata else 0, reverse=True)

    # Every platform branch falls back to `quotes`, so if there is no
    # schedulable content at all (e.g. only clip_file/quote_card types
    # were generated), indexing `x[0 % 0]` would raise ZeroDivisionError.
    if not (clips or quotes or threads or linkedin or instagram):
        raise HTTPException(
            status_code=400,
            detail="No schedulable content found for this episode.",
        )

    LINKEDIN_DAYS = {0, 3}
    INSTAGRAM_DAYS = {0, 2, 4}

    PLATFORM_HOURS = {
        "twitter": 9,
        "linkedin": 8,
        "instagram": 12,
    }

    db.query(ScheduledPost).filter(
        ScheduledPost.episode_id == body.episode_id
    ).delete()

    start = datetime.combine(body.start_date, datetime.min.time())
    scheduled = []

    # Use separate index per platform for clean round-robin
    clip_idx = 0
    quote_idx = 0
    thread_idx = 0
    linkedin_idx = 0
    instagram_idx = 0

    try:
        for day in range(30):
            scheduled_date = start + timedelta(days=day)
            weekday = scheduled_date.weekday()

            # ── Twitter — daily ──────────────────────────────────────────────
            # Twitter — daily distribution logic
            if day % 3 == 0:
                content_list = clips if clips else quotes
                content = content_list[clip_idx % len(content_list)]
                clip_idx += 1
            elif day % 3 == 1:
                content_list = quotes if quotes else clips
                content = content_list[quote_idx % len(content_list)]
                quote_idx += 1
            else:
                content_list = threads if threads else quotes
                content = content_list[thread_idx % len(content_list)]
                thread_idx += 1

            post_time = scheduled_date.replace(hour=PLATFORM_HOURS["twitter"], minute=0, second=0)
            db.add(ScheduledPost(
                id=str(uuid.uuid4()),
                episode_id=body.episode_id,
                content_id=content.id,
                content_type=content.content_type,
                content_body=content.body,
                scheduled_date=post_time,
                platform="twitter",
                status="scheduled",
            ))
            scheduled.append(1)

            # ── LinkedIn — Mon + Thu ─────────────────────────────────────────
            if weekday in LINKEDIN_DAYS:
                content_list = linkedin if linkedin else quotes
                content = content_list[linkedin_idx % len(content_list)]
                linkedin_idx += 1
                post_time = scheduled_date.replace(hour=PLATFORM_HOURS["linkedin"], minute=0, second=0)
                db.add(ScheduledPost(
                    id=str(uuid.uuid4()),
                    episode_id=body.episode_id,
                    content_id=content.id,
                    content_type=content.content_type,
                    content_body=content.body,
                    scheduled_date=post_time,
                    platform="linkedin",
                    status="scheduled",
                ))
                scheduled.append(1)

            # ── Instagram — Mon/Wed/Fri ──────────────────────────────────────
            if weekday in INSTAGRAM_DAYS:
                content_list = instagram if instagram else quotes
                content = content_list[instagram_idx % len(content_list)]
                instagram_idx += 1
                post_time = scheduled_date.replace(hour=PLATFORM_HOURS["instagram"], minute=0, second=0)
                db.add(ScheduledPost(
                    id=str(uuid.uuid4()),
                    episode_id=body.episode_id,
                    content_id=content.id,
                    content_type=content.content_type,
                    content_body=content.body,
                    scheduled_date=post_time,
                    platform="instagram",
                    status="scheduled",
                ))
                scheduled.append(1)

        # Finalize scheduling commit
        db.commit()

        return {
            "success": True,
            "data": {
                "scheduled_count": len(scheduled),
                "start_date": body.start_date.isoformat(),
                "end_date": (start + timedelta(days=29)).isoformat(),
            }
        }

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

# ── Route: Get calendar for an episode ──────────────────────────────────────

@router.get("/posts/{episode_id}")
def get_posts(episode_id: str, db: Session = Depends(get_db)):
    """Return all scheduled posts for an episode, ordered by date."""
    posts = db.query(ScheduledPost).filter(
        ScheduledPost.episode_id == episode_id
    ).order_by(ScheduledPost.scheduled_date).all()

    return {
        "success": True,
        "data": {
            "posts": [
                {
                    "id": p.id,
                    "content_type": p.content_type,
                    "content_body": p.content_body,
                    "scheduled_date": p.scheduled_date.isoformat(),
                    "platform": p.platform,
                    "status": p.status,
                }
                for p in posts
            ]
        }
    }

# ── Route: Get all episodes ──────────────────────────────────────────────────

@router.get("/episodes")
def get_episodes(db: Session = Depends(get_db)):
    """Return all saved episodes."""
    episodes = db.query(Episode).order_by(Episode.created_at.desc()).limit(50).all()
    return {
        "success": True,
        "data": {
            "episodes": [
                {
                    "id": e.id,
                    "title": e.title,
                    "word_count": e.word_count,
                    "episode_summary": e.episode_summary,
                    "main_themes": e.main_themes,
                    "created_at": e.created_at.isoformat(),
                }
                for e in episodes
            ]
        }
    }

# ── Route: Update post status ────────────────────────────────────────────────

@router.patch("/posts/{post_id}/status")
def update_post_status(post_id: str, status: str, db: Session = Depends(get_db)):
    """Mark a post as posted or skipped."""
    if status not in ["scheduled", "posted", "skipped"]:
        raise HTTPException(status_code=400, detail=f"Invalid status: {status}")

    post = db.query(ScheduledPost).filter(ScheduledPost.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    post.status = status
    db.commit()
    return {"success": True, "data": {"post_id": post_id, "status": status}}