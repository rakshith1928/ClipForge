# backend/routes/analyze.py

import json
import os
import uuid

from dotenv import load_dotenv
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from auth import get_current_user
from database import Episode, GeneratedContent, Job, User, get_db
from tasks.analyze import analyze_episode_task

load_dotenv()

router = APIRouter(prefix="/analyze", tags=["analyze"])


class AnalyzeRequest(BaseModel):
    file_id: str
    transcript: str = ""
    words: list = []
    episode_title: str = ""


def find_timestamp(words: list, target_text: str, search_from: float = 0) -> dict:
    target_words = target_text.lower().strip().split()
    if not target_words:
        return {"start": 0, "end": 0}

    first_word = target_words[0]

    for i, w in enumerate(words):
        if w.get("start", 0) < search_from:
            continue
        if w.get("word", "").lower().strip(".,!?") == first_word.strip(".,!?"):
            match = True
            for j, tw in enumerate(target_words[1:4]):
                if i + j + 1 < len(words):
                    actual = words[i + j + 1].get("word", "").lower().strip(".,!?")
                    if actual != tw.strip(".,!?"):
                        match = False
                        break
            if match:
                end_idx = min(i + len(target_words), len(words) - 1)
                return {
                    "start": round(w.get("start", 0), 2),
                    "end": round(words[end_idx].get("end", w.get("end", 0)), 2)
                }

    return {"start": 0, "end": 0}


def _mark_analysis_error(db: Session, file_id: str) -> None:
    episode = db.query(Episode).filter(Episode.id == file_id).first()
    if episode:
        episode.analysis_status = "error"
        db.commit()


@router.post("/", status_code=202)
async def analyze_transcript(body: AnalyzeRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    episode = db.query(Episode).filter(Episode.id == body.file_id, Episode.user_id == current_user.id).first()
    if not episode:
        raise HTTPException(status_code=404, detail="Episode not found")
    if not episode.transcript:
        raise HTTPException(status_code=400, detail="Transcript is empty")
    job = Job(id=str(uuid.uuid4()), user_id=current_user.id, status="queued", progress=0)
    db.add(job)
    db.commit()
    analyze_episode_task.delay(body.file_id, current_user.id)
    return {"job_id": job.id, "status": "queued", "analysis_status": "pending"}


# ── GET /analyze/{file_id} — Fetch saved analysis from DB ────────────────────

@router.get("/{file_id}")
async def get_analysis(file_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    # Look up the episode
    episode = db.query(Episode).filter(Episode.id == file_id, Episode.user_id == current_user.id).first()
    if not episode:
        raise HTTPException(status_code=404, detail="Analysis not found or still processing")

    # Get all generated content for this episode
    contents = db.query(GeneratedContent).filter(GeneratedContent.episode_id == file_id).all()

    # Separate by content type
    clips = []
    quotes = []
    twitter_thread = []
    linkedin_post = ""
    instagram_caption = ""

    for c in contents:
        if c.content_type == "clip":
            clips.append({
                "title": c.title,
                "summary": c.body,
                "viral_score":                 c.content_metadata.get("viral_score", 0),
                "start_time":                 c.content_metadata.get("start_time", 0),
                "end_time":                 c.content_metadata.get("end_time", 0),
                "hook_original":                 c.content_metadata.get("hook_original", ""),
                "hook_rewritten":                 c.content_metadata.get("hook_rewritten", ""),
                "clip_type":                 c.content_metadata.get("clip_type", ""),
                "why_viral":                 c.content_metadata.get("why_viral", ""),
            })
        elif c.content_type == "quote":
            quotes.append({
                "text": c.body,
                "speaker":                 c.content_metadata.get("speaker", "Unknown"),
                "theme": c.title,
                "viral_score":                 c.content_metadata.get("viral_score", 0),
                "start_time":                 c.content_metadata.get("start_time", 0),
                "end_time":                 c.content_metadata.get("end_time", 0),
                "why_viral":                 c.content_metadata.get("why_viral", ""),
            })
        elif c.content_type == "twitter_thread":
            try:
                twitter_thread = json.loads(c.body)
            except json.JSONDecodeError:
                twitter_thread = []
        elif c.content_type == "linkedin":
            linkedin_post = c.body
        elif c.content_type == "instagram":
            instagram_caption = c.body

    return {
        "success": True,
        "episode": {
            "title": episode.title or "Untitled Podcast",
            "summary": episode.episode_summary or "",
            "filename": episode.filename or "",
            "storage_path": episode.storage_path or "",
            "duration": episode.duration or 0,
            "words": episode.words or [],
        },
        "quotes": quotes,
        "clips": clips,
        "episode_summary": episode.episode_summary or "",
        "main_themes": episode.main_themes or [],
        "topics_discussed": episode.topics_discussed or [],
        "twitter_thread": twitter_thread,
        "linkedin_post": linkedin_post,
        "instagram_caption": instagram_caption,
        "analysis_status": episode.analysis_status or "pending",
    }