import os

# Use an isolated sqlite database so the suite runs without Postgres.
os.environ["DATABASE_URL"] = "sqlite:////tmp/clipforge_smoke.db"

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from database import Base, get_db
import main  # triggers init_db() on the sqlite engine

engine = create_engine(
    "sqlite:////tmp/clipforge_smoke.db", connect_args={"check_same_thread": False}
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base.metadata.create_all(bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


main.app.dependency_overrides[get_db] = override_get_db

client = TestClient(main.app)


def test_health_ok():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_unknown_analysis_returns_404():
    # Does not call Groq — only checks the DB for the episode.
    r = client.get("/analyze/does-not-exist")
    assert r.status_code == 404


def test_calendar_episodes_empty():
    r = client.get("/calendar/episodes")
    assert r.status_code == 200
    assert r.json()["data"]["episodes"] == []


def test_schedule_missing_episode_returns_404():
    r = client.post(
        "/calendar/schedule",
        json={"episode_id": "missing", "start_date": "2026-01-01"},
    )
    assert r.status_code == 404
