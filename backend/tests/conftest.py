"""Shared pytest fixtures.

Every test session gets its own throw-away SQLite file (created with
``tempfile.mkstemp`` and deleted again when the session ends) so the suite never
touches a developer's real database and never depends on state left behind by a
previous run. Tables are also emptied before each test, which makes the
assertions order-independent and the whole suite idempotent.
"""

import os
import tempfile

import pytest

# The DATABASE_URL must be set *before* `database`/`main` are imported, because
# the SQLAlchemy engine is created at import time.
_DB_FD, _DB_PATH = tempfile.mkstemp(prefix="clipforge_test_", suffix=".db")
os.close(_DB_FD)
os.environ["DATABASE_URL"] = f"sqlite:///{_DB_PATH}"

from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402

import main  # noqa: E402  — importing main runs init_db() against the temp DB
from database import Base, get_db  # noqa: E402

# check_same_thread=False: TestClient serves requests on a different thread.
test_engine = create_engine(f"sqlite:///{_DB_PATH}", connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)
Base.metadata.create_all(bind=test_engine)


def _override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


main.app.dependency_overrides[get_db] = _override_get_db


@pytest.fixture(scope="session", autouse=True)
def _temp_database():
    """Drop the temporary SQLite file (and its journals) when the session ends."""
    yield
    main.app.dependency_overrides.pop(get_db, None)
    test_engine.dispose()
    for suffix in ("", "-wal", "-shm", "-journal"):
        try:
            os.remove(_DB_PATH + suffix)
        except OSError:
            pass


@pytest.fixture(autouse=True)
def clean_tables():
    """Start every test from an empty database."""
    with test_engine.begin() as conn:
        for table in reversed(Base.metadata.sorted_tables):
            conn.execute(table.delete())
    yield


@pytest.fixture
def client():
    with TestClient(main.app) as test_client:
        yield test_client


@pytest.fixture
def db_session():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


# ── Auth helpers (A1) ─────────────────────────────────────────────────────────

AUTH_USER_ID = "auth-test-user"


def make_user(db_session, user_id: str = AUTH_USER_ID):
    """Create (or reuse) a User row so JWT dependencies can resolve it."""
    from database import User

    user = db_session.query(User).filter(User.id == user_id).first()
    if not user:
        user = User(
            id=user_id,
            email=f"{user_id}@example.com",
            name="Test User",
            hashed_password=None,
            provider="local",
        )
        db_session.add(user)
        db_session.commit()
    return user


def bearer_for(user_id: str) -> dict:
    from auth import create_access_token

    return {"Authorization": f"Bearer {create_access_token(user_id)}"}


@pytest.fixture
def auth_client(client, db_session):
    """TestClient pre-configured with a valid Bearer token for AUTH_USER_ID."""
    make_user(db_session)
    client.headers.update(bearer_for(AUTH_USER_ID))
    yield client
    client.headers.pop("Authorization", None)
