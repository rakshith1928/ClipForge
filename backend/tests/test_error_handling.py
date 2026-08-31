"""Task 7: Structured logging & generic error responses (B3, C6).

Two tests:
1. duplicate register -> 409 generic, no SQL leak
2. analyze / generic error does not leak /home/app path (adapted for Celery async dispatch)
"""
from unittest.mock import patch

from conftest import AUTH_USER_ID, make_user
from database import Episode


def test_register_duplicate_returns_generic(auth_client, monkeypatch):
    # Workaround bcrypt+passlib incompatibility in test env (bcrypt 4.x)
    monkeypatch.setattr("auth.hash_password", lambda p: "fakehash_" + p)
    payload = {"name": "Test", "email": "dup@example.com", "password": "Test123!@#"}
    # first register succeeds (or 409 if left from previous but clean_tables clears)
    first = auth_client.post("/auth/register", json=payload)
    assert first.status_code in (200, 201, 409), first.text
    resp = auth_client.post("/auth/register", json=payload)
    assert resp.status_code == 409, resp.text
    detail = resp.json()["detail"].lower()
    assert "sql" not in detail
    assert "already registered" in detail
    assert "/home/app" not in detail


def test_analyze_error_generic(auth_client, db_session, monkeypatch):
    """Verify generic error without leaking absolute path.

    After Task 3, POST /analyze is async Celery dispatch (202). The leaked
    path test cannot target the route's Groq call directly, so we:
    - create an episode,
    - verify dispatch failure is generic (patch delay to raise leaked path),
    - verify Celery task failure does not leak via API (patch Groq, run task sync).
    """
    ep = Episode(
        id="ep-err",
        user_id=AUTH_USER_ID,
        title="T",
        filename="f.mp4",
        transcript="hello world transcript here",
        words=[],
        word_count=4,
    )
    db_session.add(ep)
    db_session.commit()

    # Ensure user exists
    make_user(db_session)

    monkeypatch.setenv("GROQ_API_KEY", "test")

    # Part A: dispatch failure must be generic, not leak /home/app
    with patch("routes.analyze.analyze_episode_task.delay", side_effect=RuntimeError("/home/app/secrets leaked path")):
        resp = auth_client.post("/analyze/", json={"file_id": "ep-err"})
        # After fix this should be 500 generic, not 202 and not leak
        assert resp.status_code == 500, resp.text
        detail = resp.json()["detail"]
        assert "/home/app" not in detail
        assert "sql" not in detail.lower()

    # Part B: Celery task Groq failure must not leak via subsequent GET
    # Patch Groq inside tasks.analyze
    class FakeGroq:
        def __init__(self, api_key):
            pass

        class chat:
            class completions:
                @staticmethod
                def create(**kw):
                    raise RuntimeError("/home/app/secrets leaked path")

    # tasks.analyze imports Groq lazily inside function, so patch groq.Groq
    monkeypatch.setattr("groq.Groq", FakeGroq)

    from tasks.analyze import analyze_episode_task

    # Run task synchronously (bypass Celery broker)
    try:
        analyze_episode_task.apply(args=["ep-err", AUTH_USER_ID]).get()
    except Exception:
        pass

    db_session.expire_all()
    refreshed = db_session.query(Episode).filter(Episode.id == "ep-err").first()
    assert refreshed is not None
    assert refreshed.analysis_status == "error"

    # GET analysis should not leak path
    get_resp = auth_client.get(f"/analyze/ep-err")
    assert get_resp.status_code == 200
    assert "/home/app" not in get_resp.text
    assert "secrets" not in get_resp.text
