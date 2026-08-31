"""Task 6: Worker Reliability — Retries, Timeouts, Sweeper (B4, B5).

Two tests per brief:
- sweeper fails stale jobs (>30m in queued/uploading/transcribing)
- dispatch failure cleans file and marks job error
"""
from datetime import datetime, timedelta
from unittest.mock import patch

from conftest import AUTH_USER_ID, make_user
from database import Job


def test_sweeper_fails_stale_jobs(db_session):
    from tasks.sweeper import sweep_stale_jobs

    old = Job(
        id="stale-1",
        user_id=AUTH_USER_ID,
        status="transcribing",
        progress=50,
        created_at=datetime.utcnow() - timedelta(minutes=31),
    )
    db_session.add(old)
    db_session.commit()

    # Fresh job should not be affected
    fresh = Job(
        id="fresh-1",
        user_id=AUTH_USER_ID,
        status="transcribing",
        progress=50,
        created_at=datetime.utcnow() - timedelta(minutes=10),
    )
    db_session.add(fresh)
    db_session.commit()

    sweep_stale_jobs()

    db_session.refresh(old)
    db_session.refresh(fresh)
    assert old.status == "error"
    assert "timeout" in old.error.lower()
    assert fresh.status == "transcribing"


def test_dispatch_failure_cleans_file(auth_client, db_session, tmp_path, monkeypatch):
    import routes.upload as upload_mod

    # Redirect UPLOAD_DIR to tmp_path so we can assert cleanup without
    # polluting backend/uploads and without depending on existing files.
    monkeypatch.setattr(upload_mod, "UPLOAD_DIR", tmp_path)
    # also patch worker.UPLOAD_DIR if needed (worker reads from routes.upload)
    try:
        import worker as worker_mod
        monkeypatch.setattr(worker_mod, "UPLOAD_DIR", tmp_path)
    except Exception:
        pass

    # Make Celery delay raise — simulating Redis/broker down
    def _raise(*a, **kw):
        raise Exception("Redis down")

    monkeypatch.setattr("worker.process_file_job.delay", _raise)

    # Ensure tmp_path starts empty
    assert len(list(tmp_path.iterdir())) == 0

    resp = auth_client.post(
        "/upload/",
        files={"file": ("test.mp4", b"x" * 1024, "video/mp4")},
        data={"title": "t"},
    )
    assert resp.status_code == 500
    detail = resp.json().get("detail", "").lower()
    assert "dispatch" in detail or "retry" in detail

    # File must have been cleaned up
    assert len(list(tmp_path.iterdir())) == 0, f"Expected no files after dispatch failure, found {list(tmp_path.iterdir())}"

    # Job must be marked error with dispatch info
    job = db_session.query(Job).filter(Job.user_id == AUTH_USER_ID).first()
    assert job is not None
    assert job.status == "error"
    assert job.error is not None
    assert "dispatch" in job.error.lower() or "redis" in job.error.lower()
