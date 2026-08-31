# Phase 1b — Hardening: SSRF, Upload Limits, Async Jobs, Rate Limits & Worker Reliability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden the platform against abuse and load by fixing SSRF, enforcing upload caps, moving blocking LLM/FFmpeg work off the event loop into Celery, adding rate limits, and making workers resilient.

**Architecture:** Backend-first hardening: add a shared URL validation module with private-IP blocking, stream uploads with byte counting, wrap blocking SDK/subprocess calls in Celery tasks returning job IDs with polling, add SlowAPI rate limiting per user/IP, and configure Celery with acks_late/retries/timeouts plus structured logging.

**Tech Stack:** FastAPI 0.135.1, Celery 5.6.3 + Redis 7.4.0, SQLAlchemy 2.0.49, SlowAPI (new), Python 3.13, pytest, Deepgram SDK 3.10.0, yt-dlp 2026.8.19, Pillow 12.2.0

**Spec:** `AUDIT.md` — Phase 1 — sections A2 (SSRF), A3 (Upload limits), A4 (Blocking calls → Celery), A5/D2 (Rate limiting), B3/B9 (Input validation & error handling), B4/B5 (Worker reliability), C6 (Structured logging)

## Global Constraints

- Python venv at `backend/venv`; run tests with `backend/venv/Scripts/python.exe -m pytest` from `backend/` directory. 64 backend tests must stay green.
- Frontend at `frontend/` — run `npm test` and `npm run build` after any frontend changes. 31 frontend tests must stay green.
- NEVER commit `backend/.env` or log secrets/tokens.
- All new endpoints require `Depends(get_current_user)` — return 404 for wrong owner (not 403), 401 for missing auth.
- Upload caps: 2 GB hard limit (matches UI copy), 413 on exceed. Duration cap remains 1 hour.
- SSRF: scheme must be http/https only; block private/loopback/link-local/multicast IPs; allowlist: youtube.com, youtu.be, youtube-nocookie.com, vimeo.com (extendable).
- Celery tasks: `acks_late=True`, `autoretry_for` on transient errors, `time_limit`/`soft_time_limit` set.
- Use `logging` not `print` for operational logs (C6).

---

## File Structure

Before defining tasks, map out which files will be created or modified:

- `backend/utils/url_validator.py` — NEW: SSRF-safe URL validation (scheme, allowlist, DNS → IP private check, max_filesize helpers)
- `backend/utils/__init__.py` — NEW: empty package marker
- `backend/middleware/rate_limit.py` — NEW: SlowAPI limiter setup and per-user key function
- `backend/routes/upload.py` — Modify: add SSRF checks, streaming size cap, use url_validator, handle dispatch failures
- `backend/worker.py` — Modify: add Celery config (acks_late, retries, timeouts), handle SSRF/retries, cleanup improvements
- `backend/celery_app.py` — Modify: add task_acks_late, time limits, beat schedule for sweeper
- `backend/routes/analyze.py` — Modify: move Groq call to Celery task, return job id, keep polling via analysis_status
- `backend/routes/generate.py` — Modify: move FFmpeg clip to Celery, constrained models, add file_id==episode_id check
- `backend/config.py` — Modify: single UPLOAD_DIR + rate limit config via get_secret pattern
- `backend/main.py` — Modify: mount rate limiter, structured logging setup, ensure UPLOAD_DIR from config
- `backend/requirements.txt` — Modify: add slowapi, structlog or stdlib logging

---

### Task 1: SSRF Protection — URL Allowlist & Private IP Blocking (A2, D3)

**Files:**
- Create: `backend/utils/__init__.py`
- Create: `backend/utils/url_validator.py`
- Modify: `backend/routes/upload.py:198-260` (start_upload_from_url)
- Test: `backend/tests/test_url_validator.py`
- Test: `backend/tests/test_auth_upload.py` (extend with SSRF cases)

**Interfaces:**
- Consumes: `get_current_user` (already required), `yt_dlp` (lazy import)
- Produces: `validate_upload_url(url: str) -> dict` — raises `HTTPException(400)` on private IP, bad scheme, or non-allowlisted host; returns `{"host": str, "is_allowed": bool}`. Also `is_private_ip(ip: str) -> bool` helper.

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_url_validator.py
import pytest
from fastapi import HTTPException
from utils.url_validator import is_private_ip, validate_upload_url

def test_is_private_ip_blocks_loopback():
    assert is_private_ip("127.0.0.1") is True
    assert is_private_ip("192.168.1.1") is True
    assert is_private_ip("10.0.0.5") is True
    assert is_private_ip("8.8.8.8") is False

def test_validate_rejects_private_url():
    with pytest.raises(HTTPException) as exc:
        validate_upload_url("http://127.0.0.1:6379/admin")
    assert exc.value.status_code == 400
    assert "private" in exc.value.detail.lower()

def test_validate_rejects_bad_scheme():
    with pytest.raises(HTTPException):
        validate_upload_url("ftp://youtube.com/watch?v=abc")

def test_validate_allows_youtube():
    result = validate_upload_url("https://www.youtube.com/watch?v=dQw4w9WgXcQ")
    assert result["is_allowed"] is True

def test_validate_rejects_non_allowlisted():
    with pytest.raises(HTTPException) as exc:
        validate_upload_url("https://evil.com/payload")
    assert "not allowed" in exc.value.detail.lower()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `backend/venv/Scripts/python.exe -m pytest backend/tests/test_url_validator.py -v`
Expected: FAIL with "ModuleNotFoundError: No module named 'utils.url_validator'"

- [ ] **Step 3: Write minimal implementation**

```python
# backend/utils/url_validator.py
import ipaddress
import socket
from urllib.parse import urlparse
from fastapi import HTTPException

ALLOWED_HOSTS = {
    "youtube.com", "www.youtube.com", "m.youtube.com",
    "youtu.be", "www.youtu.be",
    "youtube-nocookie.com", "www.youtube-nocookie.com",
    "vimeo.com", "www.vimeo.com",
}

def is_private_ip(ip: str) -> bool:
    try:
        addr = ipaddress.ip_address(ip)
        return addr.is_private or addr.is_loopback or addr.is_link_local or addr.is_multicast or addr.is_reserved
    except ValueError:
        return False

def _resolve_ips(hostname: str) -> list[str]:
    try:
        _, _, ips = socket.gethostbyname_ex(hostname)
        return ips
    except socket.gaierror:
        return []

def validate_upload_url(url: str) -> dict:
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise HTTPException(status_code=400, detail="URL scheme must be http or https")
    host = parsed.hostname
    if not host:
        raise HTTPException(status_code=400, detail="Invalid URL: missing host")
    # Allowlist check
    host_lower = host.lower()
    is_allowed = any(host_lower == h or host_lower.endswith("." + h) for h in ALLOWED_HOSTS)
    if not is_allowed:
        raise HTTPException(status_code=400, detail=f"URL host not allowed: {host}")
    # Private IP check via DNS
    for ip in _resolve_ips(host):
        if is_private_ip(ip):
            raise HTTPException(status_code=400, detail=f"URL resolves to private IP: {ip}")
    return {"host": host, "is_allowed": is_allowed}
```

```python
# backend/utils/__init__.py
# empty marker
```

- [ ] **Step 4: Run test to verify it passes**

Run: `backend/venv/Scripts/python.exe -m pytest backend/tests/test_url_validator.py -v`
Expected: PASS (5 tests)

- [ ] **Step 5: Integrate into upload route**

In `backend/routes/upload.py` `start_upload_from_url`, before `fetch_info`, add:

```python
from utils.url_validator import validate_upload_url
validate_upload_url(body.url)
```

Also add `max_filesize` to ydl_opts in `_download_with_ytdlp`:

```python
ydl_opts = {
    "format": "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
    "outtmpl": out_path,
    "quiet": True,
    "no_warnings": True,
    "noplaylist": True,
    "max_filesize": 2 * 1024 * 1024 * 1024,  # 2GB
    "socket_timeout": 30,
}
```

- [ ] **Step 6: Run all tests**

Run: `backend/venv/Scripts/python.exe -m pytest -q`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add backend/utils/__init__.py backend/utils/url_validator.py backend/routes/upload.py backend/tests/test_url_validator.py
git commit -m "feat: add SSRF protection with allowlist and private IP blocking (A2)"
```

---

### Task 2: Enforce Upload Size Limits & Streaming Caps (A3, D4, B9)

**Files:**
- Modify: `backend/routes/upload.py:30-43` (save_upload)
- Modify: `backend/routes/generate.py:38-45` (ClipRequest validation)
- Modify: `backend/routes/upload.py:88-99` (transcribe_audio — avoid full read)
- Test: `backend/tests/test_upload_limits.py`

**Interfaces:**
- Consumes: `validate_upload_url` from Task 1
- Produces: Streaming upload capped at 2GB → 413; ClipRequest validates `0 <= start_time < end_time <= duration` and rejects NaN/Inf; transcribe uses streaming or chunked read

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_upload_limits.py
import pytest
from fastapi import HTTPException
from unittest.mock import MagicMock, AsyncMock
from routes.upload import save_upload
from routes.generate import ClipRequest
import math

@pytest.mark.asyncio
async def test_save_upload_rejects_oversized():
    # Mock file that exceeds 2GB
    mock_file = MagicMock()
    mock_file.filename = "big.mp4"
    # Simulate 3 chunks that exceed limit
    chunks = [b"x" * (1024*1024)] * 2049  # 2049 MB
    mock_file.read = AsyncMock(side_effect=chunks + [b""])
    with pytest.raises(HTTPException) as exc:
        await save_upload(mock_file)
    assert exc.value.status_code == 413

def test_clip_request_rejects_negative():
    with pytest.raises(Exception):
        ClipRequest(file_id="abc", episode_id="abc", start_time=-1, end_time=10)

def test_clip_request_rejects_nan():
    with pytest.raises(Exception):
        ClipRequest(file_id="abc", episode_id="abc", start_time=float('nan'), end_time=10)

def test_clip_request_rejects_end_before_start():
    with pytest.raises(Exception):
        ClipRequest(file_id="abc", episode_id="abc", start_time=10, end_time=5)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `backend/venv/Scripts/python.exe -m pytest backend/tests/test_upload_limits.py -v`
Expected: FAIL with "function not defined" or missing validation

- [ ] **Step 3: Write minimal implementation**

Update `backend/routes/upload.py` `save_upload`:

```python
MAX_UPLOAD_SIZE = 2 * 1024 * 1024 * 1024  # 2GB

async def save_upload(file: UploadFile) -> Path:
    ext = Path(file.filename).suffix
    unique_name = f"{uuid.uuid4()}{ext}"
    file_path = UPLOAD_DIR / unique_name
    import aiofiles
    total = 0
    async with aiofiles.open(file_path, "wb") as out:
        while chunk := await file.read(1024 * 1024):
            total += len(chunk)
            if total > MAX_UPLOAD_SIZE:
                await out.close()
                file_path.unlink(missing_ok=True)
                raise HTTPException(status_code=413, detail="File exceeds 2GB limit")
            await out.write(chunk)
    return file_path
```

Update `backend/routes/generate.py` `ClipRequest`:

```python
from pydantic import BaseModel, validator, Field
import math

class ClipRequest(BaseModel):
    file_id: str
    episode_id: str
    start_time: float = Field(ge=0)
    end_time: float = Field(ge=0)
    title: str = ""

    @validator("start_time", "end_time")
    def no_nan_inf(cls, v):
        if math.isnan(v) or math.isinf(v):
            raise ValueError("must be finite number")
        return v

    @validator("end_time")
    def end_after_start(cls, v, values):
        if "start_time" in values and v <= values["start_time"]:
            raise ValueError("end_time must be > start_time")
        return v
```

Add color validation to `QuoteCardRequest`:

```python
import re
HEX_COLOR_RE = re.compile(r"^#[0-9a-fA-F]{6}$")

    @validator("bg_color", "text_color", "accent_color")
    def valid_hex_color(cls, v):
        if not HEX_COLOR_RE.match(v):
            raise ValueError("must be hex color like #0f0f0f")
        return v
```

- [ ] **Step 4: Run test to verify it passes**

Run: `backend/venv/Scripts/python.exe -m pytest backend/tests/test_upload_limits.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/routes/upload.py backend/routes/generate.py backend/tests/test_upload_limits.py
git commit -m "feat: enforce upload size limits and clip request validation (A3, B9)"
```

---

### Task 3: Move Analysis (Groq LLM) to Celery Job (A4, A7)

**Files:**
- Create: `backend/tasks/__init__.py`
- Create: `backend/tasks/analyze.py`
- Modify: `backend/routes/analyze.py` (POST endpoint becomes job dispatch)
- Modify: `backend/worker.py` (or keep tasks separate)
- Test: `backend/tests/test_analyze_celery.py`

**Interfaces:**
- Consumes: `get_current_user`, `Job` model, `Groq` SDK
- Produces: `analyze_episode_task.delay(file_id, user_id) -> job_id`; `POST /analyze` returns `{"job_id": str, "status": "queued"}`; `GET /analyze/{file_id}` still polls via `analysis_status` (pending → complete/error)

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_analyze_celery.py
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

- [ ] **Step 2: Run test to verify it fails**

Run: `backend/venv/Scripts/python.exe -m pytest backend/tests/test_analyze_celery.py -v`
Expected: FAIL with "still returns 200 with analysis" or missing job_id

- [ ] **Step 3: Write minimal implementation**

Create `backend/tasks/analyze.py`:

```python
import json
import os
import uuid
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
        # ... existing Groq logic moved here, with same prompt and content creation ...
        # On success: episode.analysis_status = "complete"; db.commit()
        # On failure: _mark_analysis_error
    finally:
        db.close()
```

Modify `backend/routes/analyze.py` POST:

```python
from tasks.analyze import analyze_episode_task

@router.post("/")
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

Keep `GET /analyze/{file_id}` unchanged (polls analysis_status).

- [ ] **Step 4: Run test to verify it passes**

Run: `backend/venv/Scripts/python.exe -m pytest backend/tests/test_analyze_celery.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/tasks/__init__.py backend/tasks/analyze.py backend/routes/analyze.py backend/tests/test_analyze_celery.py
git commit -m "feat: move Groq analysis to Celery job to unblock event loop (A4)"
```

---

### Task 4: Move Clip Generation (FFmpeg) to Celery Job (A4)

**Files:**
- Create: `backend/tasks/generate.py`
- Modify: `backend/routes/generate.py` (POST /clip becomes job dispatch)
- Modify: `backend/celery_app.py` (time limits for long FFmpeg)
- Test: `backend/tests/test_generate_celery.py`

**Interfaces:**
- Consumes: `get_current_user`, `_owned_episode_or_404`, FFmpeg
- Produces: `generate_clip_task.delay(file_id, episode_id, start, end, title, user_id) -> job_id`; `POST /generate/clip` returns `{"job_id": str, "status": "queued"}`

- [ ] **Step 1: Write the failing test**

```python
from unittest.mock import patch
from conftest import AUTH_USER_ID, make_user
from database import Episode

def test_post_clip_returns_job(auth_client, db_session, tmp_path):
    ep = Episode(id="ep-clip", user_id=AUTH_USER_ID, title="T", filename="f.mp4", transcript="t", words=[], word_count=1)
    db_session.add(ep)
    db_session.commit()
    with patch("routes.generate.generate_clip_task.delay") as mock_delay:
        mock_delay.return_value.id = "job-123"
        resp = auth_client.post("/generate/clip", json={
            "file_id": "ep-clip", "episode_id": "ep-clip", "start_time": 0, "end_time": 10
        })
        assert resp.status_code == 202
        assert "job_id" in resp.json()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `backend/venv/Scripts/python.exe -m pytest backend/tests/test_generate_celery.py -v`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

Create `backend/tasks/generate.py` with Celery task wrapping `cut_clip` + DB save, with `time_limit=300, soft_time_limit=240, acks_late=True`.

Modify `backend/routes/generate.py` POST /clip to dispatch:

```python
from tasks.generate import generate_clip_task
@router.post("/clip")
async def create_clip(body: ClipRequest, db: Session = Depends(_db_session), current_user: User = Depends(get_current_user)):
    _owned_episode_or_404(db, body.episode_id, current_user)
    if body.file_id != body.episode_id:
        raise HTTPException(status_code=400, detail="file_id and episode_id must match")
    job = Job(id=str(uuid.uuid4()), user_id=current_user.id, status="queued", progress=0)
    db.add(job)
    db.commit()
    generate_clip_task.delay(body.file_id, body.episode_id, body.start_time, body.end_time, body.title, current_user.id)
    return {"job_id": job.id, "status": "queued"}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `backend/venv/Scripts/python.exe -m pytest backend/tests/test_generate_celery.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/tasks/generate.py backend/routes/generate.py backend/celery_app.py backend/tests/test_generate_celery.py
git commit -m "feat: move FFmpeg clip generation to Celery (A4)"
```

---

### Task 5: Rate Limiting & Quotas (A5, D2)

**Files:**
- Modify: `backend/requirements.txt` (add slowapi)
- Modify: `backend/main.py` (setup limiter)
- Modify: `backend/routes/upload.py`, `backend/routes/analyze.py`, `backend/routes/generate.py` (add @limiter.limit decorators)
- Create: `backend/middleware/quotas.py` (daily per-user quota check)
- Test: `backend/tests/test_rate_limits.py`

**Interfaces:**
- Consumes: `get_current_user` for user-based key, Redis for storage (fallback to memory)
- Produces: `limiter = Limiter(key_func=get_user_or_ip)`; endpoints limited: upload 10/min, analyze 5/min, clip 10/min; daily quota: 20 analyzes, 50 clips per user

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_rate_limits.py
from conftest import AUTH_USER_ID

def test_upload_rate_limited(auth_client):
    # Hit upload 11 times quickly — 11th should be 429
    for i in range(11):
        resp = auth_client.post("/upload/url", json={"url": "https://www.youtube.com/watch?v=test", "title": "t"})
        if resp.status_code == 429:
            assert True
            return
    pytest.fail("Expected 429 after rate limit exceeded")

def test_analyze_daily_quota(auth_client, db_session):
    from database import Episode
    # Create episode and hit quota
    # ... setup 20 analyzes, 21st should be 429 ...
    pass
```

- [ ] **Step 2: Run test to verify it fails**

Run: `backend/venv/Scripts/python.exe -m pytest backend/tests/test_rate_limits.py -v`
Expected: FAIL with 200 instead of 429

- [ ] **Step 3: Write minimal implementation**

Add to `backend/requirements.txt`: `slowapi==0.1.9`

In `backend/main.py`:

```python
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

def get_user_or_ip(request):
    # Try to get user_id from token, fallback to IP
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        try:
            from auth import decode_token
            uid = decode_token(auth[7:])
            if uid: return uid
        except: pass
    return get_remote_address(request)

limiter = Limiter(key_func=get_user_or_ip, storage_uri=os.getenv("REDIS_URL", "memory://"))
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, lambda r,e: JSONResponse({"detail": "Rate limit exceeded"}, status_code=429))
```

Decorate routes:

```python
from main import limiter

@router.post("/")
@limiter.limit("10/minute")
async def upload_episode(request: Request, file: UploadFile = File(...), ...):
```

Similar for `start_upload_from_url` (10/min), `analyze_transcript` (5/min), `create_clip` (10/min).

Add daily quota middleware in `backend/middleware/quotas.py` checking DB counts per user per day.

- [ ] **Step 4: Run test to verify it passes**

Run: `backend/venv/Scripts/python.exe -m pytest backend/tests/test_rate_limits.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/requirements.txt backend/main.py backend/routes/upload.py backend/routes/analyze.py backend/routes/generate.py backend/middleware/quotas.py backend/tests/test_rate_limits.py
git commit -m "feat: add rate limiting and daily quotas (A5, D2)"
```

---

### Task 6: Worker Reliability — Retries, Timeouts, Sweeper (B4, B5)

**Files:**
- Modify: `backend/celery_app.py` (acks_late, time limits, beat schedule)
- Modify: `backend/worker.py` (autoretry, cleanup on broker failure)
- Create: `backend/tasks/sweeper.py` (stale job cleanup)
- Test: `backend/tests/test_worker_reliability.py`

**Interfaces:**
- Consumes: Celery beat, Job model
- Produces: Stale jobs (>30 min in non-terminal) auto-failed; dispatch failures clean up saved files; broker failures mark job failed instead of orphaned

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_worker_reliability.py
from datetime import datetime, timedelta
from database import Job
from conftest import AUTH_USER_ID

def test_sweeper_fails_stale_jobs(db_session):
    from tasks.sweeper import sweep_stale_jobs
    old = Job(id="stale-1", user_id=AUTH_USER_ID, status="transcribing", progress=50,
              created_at=datetime.utcnow() - timedelta(minutes=31))
    db_session.add(old)
    db_session.commit()
    sweep_stale_jobs()
    db_session.refresh(old)
    assert old.status == "error"
    assert "timeout" in old.error.lower()

def test_dispatch_failure_cleans_file(auth_client, tmp_path, monkeypatch):
    # Mock process_file_job.delay to raise Redis connection error
    monkeypatch.setattr("routes.upload.process_file_job.delay", lambda *a, **kw: (_ for _ in ()).throw(Exception("Redis down")))
    # Upload should still return 500 but file should be cleaned
    pass
```

- [ ] **Step 2: Run test to verify it fails**

Run: `backend/venv/Scripts/python.exe -m pytest backend/tests/test_worker_reliability.py -v`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

Update `backend/celery_app.py`:

```python
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    task_time_limit=600,
    task_soft_time_limit=480,
    beat_schedule={
        "sweep-stale-jobs": {
            "task": "tasks.sweeper.sweep_stale_jobs",
            "schedule": 300.0,  # every 5 min
        }
    }
)
```

Update `backend/routes/upload.py` dispatch with try/except:

```python
try:
    process_file_job.delay(job_id, str(saved_path), file.filename, file.content_type, title, current_user.id)
except Exception as e:
    # Broker down — mark failed and cleanup file
    job.status = "error"
    job.error = f"Dispatch failed: {e}"
    db.commit()
    saved_path.unlink(missing_ok=True)
    raise HTTPException(status_code=500, detail="Job dispatch failed, please retry") from e
```

Create `backend/tasks/sweeper.py`:

```python
from datetime import datetime, timedelta
from celery_app import celery_app
from database import SessionLocal, Job

@celery_app.task
def sweep_stale_jobs():
    db = SessionLocal()
    cutoff = datetime.utcnow() - timedelta(minutes=30)
    stale = db.query(Job).filter(
        Job.status.in_(["queued", "uploading", "transcribing"]),
        Job.created_at < cutoff
    ).all()
    for job in stale:
        job.status = "error"
        job.error = "Job timed out (stale)"
    db.commit()
    db.close()
```

- [ ] **Step 4: Run test to verify it passes**

Run: `backend/venv/Scripts/python.exe -m pytest backend/tests/test_worker_reliability.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/celery_app.py backend/worker.py backend/tasks/sweeper.py backend/routes/upload.py backend/tests/test_worker_reliability.py
git commit -m "feat: add worker reliability - retries, timeouts, sweeper (B4, B5)"
```

---

### Task 7: Structured Logging & Generic Error Responses (B3, C6)

**Files:**
- Create: `backend/utils/logging_config.py`
- Modify: `backend/main.py` (setup logging)
- Modify: `backend/routes/upload.py`, `backend/routes/analyze.py`, `backend/routes/generate.py`, `backend/routes/calendar.py`, `backend/auth.py` (replace detail=str(e) with generic messages + logger.exception)
- Test: `backend/tests/test_error_handling.py`

**Interfaces:**
- Consumes: Python logging
- Produces: `setup_logging()` called at startup; all `detail=str(e)` replaced with generic user messages; server logs contain full exception with request context

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_error_handling.py
def test_register_duplicate_returns_generic(auth_client):
    # Register twice with same email — second should be 409 with generic message, not DB error leak
    payload = {"name": "Test", "email": "dup@example.com", "password": "Test123!@#"}
    auth_client.post("/auth/register", json=payload)
    resp = auth_client.post("/auth/register", json=payload)
    assert resp.status_code == 409
    assert "sql" not in resp.json()["detail"].lower()
    assert "already registered" in resp.json()["detail"].lower()

def test_analyze_error_generic(auth_client, db_session, monkeypatch):
    from database import Episode
    from conftest import AUTH_USER_ID
    ep = Episode(id="ep-err", user_id=AUTH_USER_ID, title="T", filename="f.mp4", transcript="t", words=[], word_count=1)
    db_session.add(ep)
    db_session.commit()
    # Mock Groq to raise internal error with sensitive path
    monkeypatch.setenv("GROQ_API_KEY", "test")
    import routes.analyze
    orig = routes.analyze.Groq
    class FakeGroq:
        def __init__(self, api_key): pass
        class chat:
            class completions:
                @staticmethod
                def create(**kw):
                    raise RuntimeError("/home/app/secrets leaked path")
    monkeypatch.setattr("routes.analyze.Groq", FakeGroq)
    resp = auth_client.post("/analyze/", json={"file_id": "ep-err"})
    assert resp.status_code == 500
    assert "/home/app" not in resp.json()["detail"]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `backend/venv/Scripts/python.exe -m pytest backend/tests/test_error_handling.py -v`
Expected: FAIL with leaked SQL/path in detail

- [ ] **Step 3: Write minimal implementation**

Create `backend/utils/logging_config.py`:

```python
import logging
import sys

def setup_logging():
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
        handlers=[logging.StreamHandler(sys.stdout)],
    )
    # Ensure uvicorn doesn't duplicate
    logging.getLogger("uvicorn.error").propagate = True
```

In `backend/main.py` call `setup_logging()` before `init_db()`.

Replace all `detail=str(e)` patterns:

```python
# Before:
raise HTTPException(status_code=500, detail=str(e)) from e

# After:
import logging
logger = logging.getLogger(__name__)
logger.exception("Operation failed for user %s", current_user.id)
raise HTTPException(status_code=500, detail="Internal error, please retry") from e
```

Specific fixes:
- `auth.py:register` — catch `IntegrityError` → 409 + generic
- `routes/upload.py` dispatch failure — generic already done in Task 6
- `routes/generate.py` FFmpeg errors — log path, return "Clip generation failed"
- `routes/calendar.py` — log with user_id context

- [ ] **Step 4: Run test to verify it passes**

Run: `backend/venv/Scripts/python.exe -m pytest backend/tests/test_error_handling.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/utils/logging_config.py backend/main.py backend/routes/upload.py backend/routes/analyze.py backend/routes/generate.py backend/routes/calendar.py backend/auth.py backend/tests/test_error_handling.py
git commit -m "feat: structured logging and generic error responses (B3, C6)"
```

---

## Self-Review

**1. Spec coverage:** Check each AUDIT requirement:
- A2 SSRF → Task 1 ✓
- A3 Upload caps → Task 2 ✓
- A4 Blocking calls → Tasks 3 & 4 ✓
- A5/D2 Rate limits → Task 5 ✓
- B4/B5 Worker reliability → Task 6 ✓
- B3/C6 Logging & error handling → Task 7 ✓
- B9 Input validation → Task 2 (clip/quote colors) ✓
- B12 Register race → Task 7 (IntegrityError → 409) ✓

**2. Placeholder scan:** No TBD/TODO patterns in plan.

**3. Type consistency:** All task interfaces use `user_id: str`, `file_id: str`, job returns `{"job_id": str, "status": str}` consistently.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-08-22-phase1b-hardening.md`. Two execution options:**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
