"""A1: analysis endpoints require auth and episodes are scoped to their owner."""

import json
from unittest.mock import MagicMock

from database import Episode, GeneratedContent

from conftest import AUTH_USER_ID, make_user


GROQ_JSON = json.dumps({
    "quotes": [], "clips": [], "episode_summary": "s",
    "main_themes": [], "topics_discussed": [],
    "controversial_moments": [],
    "knowledge_extracted": {"key_lessons": [], "key_insights": [], "actionable_tips": []},
    "speaker_highlights": [], "twitter_thread": ["t1"],
    "linkedin_post": "li", "instagram_caption": "ig",
})


def _mock_groq(monkeypatch):
    message = MagicMock()
    message.choices[0].message.content = GROQ_JSON
    fake = MagicMock()
    fake.chat.completions.create.return_value = message
    monkeypatch.setenv("GROQ_API_KEY", "test-key")
    monkeypatch.setattr("groq.Groq", lambda api_key: fake)


def _seed_episode(db, episode_id, owner_id):
    db.add(Episode(id=episode_id, title="T", filename="f.mp4",
                   transcript="some transcript text here", words=[],
                   word_count=4, user_id=owner_id))
    db.commit()


def test_post_analyze_requires_auth(client):
    assert client.post("/analyze/", json={"file_id": "x"}).status_code in (401, 403)


def test_get_analysis_requires_auth(client):
    assert client.get("/analyze/x").status_code in (401, 403)


def test_cannot_read_other_users_episode(auth_client, db_session):
    make_user(db_session, "other-user")
    _seed_episode(db_session, "ep-other", "other-user")
    assert auth_client.get("/analyze/ep-other").status_code == 404
    assert auth_client.post("/analyze/", json={"file_id": "ep-other"}).status_code == 404


def test_owner_can_read_and_analyze(auth_client, db_session, monkeypatch):
    _seed_episode(db_session, "ep-mine", AUTH_USER_ID)
    assert auth_client.get("/analyze/ep-mine").status_code == 200

    from unittest.mock import patch
    with patch("routes.analyze.analyze_episode_task.delay") as mock_delay:
        mock_delay.return_value.id = "celery-owner"
        resp = auth_client.post("/analyze/", json={"file_id": "ep-mine"})
        assert resp.status_code == 202
        assert "job_id" in resp.json()
        mock_delay.assert_called_once()

    # Run task synchronously to verify content creation
    _mock_groq(monkeypatch)
    from tasks.analyze import analyze_episode_task
    analyze_episode_task.run("ep-mine", AUTH_USER_ID)

    db_session.expire_all()
    contents = db_session.query(GeneratedContent).filter(
        GeneratedContent.episode_id == "ep-mine").all()
    assert contents, "analysis should produce GeneratedContent rows"
    assert all(c.user_id == AUTH_USER_ID for c in contents)
