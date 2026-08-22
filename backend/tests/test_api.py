import sys
import types
import uuid

import pytest

from database import Episode, GeneratedContent

# Content types that the calendar knows how to schedule.
SCHEDULABLE_TYPES = ["clip", "quote", "twitter_thread", "linkedin", "instagram"]


def _seed_episode(db_session, content_types):
    """Create an episode plus one GeneratedContent row per given content type."""
    episode_id = f"ep-{uuid.uuid4().hex[:12]}"
    db_session.add(Episode(id=episode_id, filename="x.mp4", transcript="t", words=[]))
    for content_type in content_types:
        db_session.add(
            GeneratedContent(
                id=str(uuid.uuid4()),
                episode_id=episode_id,
                content_type=content_type,
                title=f"{content_type} title",
                body=f"{content_type} body",
                content_metadata={"viral_score": 8},
            )
        )
    db_session.commit()
    return episode_id


def test_health_ok(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_unknown_analysis_returns_404(auth_client):
    # Does not call Groq — only checks the DB for the episode.
    r = auth_client.get("/analyze/does-not-exist")
    assert r.status_code == 404


def test_calendar_episodes_empty(client):
    r = client.get("/calendar/episodes")
    assert r.status_code == 200
    assert r.json()["data"]["episodes"] == []


def test_schedule_missing_episode_returns_404(client):
    r = client.post(
        "/calendar/schedule",
        json={"episode_id": "missing", "start_date": "2026-01-01"},
    )
    assert r.status_code == 404


def test_schedule_no_content_returns_404(client, db_session):
    episode_id = _seed_episode(db_session, [])
    r = client.post(
        "/calendar/schedule",
        json={"episode_id": episode_id, "start_date": "2026-01-01"},
    )
    assert r.status_code == 404
    assert "No content found" in r.json()["detail"]


def test_schedule_no_schedulable_content_returns_400(client, db_session):
    # Regression test for the ZeroDivisionError raised when an episode has
    # only non-schedulable content types (e.g. clip_file / quote_card).
    episode_id = _seed_episode(db_session, ["clip_file", "quote_card"])
    r = client.post(
        "/calendar/schedule",
        json={"episode_id": episode_id, "start_date": "2026-01-01"},
    )
    assert r.status_code == 400
    assert "No schedulable content" in r.json()["detail"]


@pytest.mark.parametrize("content_type", SCHEDULABLE_TYPES)
def test_schedule_single_content_type_succeeds(client, db_session, content_type):
    """Regression test: a lone content type must not blow up with a 500.

    Each platform branch used to fall back to `quotes`, so an episode with only
    clips (or only threads, ...) raised ZeroDivisionError on `x[i % 0]`.
    """
    episode_id = _seed_episode(db_session, [content_type])

    r = client.post(
        "/calendar/schedule",
        json={"episode_id": episode_id, "start_date": "2026-01-01"},
    )
    assert r.status_code == 200, r.text
    assert r.json()["data"]["scheduled_count"] > 30

    posts = client.get(f"/calendar/posts/{episode_id}")
    assert posts.status_code == 200
    scheduled = posts.json()["data"]["posts"]
    assert len(scheduled) == r.json()["data"]["scheduled_count"]
    assert {p["content_type"] for p in scheduled} == {content_type}


def test_schedule_mixed_content_and_reschedule(client, db_session):
    """Scheduling twice must not duplicate posts (old ones are replaced)."""
    episode_id = _seed_episode(db_session, ["clip", "quote", "twitter_thread"])
    payload = {"episode_id": episode_id, "start_date": "2026-01-01"}

    first = client.post("/calendar/schedule", json=payload)
    assert first.status_code == 200, first.text

    second = client.post("/calendar/schedule", json=payload)
    assert second.status_code == 200, second.text
    assert second.json()["data"]["scheduled_count"] == first.json()["data"]["scheduled_count"]

    posts = client.get(f"/calendar/posts/{episode_id}").json()["data"]["posts"]
    assert len(posts) == first.json()["data"]["scheduled_count"]


def test_update_post_status_roundtrip(client, db_session):
    episode_id = _seed_episode(db_session, ["clip"])
    assert (
        client.post(
            "/calendar/schedule",
            json={"episode_id": episode_id, "start_date": "2026-01-01"},
        ).status_code
        == 200
    )

    post_id = client.get(f"/calendar/posts/{episode_id}").json()["data"]["posts"][0]["id"]

    ok = client.patch(f"/calendar/posts/{post_id}/status", params={"status": "posted"})
    assert ok.status_code == 200
    assert ok.json()["data"]["status"] == "posted"

    bad = client.patch(f"/calendar/posts/{post_id}/status", params={"status": "nope"})
    assert bad.status_code == 400


def test_job_status_unknown_returns_404(auth_client):
    r = auth_client.get("/upload/status/does-not-exist")
    assert r.status_code == 404


def test_upload_from_url_uses_lazily_imported_ytdlp(auth_client, monkeypatch):
    """Regression test: `fetch_info` must import yt_dlp itself.

    yt_dlp is imported lazily inside the helpers, so referencing the (missing)
    module-level name raised NameError which the broad `except Exception` turned
    into a misleading "Invalid URL" 400. Reaching the duration check proves the
    metadata lookup really ran.
    """

    class FakeYoutubeDL:
        def __init__(self, opts):
            self.opts = opts

        def __enter__(self):
            return self

        def __exit__(self, *exc_info):
            return False

        def extract_info(self, url, download=False):
            return {"duration": 7200, "title": "Way too long"}

    fake_module = types.ModuleType("yt_dlp")
    fake_module.YoutubeDL = FakeYoutubeDL
    monkeypatch.setitem(sys.modules, "yt_dlp", fake_module)

    r = auth_client.post("/upload/url", json={"url": "https://example.com/video", "title": "t"})
    assert r.status_code == 400
    assert "1 hour maximum duration limit" in r.json()["detail"]
