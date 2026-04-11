# backend/routes/analyze.py

import os
import json
import uuid
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from groq import Groq
from dotenv import load_dotenv
from sqlalchemy.orm import Session

from database import get_db, Episode, GeneratedContent

load_dotenv()

router = APIRouter(prefix="/analyze", tags=["analyze"])
client = Groq(api_key=os.getenv("GROQ_API_KEY"))


class AnalyzeRequest(BaseModel):
    file_id: str
    transcript: str
    words: list
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


@router.post("/")
async def analyze_transcript(body: AnalyzeRequest, db: Session = Depends(get_db)):
    if not body.transcript:
        raise HTTPException(status_code=400, detail="Transcript is empty")

    if not os.getenv("GROQ_API_KEY"):
        raise HTTPException(status_code=500, detail="GROQ_API_KEY not set")

    prompt = f"""You are an expert podcast content strategist. Analyze this transcript deeply.

TRANSCRIPT:
{body.transcript}

Return ONLY a valid JSON object with this exact structure — no explanation, no markdown, just the JSON:

{{
  "quotes": [
    {{
      "text": "exact quote from transcript word for word",
      "speaker": "Speaker 0 or Speaker 1 or Unknown",
      "theme": "one word theme",
      "why_viral": "one sentence on why this performs well",
      "viral_score": 85,
      "first_words": "first 4 words of quote exactly"
    }}
  ],
  "clips": [
    {{
      "title": "short punchy title",
      "summary": "1-2 sentence description",
      "start_text": "exact first 5 words of clip",
      "end_text": "exact last 5 words of clip",
      "why_viral": "one sentence on why this moment performs",
      "clip_type": "one of: story, insight, debate, revelation, funny",
      "viral_score": 90,
      "hook_original": "the actual opening line of this clip",
      "hook_rewritten": "rewritten hook to maximise first 3 seconds e.g. I lost everything before I learned this"
    }}
  ],
  "episode_summary": "2-3 sentence summary",
  "main_themes": ["theme1", "theme2", "theme3"],
  "topics_discussed": ["topic1", "topic2", "topic3", "topic4", "topic5"],
  "controversial_moments": [
    {{
      "moment": "brief description of controversial or opinionated moment",
      "quote": "exact words from transcript"
    }}
  ],
  "knowledge_extracted": {{
    "key_lessons": ["lesson1", "lesson2", "lesson3"],
    "key_insights": ["insight1", "insight2", "insight3"],
    "actionable_tips": ["tip1", "tip2", "tip3"]
  }},
  "speaker_highlights": [
    {{
      "speaker": "Speaker 0",
      "best_moment": "one sentence description of their strongest moment",
      "quote": "their best quote from the transcript"
    }}
  ],
  "twitter_thread": [
    "Tweet 1 - hook tweet that makes people want to read more",
    "Tweet 2",
    "Tweet 3",
    "Tweet 4",
    "Tweet 5",
    "Tweet 6",
    "Tweet 7",
    "Tweet 8",
    "Tweet 9",
    "Tweet 10 - CTA tweet"
  ],
  "linkedin_post": "full linkedin post based on the episode. professional tone. 150-200 words. include line breaks.",
  "instagram_caption": "instagram caption with emojis. conversational tone. 80-100 words. include relevant hashtags."
}}

Rules:
- Find exactly 8 quotes. Punchy, standalone, not rambling.
- Find exactly 5 clips of 45-90 seconds each.
- Find exactly 2 controversial moments.
- Quotes must be copied EXACTLY from the transcript.
- viral_score is 0-100 based on emotion, controversy, insight, and shareability.
- hook_rewritten should be dramatically more compelling than the original.
- Twitter thread should tell a complete story from the episode.
- Prioritize: strong opinions, surprising facts, emotional stories, contrarian takes, actionable advice."""

    try:
        message = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=6000,
        )
        raw_response = message.choices[0].message.content

        # Strip markdown if model adds it
        if "```" in raw_response:
            raw_response = raw_response.split("```")[1]
            if raw_response.startswith("json"):
                raw_response = raw_response[4:]

        analysis = json.loads(raw_response.strip())

        # Attach timestamps to quotes
        for quote in analysis.get("quotes", []):
            first_words = quote.get("first_words", quote["text"][:30])
            timestamps = find_timestamp(body.words, first_words)
            quote["start_time"] = timestamps["start"]
            quote["end_time"] = timestamps["end"]
            quote.pop("first_words", None)

        # Attach timestamps to clips
        for clip in analysis.get("clips", []):
            start_ts = find_timestamp(body.words, clip.get("start_text", ""))
            end_ts = find_timestamp(body.words, clip.get("end_text", ""), search_from=start_ts["start"])
            clip["start_time"] = start_ts["start"]
            clip["end_time"] = end_ts["end"] if end_ts["end"] > 0 else start_ts["start"] + 60
            clip.pop("start_text", None)
            clip.pop("end_text", None)

        # ── Save to PostgreSQL ────────────────────────────────────────────

        # Update the Episode record with analysis results
        episode = db.query(Episode).filter(Episode.id == body.file_id).first()
        if episode:
            episode.episode_summary = analysis.get("episode_summary", "")
            episode.main_themes = analysis.get("main_themes", [])
            episode.topics_discussed = analysis.get("topics_discussed", [])
            if body.episode_title:
                episode.title = body.episode_title
        else:
            # Episode wasn't created during upload — create it now
            episode = Episode(
                id=body.file_id,
                title=body.episode_title or "Untitled Podcast",
                filename="",
                transcript=body.transcript[:500],  # Store a preview
                word_count=len(body.words),
                episode_summary=analysis.get("episode_summary", ""),
                main_themes=analysis.get("main_themes", []),
                topics_discussed=analysis.get("topics_discussed", []),
            )
            db.add(episode)

        # Save each clip as GeneratedContent
        for i, clip in enumerate(analysis.get("clips", [])):
            content = GeneratedContent(
                id=str(uuid.uuid4()),
                episode_id=body.file_id,
                content_type="clip",
                title=clip.get("title", f"Clip {i+1}"),
                body=clip.get("summary", ""),
                metadata={
                    "viral_score": clip.get("viral_score", 0),
                    "start_time": clip.get("start_time", 0),
                    "end_time": clip.get("end_time", 0),
                    "hook_original": clip.get("hook_original", ""),
                    "hook_rewritten": clip.get("hook_rewritten", ""),
                    "clip_type": clip.get("clip_type", ""),
                    "why_viral": clip.get("why_viral", ""),
                },
            )
            db.add(content)

        # Save each quote as GeneratedContent
        for i, quote in enumerate(analysis.get("quotes", [])):
            content = GeneratedContent(
                id=str(uuid.uuid4()),
                episode_id=body.file_id,
                content_type="quote",
                title=quote.get("theme", f"Quote {i+1}"),
                body=quote.get("text", ""),
                metadata={
                    "speaker": quote.get("speaker", "Unknown"),
                    "viral_score": quote.get("viral_score", 0),
                    "start_time": quote.get("start_time", 0),
                    "end_time": quote.get("end_time", 0),
                    "why_viral": quote.get("why_viral", ""),
                },
            )
            db.add(content)

        # Save twitter thread
        if analysis.get("twitter_thread"):
            content = GeneratedContent(
                id=str(uuid.uuid4()),
                episode_id=body.file_id,
                content_type="twitter_thread",
                title="Twitter Thread",
                body=json.dumps(analysis["twitter_thread"]),
                metadata={},
            )
            db.add(content)

        # Save linkedin post
        if analysis.get("linkedin_post"):
            content = GeneratedContent(
                id=str(uuid.uuid4()),
                episode_id=body.file_id,
                content_type="linkedin",
                title="LinkedIn Post",
                body=analysis["linkedin_post"],
                metadata={},
            )
            db.add(content)

        # Save instagram caption
        if analysis.get("instagram_caption"):
            content = GeneratedContent(
                id=str(uuid.uuid4()),
                episode_id=body.file_id,
                content_type="instagram",
                title="Instagram Caption",
                body=analysis["instagram_caption"],
                metadata={},
            )
            db.add(content)

        db.commit()

        # ── Build response ────────────────────────────────────────────────

        return {
            "success": True,
            "episode": {
                "title": episode.title or "Untitled Podcast",
                "summary": analysis.get("episode_summary", "")
            },
            "quotes": analysis.get("quotes", []),
            "clips": analysis.get("clips", []),
            "episode_summary": analysis.get("episode_summary", ""),
            "main_themes": analysis.get("main_themes", []),
            "topics_discussed": analysis.get("topics_discussed", []),
            "controversial_moments": analysis.get("controversial_moments", []),
            "knowledge_extracted": analysis.get("knowledge_extracted", {}),
            "speaker_highlights": analysis.get("speaker_highlights", []),
            "twitter_thread": analysis.get("twitter_thread", []),
            "linkedin_post": analysis.get("linkedin_post", ""),
            "instagram_caption": analysis.get("instagram_caption", ""),
        }

    except json.JSONDecodeError as e:
        raise HTTPException(status_code=500, detail=f"Invalid JSON from Groq: {str(e)}")
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


# ── GET /analyze/{file_id} — Fetch saved analysis from DB ────────────────────

@router.get("/{file_id}")
async def get_analysis(file_id: str, db: Session = Depends(get_db)):
    # Look up the episode
    episode = db.query(Episode).filter(Episode.id == file_id).first()
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
                "viral_score": c.metadata.get("viral_score", 0),
                "start_time": c.metadata.get("start_time", 0),
                "end_time": c.metadata.get("end_time", 0),
                "hook_original": c.metadata.get("hook_original", ""),
                "hook_rewritten": c.metadata.get("hook_rewritten", ""),
                "clip_type": c.metadata.get("clip_type", ""),
                "why_viral": c.metadata.get("why_viral", ""),
            })
        elif c.content_type == "quote":
            quotes.append({
                "text": c.body,
                "speaker": c.metadata.get("speaker", "Unknown"),
                "theme": c.title,
                "viral_score": c.metadata.get("viral_score", 0),
                "start_time": c.metadata.get("start_time", 0),
                "end_time": c.metadata.get("end_time", 0),
                "why_viral": c.metadata.get("why_viral", ""),
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
            "summary": episode.episode_summary or ""
        },
        "quotes": quotes,
        "clips": clips,
        "episode_summary": episode.episode_summary or "",
        "main_themes": episode.main_themes or [],
        "topics_discussed": episode.topics_discussed or [],
        "twitter_thread": twitter_thread,
        "linkedin_post": linkedin_post,
        "instagram_caption": instagram_caption,
    }