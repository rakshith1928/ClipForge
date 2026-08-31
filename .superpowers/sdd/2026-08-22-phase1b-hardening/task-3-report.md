# Task 3 Report: Move Analysis (Groq LLM) to Celery Job (A4, A7)

**Branch:** `feat/phase1b-hardening` (head `8cb0ed5` → `033c063`, base `5d05529`)
**Date:** 2026-08-31
**Author:** OpenCode (Muse Spark)

---

## 1. What was implemented

### 1.1 `backend/tasks/__init__.py` — Create (empty marker)

### 1.2 `backend/tasks/analyze.py` — Celery task with moved Groq logic

Exact code matches brief (with full Groq + content creation moved from `routes/analyze.py`):

```python
import json, os, uuid
from celery_app import celery_app
from database import SessionLocal, Episode, GeneratedContent

@celery_app.task(bind=True, acks_late=True, autoretry_for=(Exception,), retry_backoff=True, max_retries=3, time_limit=120, soft_time_limit=90)
def analyze_episode_task(self, file_id: str, user_id: str):
    db = SessionLocal()
    try:
        episode = db.query(Episode).filter(Episode.id == file_id, Episode.user_id == user_id).first()
        if not episode:
            return
        episode.analysis_status = "pending"
        db.commit()
        # ... full Groq prompt + client.chat.completions.create + JSON parse
        # ... find_timestamp for quotes/clips, save GeneratedContent rows
        # On success: episode.analysis_status = "complete"; db.commit()
        # On failure: _mark_analysis_error -> "error"; raise for autoretry
    finally:
        db.close()
```

Includes:
- `find_timestamp()` and `_mark_analysis_error()` duplicated from route (same logic).
- Prompt verbatim from `routes/analyze.py:86-162` (8 quotes, 5 clips, 2 controversial, viral_score, hook_rewritten, etc.).
- Handles `GROQ_API_KEY` missing -> `error` + return.
- Handles `transcript` empty -> `error` + return.
- `json.JSONDecodeError` and generic `Exception` -> `rollback` + `_mark_analysis_error` + `raise` (triggers `autoretry_for` with `retry_backoff`, max 3).
- `acks_late=True`, `time_limit=120`, `soft_time_limit=90`.

Location: `backend/tasks/analyze.py:1-200+`

### 1.3 `backend/celery_app.py:11` — Include new task

```diff
-    include=["worker"]
+    include=["worker", "tasks.analyze"]
```

### 1.4 `backend/routes/analyze.py:63-74` — POST becomes job dispatch (202)

```python
from tasks.analyze import analyze_episode_task
from database import Episode, GeneratedContent, Job, User, get_db

@router.post("/", status_code=202)
async def analyze_transcript(body: AnalyzeRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    episode = db.query(Episode).filter(Episode.id == body.file_id, Episode.user_id == current_user.id).first()
    if not episode:
        raise HTTPException(status_code=404, detail="Episode not found")
    if not episode.transcript:
        raise HTTPException(status_code=400, detail="Transcript is empty")
    job = Job(id=str(uuid.uuid4()), user_id=current_user.id, status="queued", progress=0)
    db.add(job)
    db.commit()
    analyze_episode_task.delay(body.file_id, current_user.id)
    return {"job_id": job.id, "status": "queued", "analysis_status": "pending"}
```

Behavior:
- Validates `Episode` exists and `transcript` non-empty before queueing (400/404 as before, but now before Celery).
- Creates `Job` row `queued/0` and commits to get `job.id`.
- Dispatches `analyze_episode_task.delay(file_id, user_id)` fire-and-forget (non-blocking).
- Returns `202 {"job_id": str, "status": "queued", "analysis_status": "pending"}` (was `200` with full analysis).

`GET /analyze/{file_id}` unchanged — still polls `analysis_status` (`pending` → `complete`/`error`) and returns `GeneratedContent`.

### 1.5 Tests — `backend/tests/test_analyze_celery.py` (2 tests verbatim)

```python
from unittest.mock import patch
from conftest import AUTH_USER_ID, make_user
from database import Episode, Job

def test_post_analyze_returns_job_id(auth_client, db_session):
    ep = Episode(id="ep-analyze", user_id=AUTH_USER_ID, title="T", filename="f.mp4",
                 transcript="hello world transcript here", words=[], word_count=4)
    db_session.add(ep)
    db_session.commit()
    with patch("routes.analyze.analyze_episode_task.delay") as mock_delay:
        mock_delay.return_value.id = "celery-job-123"
        resp = auth_client.post("/analyze/", json={"file_id": "ep-analyze"})
        assert resp.status_code == 202
        assert "job_id" in resp.json()
        mock_delay.assert_called_once()

def test_post_analyze_requires_episode(auth_client):
    resp = auth_client.post("/analyze/", json={"file_id": "nonexistent"})
    assert resp.status_code == 404
```

Location: `backend/tests/test_analyze_celery.py:1-18`

### 1.6 Updated legacy tests for async contract

- `backend/tests/test_analysis_status.py` — 4 tests updated:
  - `test_get_reports_pending_when_never_analyzed` unchanged.
  - `test_post_marks_episode_complete` now asserts `202` + `pending` + `job_id` + `mock.assert_called_once_with("st-1", AUTH_USER_ID)`, then calls `analyze_episode_task.run("st-1", AUTH_USER_ID)` synchronously (with mocked Groq) and asserts `complete`.
  - `test_post_failure_marks_episode_error` — POST asserts `202` pending, then `run` with `side_effect=RuntimeError("boom")` asserts `error`.
  - `test_missing_groq_key_marks_episode_error` — POST still `202` (no longer 500 sync), then `run` with `delenv GROQ_API_KEY` asserts `error`.
- `backend/tests/test_auth_analyze.py:52-64` — `test_owner_can_read_and_analyze` now mocks `delay`, asserts `202` + `job_id`, then `run` to verify `GeneratedContent` creation.

These updates are required because the synchronous `200`/`500` Groq path no longer exists in the route; the `Job`/`pending` + task `run` preserves the same assertions asynchronously.

---

## 2. TDD Evidence

### RED — Step 2: failing test before implementation

Command: `venv\Scripts\python.exe -m pytest tests/test_analyze_celery.py -v` (workdir `backend/`), before creating `tasks/analyze.py` and before modifying `routes/analyze.py`:

```
============================= test session starts =============================
platform win32 -- Python 3.13.2, pytest-9.1.1, pluggy-1.6.0
rootdir: C:\Users\DELL\podclip\backend
collected 2 items

tests\test_analyze_celery.py F.                                          [100%]

================================== FAILURES ===================================
______________________ test_post_analyze_returns_job_id _______________________
E           AttributeError: module 'routes.analyze' has no attribute 'analyze_episode_task'
=========================== short test summary info ===========================
FAILED tests/test_analyze_celery.py::test_post_analyze_returns_job_id - AttributeError
========================= 1 failed, 1 passed in 0.44s =========================

Second run after file existed but status_code still 200 (before status_code=202 fix):
E           assert 200 == 202
FAILED tests/test_analyze_celery.py::test_post_analyze_returns_job_id
```

Second test `test_post_analyze_requires_episode` already passed (404).

### GREEN — Step 4: passing after implementation

Command: `venv\Scripts\python.exe -m pytest tests/test_analyze_celery.py -v`

```
============================= test session starts =============================
platform win32 -- Python 3.13.2, pytest-9.1.1, pluggy-1.6.0
rootdir: C:\Users\DELL\podclip\backend
collected 2 items

tests\test_analyze_celery.py ..                                          [100%]

============================== 2 passed in 0.22s ==============================
```

Follow-up isolated suite (updated legacy):

`venv\Scripts\python.exe -m pytest tests/test_analysis_status.py tests/test_analyze_celery.py tests/test_auth_analyze.py -v`

```
collected 10 items
tests\test_analysis_status.py ....                                       [ 40%]
tests\test_analyze_celery.py ..                                          [ 60%]
tests\test_auth_analyze.py ....                                          [100%]
============================= 10 passed in 1.13s ==============================
```

### Step 5: Full suite

`venv\Scripts\python.exe -m pytest -v` (workdir `backend/`)

```
============================= test session starts =============================
platform win32 -- Python 3.13.2, pytest-9.1.1, pluggy-1.6.0
rootdir: C:\Users\DELL\podclip\backend
collected 76 items

tests\test_analysis_status.py ....                                       [  5%]
tests\test_analyze_celery.py ..                                          [  7%]
tests\test_api.py ...............                                        [ 27%]
tests\test_auth_analyze.py ....                                          [ 32%]
tests\test_auth_calendar.py ......                                       [ 40%]
tests\test_auth_generate.py .....                                        [ 47%]
tests\test_auth_infra.py ....                                            [ 52%]
tests\test_auth_upload.py .....                                          [ 59%]
tests\test_config.py .......                                             [ 68%]
tests\test_playback_contract.py ...                                      [ 72%]
tests\test_security.py ...........                                       [ 86%]
tests\test_upload_limits.py .....                                        [ 93%]
tests\test_url_validator.py .....                                        [100%]

============================= 76 passed in 5.20s ==============================
```

76 = 74 prior (after Task 2 fix `8cb0ed5`) + 2 new celery tests. No regressions. Earlier full-suite `-q` without legacy updates hung after 120s due to real `delay` attempting Redis at `redis://localhost:6379/0` (no mock) — fixed by updating legacy tests to patch `delay` and by calling `task.run` synchronously.

---

## 3. Files Changed

| File | Action | Lines |
|------|--------|-------|
| `backend/tasks/__init__.py` | Create | 0 (empty) |
| `backend/tasks/analyze.py` | Create | 198 (full Groq logic + `find_timestamp` + `acks_late` + `autoretry` + `time_limit` 120/90) — `tasks/analyze.py:1-198` |
| `backend/celery_app.py` | Modify | 1 line: `include` adds `"tasks.analyze"` — `celery_app.py:11` |
| `backend/routes/analyze.py` | Modify | -281 +58: removed 30-60s blocking `Groq` call, replaced with `Job` creation + `delay` + `202` — `routes/analyze.py:1-14,63-74` |
| `backend/tests/test_analyze_celery.py` | Create | 18 (2 tests verbatim) |
| `backend/tests/test_analysis_status.py` | Modify | +47/-?: updated to `202` + `patch` + `run` for task error/complete |
| `backend/tests/test_auth_analyze.py` | Modify | +13/-?: `202` + `patch` + `run` |

Git diff highlights:

```diff
# celery_app.py
-    include=["worker"]
+    include=["worker", "tasks.analyze"]

# routes/analyze.py
+from tasks.analyze import analyze_episode_task
+from database import Job
-async def analyze_transcript(...): # 250 lines of Groq + DB
+@router.post("/", status_code=202)
+async def analyze_transcript(...):
+    episode = db.query(...).first()
+    if not episode: raise 404
+    if not episode.transcript: raise 400
+    job = Job(id=str(uuid.uuid4()), ...)
+    db.add(job); db.commit()
+    analyze_episode_task.delay(body.file_id, current_user.id)
+    return {"job_id": job.id, "status": "queued", "analysis_status": "pending"}

# tasks/analyze.py
+@celery_app.task(bind=True, acks_late=True, autoretry_for=(Exception,), retry_backoff=True, max_retries=3, time_limit=120, soft_time_limit=90)
+def analyze_episode_task(self, file_id, user_id): # moved prompt + content creation
```

---

## 4. Self-Review

**Correctness:**
- `POST /analyze` now non-blocking: no `client.chat.completions.create` inside `async def`, no `await` blocking event loop. Returns `202` immediately with `job_id`. Verified via `test_post_analyze_returns_job_id` (`202` + `mock_delay.assert_called_once()`).
- `Job` row created with `queued/0` before dispatch, so frontend can poll via existing `Job`/`analysis_status` (unchanged `GET /analyze/{file_id}` still returns `pending` → `complete`/`error`).
- Task `analyze_episode_task` correctly reuses `SessionLocal()` (new DB session per worker, not request `db`), sets `pending`, commits, then Groq, then `complete`/`error`. Matches brief’s `acks_late` + `autoretry` + `time_limit`.
- `autoretry_for=(Exception,)` + `retry_backoff=True` + `max_retries=3` will retry transient Groq/DB failures; `acks_late=True` ensures message re-queued if worker dies before ack.
- `Episode` lookup scoped to `user_id` (prevents IDOR).
- `transcript` empty and `GROQ_API_KEY` missing now handled inside task (marks `error`, returns) rather than raising `500` in route — legacy tests updated to reflect this async error propagation via `run`.

**TDD compliance:** RED (AttributeError / 200!=202) → GREEN (2 pass) → full suite (76 pass), as required.

**Discrepancy found and resolved:**
- Brief’s snippet omits `status_code=202` in decorator — without it FastAPI returns `200` and brief’s test fails (`assert 200 == 202`). Added `status_code=202` to ` @router.post("/", status_code=202)` to satisfy `202` contract.
- `tasks/analyze.py` snippet is abbreviated (`# ... existing Groq logic ...`) — implemented full verbatim copy from `routes/analyze.py:86-325` (prompt, markdown strip, `find_timestamp`, `GeneratedContent` creation for clips/quotes/twitter/linkedin/instagram). Also fixed duplicate `user_id` kwarg in instagram block that would have caused `SyntaxError: keyword argument repeated`.
- Brief’s full-suite expectation `76` would fail without updating legacy `test_analysis_status.py`/`test_auth_analyze.py` (they previously asserted `200`/`500` synchronous). Updated to `202` + `patch` + `task.run` to keep 74+2=76 passing and avoid real Redis calls hanging the suite (observed 120s timeout before fix).
- `celery_app` `include` must list `"tasks.analyze"` or worker never imports task — added.

**Style/Risk:**
- No `.env` committed.
- `import json`/`os` kept in `routes/analyze.py` (json still needed for GET, os now unused but harmless; could be removed).
- Task uses `SessionLocal()` per invocation, correctly `close()` in `finally`.

---

## 5. Concerns

- **Redis required in prod but not in tests:** Task `delay` hits `redis://localhost:6379/0`. In CI/tests we mock `delay`, but if a test forgets to mock it will hang/timeout trying to connect to Redis (observed 120s). Recommend adding global `autouse` fixture in `conftest.py` that patches `tasks.analyze.analyze_episode_task.delay` or sets `celery_app.conf.task_always_eager=True` for test suite.
- **`Exception` autoretry too broad:** `autoretry_for=(Exception,)` will retry even on `Groq` JSON parsing errors or missing `GROQ_API_KEY` (which are non-transient). Combined with `retry_backoff` and `max_retries=3`, a malformed prompt could retry 3 times wasting 120s each. Consider narrowing to `httpx.TimeoutException`/`groq.APIError` or handling `JSONDecodeError` without `raise`.
- **Duplicate logic:** `find_timestamp` and `_mark_analysis_error` now duplicated in `routes/analyze.py` and `tasks/analyze.py`. Recommend extracting to `utils/analysis.py` to avoid drift.
- **`Job` orphan on task failure:** `POST` creates `Job` `queued` but task never updates `Job` status — only `Episode.analysis_status`. Frontend polling `Job` status will stay `queued` forever while `Episode` is `error`. Recommend updating `Job` to `done`/`error` inside task (similar to `worker.py`).
- **No frontend polling update yet:** Task queues correctly, but upload page’s fire-and-forget `fetch("/analyze")` still not polling `GET /analyze/{file_id}` for `pending`→`complete`. Need frontend change to poll or websocket.
- **Analysis idempotency:** Multiple `POST /analyze` for same `file_id` create multiple `Job` rows and multiple concurrent tasks that race on same `Episode`/`GeneratedContent`. No deduplication or `pending`-check guard. Recommend guard: if `analysis_status=="pending"` reuse existing `Job` or return `409`.

---

**Commit:** `feat: move Groq analysis to Celery job to unblock event loop (A4)` (`033c063`)
**Report path:** `C:\Users\DELL\podclip\.superpowers\sdd\2026-08-22-phase1b-hardening\task-3-report.md`
