"""Task 5: rate limiting & daily quotas — expects 429 when limits exceeded."""
import pytest
from unittest.mock import patch, MagicMock
from datetime import datetime

from conftest import AUTH_USER_ID, make_user
from database import Episode, Job


def _reset_limiter():
    """Clear slowapi memory storage between tests if limiter exists."""
    try:
        from middleware.rate_limit import limiter
        # slowapi 0.1.9 uses limiter.storage or limiter._storage
        for attr in ("storage", "_storage"):
            if hasattr(limiter, attr):
                storage = getattr(limiter, attr)
                # MemoryStorage has reset() or storage dict
                if hasattr(storage, "reset"):
                    try:
                        storage.reset()
                    except Exception:
                        pass
                if hasattr(storage, "storage"):
                    try:
                        storage.storage.clear()
                    except Exception:
                        pass
                if hasattr(storage, "_storage"):
                    try:
                        storage._storage.clear()
                    except Exception:
                        pass
        # limits.storage.MemoryStorage also exposes clear
        if hasattr(limiter, "storage") and hasattr(limiter.storage, "storage"):
            try:
                limiter.storage.storage.clear()
            except Exception:
                pass
    except ImportError:
        pass
    except Exception:
        pass


def test_upload_rate_limited(auth_client):
    _reset_limiter()
    # Mock external dependencies so 10 requests succeed with 200/queued
    with patch("utils.url_validator.validate_upload_url", return_value={"host": "www.youtube.com", "is_allowed": True}), \
         patch("worker.process_url_job.delay") as mock_delay, \
         patch("yt_dlp.YoutubeDL") as mock_ydl:

        mock_instance = MagicMock()
        mock_instance.__enter__.return_value = mock_instance
        mock_instance.__exit__.return_value = False
        mock_instance.extract_info.return_value = {"duration": 100, "title": "t"}
        mock_ydl.return_value = mock_instance

        got_429 = False
        last_resp = None
        for i in range(11):
            last_resp = auth_client.post("/upload/url", json={"url": "https://www.youtube.com/watch?v=test", "title": "t"})
            if last_resp.status_code == 429:
                got_429 = True
                break
        assert got_429, f"Expected 429 after exceeding 10/minute upload limit, last status={last_resp.status_code if last_resp else None} body={last_resp.json() if last_resp else None}"


def test_analyze_daily_quota(auth_client, db_session):
    _reset_limiter()
    from database import Episode, Job

    make_user(db_session, AUTH_USER_ID)
    ep = Episode(id="ep-quota", user_id=AUTH_USER_ID, title="T", filename="f.mp4",
                 transcript="hello world transcript here", words=[], word_count=4)
    db_session.add(ep)
    db_session.commit()

    # Fill daily quota with 20 Jobs created today
    for i in range(20):
        job = Job(id=f"quota-job-{i}", user_id=AUTH_USER_ID, status="queued", progress=0, created_at=datetime.utcnow())
        db_session.add(job)
    db_session.commit()

    with patch("routes.analyze.analyze_episode_task.delay") as mock_delay:
        mock_delay.return_value.id = "celery-job-123"
        resp = auth_client.post("/analyze/", json={"file_id": "ep-quota"})
        assert resp.status_code == 429, f"Expected 429 daily quota exceeded, got {resp.status_code} {resp.json()}"
        detail = resp.json().get("detail", "").lower()
        assert "quota" in detail or "daily" in detail or "limit" in detail
