"""Regression tests for AUDIT A7: GET /analyze returned 200 with empty results
the moment the Episode row existed, so the results page rendered a permanent
blank 'Complete' state while the LLM was still running.

Updated for Celery migration: POST /analyze now queues job (202) and task
handles completion/error asynchronously. Tests verify dispatch + task logic."""

import json
from unittest.mock import MagicMock, patch

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
    # POST should queue job
    with patch("routes.analyze.analyze_episode_task.delay") as mock_delay:
        mock_delay.return_value.id = "celery-1"
        resp = auth_client.post("/analyze/", json={"file_id": "st-1"})
        assert resp.status_code == 202
        assert resp.json()["analysis_status"] == "pending"
        assert "job_id" in resp.json()
        mock_delay.assert_called_once_with("st-1", AUTH_USER_ID)

    # Task itself should mark complete when Groq succeeds
    message = MagicMock()
    message.choices[0].message.content = GROQ_JSON
    fake = MagicMock()
    fake.chat.completions.create.return_value = message
    _mock_groq(monkeypatch, fake)

    from tasks.analyze import analyze_episode_task
    analyze_episode_task.run("st-1", AUTH_USER_ID)

    db_session.expire_all()
    ep = db_session.query(Episode).filter(Episode.id == "st-1").first()
    assert ep.analysis_status == "complete"


def test_post_failure_marks_episode_error(auth_client, db_session, monkeypatch):
    _seed_episode(db_session)
    with patch("routes.analyze.analyze_episode_task.delay") as mock_delay:
        mock_delay.return_value.id = "celery-err"
        resp = auth_client.post("/analyze/", json={"file_id": "st-1"})
        assert resp.status_code == 202
        assert resp.json()["analysis_status"] == "pending"

    fake = MagicMock()
    fake.chat.completions.create.side_effect = RuntimeError("boom")
    _mock_groq(monkeypatch, fake)

    from tasks.analyze import analyze_episode_task
    try:
        analyze_episode_task.run("st-1", AUTH_USER_ID)
    except RuntimeError:
        pass

    db_session.expire_all()
    ep = db_session.query(Episode).filter(Episode.id == "st-1").first()
    assert ep.analysis_status == "error"

    got = auth_client.get("/analyze/st-1")
    assert got.json()["analysis_status"] == "error"


def test_missing_groq_key_marks_episode_error(auth_client, db_session, monkeypatch):
    _seed_episode(db_session)
    monkeypatch.delenv("GROQ_API_KEY", raising=False)

    with patch("routes.analyze.analyze_episode_task.delay") as mock_delay:
        mock_delay.return_value.id = "celery-no-key"
        resp = auth_client.post("/analyze/", json={"file_id": "st-1"})
        # POST no longer validates GROQ key synchronously - still queues
        assert resp.status_code == 202
        assert resp.json()["analysis_status"] == "pending"

    from tasks.analyze import analyze_episode_task
    analyze_episode_task.run("st-1", AUTH_USER_ID)

    db_session.expire_all()
    ep = db_session.query(Episode).filter(Episode.id == "st-1").first()
    assert ep.analysis_status == "error"
    assert auth_client.get("/analyze/st-1").json()["analysis_status"] == "error"
