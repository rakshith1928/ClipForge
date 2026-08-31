from unittest.mock import patch
from conftest import AUTH_USER_ID, make_user
from database import Episode

def test_post_clip_returns_job(auth_client, db_session, tmp_path):
    ep = Episode(id="ep-clip", user_id=AUTH_USER_ID, title="T", filename="f.mp4", transcript="t", words=[], word_count=1)
    db_session.add(ep)
    db_session.commit()
    with patch("routes.generate.generate_clip_task.delay") as mock_delay:
        mock_delay.return_value.id = "job-123"
        resp = auth_client.post("/generate/clip", json={
            "file_id": "ep-clip", "episode_id": "ep-clip", "start_time": 0, "end_time": 10
        })
        assert resp.status_code == 202
        assert "job_id" in resp.json()
