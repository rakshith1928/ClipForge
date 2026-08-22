"""Regression tests for AUDIT A6: file-upload episodes stored the display
filename, but on-disk files are UUID-named, so /files/{filename} was always
a 404 and playback silently died."""

from pathlib import Path

from database import Episode

from conftest import AUTH_USER_ID

UPLOADS_DIR = Path("uploads")


def _seed_episode(db):
    episode = Episode(
        id="e2e-playback",
        title="Playback Test",
        filename="My Original Podcast.mp4",
        storage_path="e2e-playback.mp4",
        transcript="hello world",
        words=[],
        word_count=2,
        duration=1.0,
        user_id=AUTH_USER_ID,
    )
    db.add(episode)
    db.commit()


def test_analyze_returns_storage_path_separate_from_display_name(auth_client, db_session):
    _seed_episode(db_session)
    resp = auth_client.get("/analyze/e2e-playback")
    assert resp.status_code == 200
    body = resp.json()
    assert body["episode"]["storage_path"] == "e2e-playback.mp4"
    assert body["episode"]["filename"] == "My Original Podcast.mp4"


def test_files_endpoint_serves_storage_path(auth_client, db_session):
    _seed_episode(db_session)
    UPLOADS_DIR.mkdir(exist_ok=True)
    target = UPLOADS_DIR / "e2e-playback.mp4"
    target.write_bytes(b"\x00fake-media\x00")
    try:
        resp = auth_client.get("/files/e2e-playback.mp4")
        assert resp.status_code == 200
        assert b"fake-media" in resp.content
    finally:
        target.unlink(missing_ok=True)


def test_worker_stores_on_disk_basename(db_session):
    """Simulates what process_file_job does when creating the Episode."""
    episode = Episode(
        id="worker-sim",
        title="T",
        filename="Interview Final.mp4",
        storage_path="3f2a9c8e-uuid.mp4",
        transcript="t",
        words=[],
    )
    db_session.add(episode)
    db_session.commit()

    stored = db_session.query(Episode).filter(Episode.id == "worker-sim").first()
    assert stored.filename == "Interview Final.mp4"      # display name
    assert stored.storage_path == "3f2a9c8e-uuid.mp4"    # on-disk name
