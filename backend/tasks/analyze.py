import json
import os
import uuid

from celery_app import celery_app
from database import SessionLocal, Episode, GeneratedContent


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


def _mark_analysis_error(db, file_id: str) -> None:
    episode = db.query(Episode).filter(Episode.id == file_id).first()
    if episode:
        episode.analysis_status = "error"
        db.commit()


@celery_app.task(bind=True, acks_late=True, autoretry_for=(Exception,), retry_backoff=True, max_retries=3, time_limit=120, soft_time_limit=90)
def analyze_episode_task(self, file_id: str, user_id: str):
    db = SessionLocal()
    try:
        episode = db.query(Episode).filter(Episode.id == file_id, Episode.user_id == user_id).first()
        if not episode:
            return
        episode.analysis_status = "pending"
        db.commit()

        transcript = episode.transcript or ""
        words = episode.words or []

        if not transcript:
            _mark_analysis_error(db, file_id)
            return

        if not os.getenv("GROQ_API_KEY"):
            _mark_analysis_error(db, file_id)
            return

        from groq import Groq

        client = Groq(api_key=os.getenv("GROQ_API_KEY"))

        prompt = f"""You are an expert podcast content strategist. Analyze this transcript deeply.

TRANSCRIPT:
{transcript}

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

            if "```" in raw_response:
                raw_response = raw_response.split("```")[1]
                if raw_response.startswith("json"):
                    raw_response = raw_response[4:]

            analysis = json.loads(raw_response.strip())

            for quote in analysis.get("quotes", []):
                first_words = quote.get("first_words", quote["text"][:30])
                timestamps = find_timestamp(words, first_words)
                quote["start_time"] = timestamps["start"]
                quote["end_time"] = timestamps["end"]
                quote.pop("first_words", None)

            for clip in analysis.get("clips", []):
                start_ts = find_timestamp(words, clip.get("start_text", ""))
                end_ts = find_timestamp(words, clip.get("end_text", ""), search_from=start_ts["start"])
                clip["start_time"] = start_ts["start"]
                clip["end_time"] = end_ts["end"] if end_ts["end"] > 0 else start_ts["start"] + 60
                clip.pop("start_text", None)
                clip.pop("end_text", None)

            episode = db.query(Episode).filter(Episode.id == file_id, Episode.user_id == user_id).first()
            if episode:
                episode.episode_summary = analysis.get("episode_summary", "")
                episode.main_themes = analysis.get("main_themes", [])
                episode.topics_discussed = analysis.get("topics_discussed", [])
            else:
                episode = Episode(
                    id=file_id,
                    user_id=user_id,
                    title="Untitled Podcast",
                    filename="",
                    transcript=transcript[:500],
                    words=words,
                    word_count=len(words),
                    episode_summary=analysis.get("episode_summary", ""),
                    main_themes=analysis.get("main_themes", []),
                    topics_discussed=analysis.get("topics_discussed", []),
                )
                db.add(episode)

            for i, clip in enumerate(analysis.get("clips", [])):
                content = GeneratedContent(
                    id=str(uuid.uuid4()),
                    episode_id=file_id,
                    user_id=user_id,
                    content_type="clip",
                    title=clip.get("title", f"Clip {i+1}"),
                    body=clip.get("summary", ""),
                    content_metadata={
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

            for i, quote in enumerate(analysis.get("quotes", [])):
                content = GeneratedContent(
                    id=str(uuid.uuid4()),
                    episode_id=file_id,
                    user_id=user_id,
                    content_type="quote",
                    title=quote.get("theme", f"Quote {i+1}"),
                    body=quote.get("text", ""),
                    content_metadata={
                        "speaker": quote.get("speaker", "Unknown"),
                        "viral_score": quote.get("viral_score", 0),
                        "start_time": quote.get("start_time", 0),
                        "end_time": quote.get("end_time", 0),
                        "why_viral": quote.get("why_viral", ""),
                    },
                )
                db.add(content)

            if analysis.get("twitter_thread"):
                content = GeneratedContent(
                    id=str(uuid.uuid4()),
                    episode_id=file_id,
                    user_id=user_id,
                    content_type="twitter_thread",
                    title="Twitter Thread",
                    body=json.dumps(analysis["twitter_thread"]),
                    content_metadata={},
                )
                db.add(content)

            if analysis.get("linkedin_post"):
                content = GeneratedContent(
                    id=str(uuid.uuid4()),
                    episode_id=file_id,
                    user_id=user_id,
                    content_type="linkedin",
                    title="LinkedIn Post",
                    body=analysis["linkedin_post"],
                    content_metadata={},
                )
                db.add(content)

            if analysis.get("instagram_caption"):
                content = GeneratedContent(
                    id=str(uuid.uuid4()),
                    episode_id=file_id,
                    user_id=user_id,
                    content_type="instagram",
                    title="Instagram Caption",
                    body=analysis["instagram_caption"],
                    content_metadata={},
                )
                db.add(content)

            episode.analysis_status = "complete"
            db.commit()

        except json.JSONDecodeError as e:
            db.rollback()
            _mark_analysis_error(db, file_id)
            raise
        except Exception as e:
            db.rollback()
            _mark_analysis_error(db, file_id)
            raise
    finally:
        db.close()
