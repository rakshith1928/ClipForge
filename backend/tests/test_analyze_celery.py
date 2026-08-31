from unittest.mock import patch
from conftest import AUTH_USER_ID, make_user
from database import Episode, Job

def test_post_analyze_returns_job_id(auth_client, db_session):
    ep = Episode(id="ep-analyze", user_id=AUTH_USER_ID, title="T", filename="f.mp4",
                 transcript="hello world transcript here", words=[], word_count=4)
    db_session.add(ep)
    db_session.commit()
    with patch("routes.analyze.analyze_episode_task.delay") as mock_delay:
        mock_delay.return_value.id = "celery-job-123"
        resp = auth_client.post("/analyze/", json={"file_id": "ep-analyze"})
        assert resp.status_code == 202
        assert "job_id" in resp.json()
        mock_delay.assert_called_once()

def test_post_analyze_requires_episode(auth_client):
    resp = auth_client.post("/analyze/", json={"file_id": "nonexistent"})
    assert resp.status_code == 404
