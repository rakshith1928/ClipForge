# ClipForge Backend

FastAPI service that turns long podcast/video audio into viral short-form content.

## Setup

1. `pip install -r requirements.txt`
2. Copy `backend/.env.example` to `backend/.env` and fill in your secrets.
3. Start Postgres and Redis (e.g. via Docker).
4. Run the API: `uvicorn main:app --reload`
5. Run the worker: `celery -A celery_app.celery_app worker --loglevel=info`

## Required environment variables

See `.env.example`. At minimum you need:

- `GROQ_API_KEY` — powers transcript analysis (see `routes/analyze.py`)
- `DEEPGRAM_API_KEY` — powers transcription (see `routes/upload.py`)
- `DATABASE_URL` and `REDIS_URL` — Postgres + Celery broker

## Tests and lint

```bash
pip install -r requirements-dev.txt
pytest        # runs against a throw-away SQLite file, no Postgres/Redis needed
ruff check .
```

The suite creates a fresh temporary database per session (see `tests/conftest.py`)
and clears the tables before each test, so runs are isolated and repeatable.
