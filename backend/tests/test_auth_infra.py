"""Infrastructure checks for the authenticated test client used by A1 tests."""

from database import User

from conftest import AUTH_USER_ID, bearer_for, make_user


def test_make_user_creates_resolvable_user(db_session):
    user = make_user(db_session)
    stored = db_session.query(User).filter(User.id == AUTH_USER_ID).first()
    assert stored is not None
    assert stored.email == f"{AUTH_USER_ID}@example.com"


def test_make_user_is_idempotent(db_session):
    first = make_user(db_session)
    second = make_user(db_session)
    assert first.id == second.id


def test_bearer_for_produces_working_token(client, db_session):
    make_user(db_session)
    resp = client.get("/auth/me", headers=bearer_for(AUTH_USER_ID))
    assert resp.status_code == 200
    assert resp.json()["id"] == AUTH_USER_ID


def test_unauthenticated_me_returns_401(client):
    resp = client.get("/auth/me")
    assert resp.status_code == 401
