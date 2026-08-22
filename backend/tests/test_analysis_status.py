"""Regression tests for AUDIT A7: GET /analyze returned 200 with empty results
the moment the Episode row existed, so the results page rendered a permanent
blank 'Complete' state while the LLM was still running."""

import json
from unittest.mock import MagicMock

from database import Episode

from conftest import AUTH_USER_ID

GROQ_JSON = json.dumps({
    "quotes": [],
    "clips": [],
    "episode_summary": "s",
    "main_themes": [],
    "topics_discussed": [],
    "controversial_moments": [],
    "knowledge_extracted": {"key_lessons": [], "key_insights": [], "actionable_tips": []},
    "speaker_highlights": [],
    "twitter_thread": ["t1"],
    "linkedin_post": "li",
    "instagram_caption": "ig",
})


def _seed_episode(db, user_id=AUTH_USER_ID):
    ep = Episode(
        id="st-1", title="T", filename="f.mp4",
        transcript="some transcript text here", words=[], word_count=4,
        user_id=user_id,
    )
    db.add(ep)
    db.commit()


def _mock_groq(monkeypatch, client_mock):
    monkeypatch.setenv("GROQ_API_KEY", "test-key")
    monkeypatch.setattr("groq.Groq", lambda api_key: client_mock)


def test_get_reports_pending_when_never_analyzed(auth_client, db_session):
    _seed_episode(db_session)
    resp = auth_client.get("/analyze/st-1")
    assert resp.status_code == 200
    assert resp.json()["analysis_status"] == "pending"


def test_post_marks_episode_complete(auth_client, db_session, monkeypatch):
    _seed_episode(db_session)
    message = MagicMock()
    message.choices[0].message.content = GROQ_JSON
    fake = MagicMock()
    fake.chat.completions.create.return_value = message
    _mock_groq(monkeypatch, fake)

    resp = auth_client.post("/analyze/", json={"file_id": "st-1"})
    assert resp.status_code == 200
    assert resp.json()["analysis_status"] == "complete"

    db_session.expire_all()
    ep = db_session.query(Episode).filter(Episode.id == "st-1").first()
    assert ep.analysis_status == "complete"


def test_post_failure_marks_episode_error(auth_client, db_session, monkeypatch):
    _seed_episode(db_session)
    fake = MagicMock()
    fake.chat.completions.create.side_effect = RuntimeError("boom")
    _mock_groq(monkeypatch, fake)

    resp = auth_client.post("/analyze/", json={"file_id": "st-1"})
    assert resp.status_code == 500

    db_session.expire_all()
    ep = db_session.query(Episode).filter(Episode.id == "st-1").first()
    assert ep.analysis_status == "error"

    # And the frontend can now see the terminal error state:
    got = auth_client.get("/analyze/st-1")
    assert got.json()["analysis_status"] == "error"


def test_missing_groq_key_marks_episode_error(auth_client, db_session, monkeypatch):
    _seed_episode(db_session)
    monkeypatch.delenv("GROQ_API_KEY", raising=False)

    resp = auth_client.post("/analyze/", json={"file_id": "st-1"})
    assert resp.status_code == 500

    db_session.expire_all()
    ep = db_session.query(Episode).filter(Episode.id == "st-1").first()
    assert ep.analysis_status == "error"
    assert auth_client.get("/analyze/st-1").json()["analysis_status"] == "error"
