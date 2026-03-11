# backend/routes/analyze.py
# This is the AI brain of the app.
# It takes the transcript + word timestamps and asks Claude to find:
#   1. The best standalone quotes (for quote cards)
#   2. The best clip moments (for short video clips)
# Claude returns structured JSON we can use directly in the frontend.

import os
import json
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

router = APIRouter(prefix="/analyze", tags=["analyze"])

genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
client = genai.GenerativeModel("gemini-2.0-flash-exp")


# ── Request shape the frontend sends us ─────────────────────────────────────

class AnalyzeRequest(BaseModel):
    transcript: str         # full transcript text
    words: list             # word-level timestamps from Deepgram
    episode_title: str = "" # optional


# ── Helper: find a word's timestamp by searching the words list ──────────────

def find_timestamp(words: list, target_text: str, search_from: float = 0) -> dict:
    """
    Given a snippet of text, find where it starts and ends in the words list.
    Returns {start, end} in seconds.
    Falls back to 0,0 if not found (Claude occasionally paraphrases slightly).
    """
    target_words = target_text.lower().strip().split()
    if not target_words:
        return {"start": 0, "end": 0}

    first_word = target_words[0]

    for i, w in enumerate(words):
        # Skip words before our search start point
        if w.get("start", 0) < search_from:
            continue

        # Look for the first word of our target
        if w.get("word", "").lower().strip(".,!?") == first_word.strip(".,!?"):
            # Try to match the next few words to confirm it's the right spot
            match = True
            for j, tw in enumerate(target_words[1:4]):  # check up to 3 more words
                if i + j + 1 < len(words):
                    actual = words[i + j + 1].get("word", "").lower().strip(".,!?")
                    if actual != tw.strip(".,!?"):
                        match = False
                        break

            if match:
                # Find the end timestamp by looking ahead
                end_idx = min(i + len(target_words), len(words) - 1)
                return {
                    "start": round(w.get("start", 0), 2),
                    "end": round(words[end_idx].get("end", w.get("end", 0)), 2)
                }

    return {"start": 0, "end": 0}


# ── Main route: POST /analyze ────────────────────────────────────────────────

@router.post("/")
async def analyze_transcript(body: AnalyzeRequest):
    """
    Send transcript to Claude, get back structured quotes and clip suggestions.
    """
    if not body.transcript:
        raise HTTPException(status_code=400, detail="Transcript is empty")

    if not os.getenv("ANTHROPIC_API_KEY"):
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY not set")

    # ── Build the prompt ─────────────────────────────────────────────────────
    # We give Claude very specific instructions and a strict JSON format.
    # The more specific you are, the better Claude's output.

    prompt = f"""You are an expert podcast content strategist. Your job is to analyze podcast transcripts and find the most shareable, viral moments.

TRANSCRIPT:
{body.transcript}

Your task: Find the best content for social media repurposing.

Return ONLY a valid JSON object with this exact structure — no explanation, no markdown, just the JSON:

{{
  "quotes": [
    {{
      "text": "exact quote from transcript, word for word",
      "speaker": "Speaker 0 or Speaker 1 etc, or Unknown",
      "theme": "one word theme e.g. Mindset, Success, Failure, Leadership",
      "why_viral": "one sentence explaining why this quote will perform well",
      "first_words": "first 4 words of the quote exactly as written"
    }}
  ],
  "clips": [
    {{
      "title": "short punchy title for this clip",
      "summary": "1-2 sentence description of what happens in this moment",
      "start_text": "exact first 5 words spoken at the start of this clip",
      "end_text": "exact last 5 words spoken at the end of this clip",
      "why_viral": "one sentence on why this moment will perform",
      "clip_type": "one of: story, insight, debate, revelation, funny"
    }}
  ],
  "episode_summary": "2-3 sentence summary of the whole episode",
  "main_themes": ["theme1", "theme2", "theme3"]
}}

Rules:
- Find exactly 8 quotes. Each must be a single standalone sentence or two — punchy, not rambling.
- Find exactly 5 clip moments. Each clip should be 45-90 seconds of content.
- Quotes must be copied EXACTLY from the transcript, word for word.
- Prioritize moments with: strong opinions, surprising facts, emotional stories, contrarian takes, actionable advice.
- Do NOT include boring or generic statements."""

    try:
        # Call Gemini  API
        message = client.generate_content(prompt)

        # Parse Gemini's response as JSON
        raw_response = message.text
        
        # Strip markdown code blocks if Gemini accidentally adds them
        if raw_response.startswith("```"):
            raw_response = raw_response.split("```")[1]
            if raw_response.startswith("json"):
                raw_response = raw_response[4:]

        analysis = json.loads(raw_response.strip())

        # ── Attach timestamps to each quote ─────────────────────────────────
        # We take the first_words Claude gave us and look them up in the word list

        for quote in analysis.get("quotes", []):
            first_words = quote.get("first_words", quote["text"][:30])
            timestamps = find_timestamp(body.words, first_words)
            quote["start_time"] = timestamps["start"]
            quote["end_time"] = timestamps["end"]
            # Remove the helper field we don't need anymore
            quote.pop("first_words", None)

        # ── Attach timestamps to each clip ───────────────────────────────────

        for clip in analysis.get("clips", []):
            start_ts = find_timestamp(body.words, clip.get("start_text", ""))
            end_ts = find_timestamp(body.words, clip.get("end_text", ""), search_from=start_ts["start"])
            clip["start_time"] = start_ts["start"]
            clip["end_time"] = end_ts["end"] if end_ts["end"] > 0 else start_ts["start"] + 60
            clip.pop("start_text", None)
            clip.pop("end_text", None)

        return {
            "success": True,
            "quotes": analysis.get("quotes", []),
            "clips": analysis.get("clips", []),
            "episode_summary": analysis.get("episode_summary", ""),
            "main_themes": analysis.get("main_themes", []),
        }

    except json.JSONDecodeError as e:
        raise HTTPException(status_code=500, detail=f"Claude returned invalid JSON: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))