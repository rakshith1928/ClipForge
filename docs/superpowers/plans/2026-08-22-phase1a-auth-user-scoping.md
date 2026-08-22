# Phase 1a — Auth Enforcement + User Scoping Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enforce `get_current_user` authentication on every business route and scope every query to the owning user (AUDIT A1/D1/C2), so one user can never read or mutate another user's episodes, jobs, content, or scheduled posts.

**Architecture:** Backend-first: a shared authenticated test fixture, then each router gains `Depends(get_current_user)` plus ownership-filtered queries; ownership is stamped at creation time (`Job.user_id`, `Episode.user_id`, `GeneratedContent.user_id`, `ScheduledPost.user_id` — all columns already exist except `Job.user_id`). The Celery worker receives `user_id` as an explicit task argument since it has no request context. Frontend gets a central `apiFetch()` wrapper that attaches the Bearer token and refreshes once on 401, then every page/lib switches to it. `/files` static mount intentionally stays unauthenticated in this phase (signed URLs are D7/Phase 3).

**Tech Stack:** FastAPI + SQLAlchemy + pytest · Next.js 16 / TypeScript · vitest

## Global Constraints

- Backend venv at `backend/venv`; run pytest from workdir `backend`: `venv\Scripts\python.exe -m pytest tests -q`. Current suite: **40 passed** — must stay green after every task (some existing tests get updated to authenticate).
- Frontend: run from workdir `frontend`: `npm test` (**23 passing** currently) and `npm run build`.
- NEVER commit or read `backend/.env` contents into code or tests.
- Missing/invalid credentials must return **401** (standardize `HTTPBearer(auto_error=False)`); tests may accept 403 only where noted during transition.
- Ownership rule: a query for another user's resource returns **404** (never 403 — don't leak existence).
- Legacy rows have `NULL user_id`; they become invisible to scoped list endpoints. Acceptable; note it.
- Commit style: conventional commits, one commit per task.
- Deployment note: backend protection and frontend wiring must ship together — old clients get 401s the moment the backend task merges. Keep this whole branch as one PR.
- Windows / PowerShell 5.1 throughout.

---

### Task 1: Backend auth test infrastructure

**Files:**
- Modify: `backend/conftest.py`
- Test: `backend/tests/test_auth_infra.py`

**Interfaces:**
- Consumes: existing `client`, `db_session`, `clean_tables` fixtures; `auth.create_access_token`
- Produces (used by Tasks 2–5):
  - `AUTH_USER_ID = "auth-test-user"` module constant
  - `make_user(db_session, user_id=AUTH_USER_ID) -> User` helper
  - `bearer_for(user_id) -> dict` helper (Authorization headers)
  - `auth_client` fixture — `client` pre-configured with a valid Bearer token for `AUTH_USER_ID`

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_auth_infra.py`:

```python
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
```

- [ ] **Step 2: Run to verify failure**

Run: `venv\Scripts\python.exe -m pytest tests\test_auth_infra.py -v`
Expected: FAIL — `ImportError: cannot import name 'AUTH_USER_ID' from 'conftest'`.

- [ ] **Step 3: Implement**

In `backend/auth.py`, change line ~31:

```python
security = HTTPBearer()
```

to:

```python
security = HTTPBearer(auto_error=False)
```

and at the top of `get_current_user` (before decoding), add:

```python
    if credentials is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
```

In `backend/conftest.py`, add after the `db_session` fixture:

```python
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
```

(`pytest` and imports are already at the top of conftest.py.)

- [ ] **Step 4: Run to verify pass + full suite**

Run: `venv\Scripts\python.exe -m pytest tests\test_auth_infra.py -v` → 4 passed.
Run: `venv\Scripts\python.exe -m pytest tests -q` → **44 passed** (40 + 4 new).

- [ ] **Step 5: Commit**

```bash
git add backend/conftest.py backend/auth.py backend/tests/test_auth_infra.py
git commit -m "test: authenticated client fixtures; 401 on missing credentials"
```

---

### Task 2: Protect /upload routes + Job ownership (A1)

**Files:**
- Modify: `backend/database.py` (Job model), `backend/routes/upload.py`, `backend/worker.py`
- Test: `backend/tests/test_auth_upload.py`
- Modify: `backend/tests/test_api.py` (two tests updated to authenticate)

**Interfaces:**
- Consumes: Task 1 fixtures; `get_current_user`
- Produces:
  - `Job.user_id` column
  - `process_file_job(job_id, saved_path_str, original_filename, content_type, title, user_id=None)` — new trailing optional arg
  - `process_url_job(job_id, url, title, user_id=None)` — same
  - All three `/upload/*` routes require auth; `/upload/status/{id}` returns 404 for other users' jobs

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/test_auth_upload.py`:

```python
"""A1: upload routes require authentication and jobs are scoped to their owner."""

from database import Job

from conftest import AUTH_USER_ID, bearer_for, make_user


def test_upload_requires_auth(client):
    resp = client.post("/upload/")
    assert resp.status_code in (401, 403)


def test_upload_url_requires_auth(client):
    resp = client.post("/upload/url", json={"url": "https://example.com/v.mp4"})
    assert resp.status_code in (401, 403)


def test_status_requires_auth(client):
    resp = client.get("/upload/status/any-job")
    assert resp.status_code in (401, 403)


def test_status_allows_owner(auth_client, db_session):
    db_session.add(Job(id="job-mine", title="t", status="queued", progress=0, user_id=AUTH_USER_ID))
    db_session.commit()
    resp = auth_client.get("/upload/status/job-mine")
    assert resp.status_code == 200
    assert resp.json()["status"] == "queued"


def test_status_404s_for_other_users_job(auth_client, db_session):
    make_user(db_session, "other-user")
    db_session.add(Job(id="job-theirs", title="t", status="queued", progress=0, user_id="other-user"))
    db_session.commit()
    resp = auth_client.get("/upload/status/job-theirs")
    assert resp.status_code == 404
```

- [ ] **Step 2: Run to verify failure**

Run: `venv\Scripts\python.exe -m pytest tests\test_auth_upload.py -v`
Expected: FAIL — first three get 200/400 instead of 401/403; owner test fails on missing `user_id` kwarg.

- [ ] **Step 3: Add Job.user_id column**

In `backend/database.py`, `Job` model — add as the first column after `id`:

```python
    id = Column(String, primary_key=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=True)
```

- [ ] **Step 4: Protect the routes and stamp ownership**

In `backend/routes/upload.py`, update imports:

```python
from auth import get_current_user
from database import Episode, Job, User, get_db
```

`POST /` — new signature, stamp, pass-through:

```python
@router.post("/")
async def upload_episode(
    file: UploadFile = File(...),
    title: str = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
```

inside, set on the Job and extend the delay call's args:

```python
    new_job = Job(
        id=job_id,
        user_id=current_user.id,
        url=None,
        title=title or file.filename,
        status="uploading",
        progress=100
    )
```

```python
    process_file_job.delay(
        job_id,
        str(saved_path),
        file.filename,
        file.content_type,
        title,
        current_user.id,
    )
```

`POST /url` — same pattern:

```python
@router.post("/url")
async def start_upload_from_url(
    body: UrlUploadRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
```

```python
    new_job = Job(
        id=job_id,
        user_id=current_user.id,
        url=body.url,
        title=body.title,
        status="queued",
        progress=0
    )
```

```python
    process_url_job.delay(job_id, body.url, body.title, current_user.id)
```

`GET /status/{job_id}`:

```python
@router.get("/status/{job_id}")
async def get_job_status(
    job_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    job = db.query(Job).filter(Job.id == job_id, Job.user_id == current_user.id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
```

- [ ] **Step 5: Thread user_id through the worker**

In `backend/worker.py` — both signatures gain a trailing optional arg, both Episode creations stamp it:

```python
def process_file_job(self, job_id: str, saved_path_str: str, original_filename: str, content_type: str, title: str | None, user_id: str | None = None):
```

```python
def process_url_job(self, job_id: str, url: str, title: str | None, user_id: str | None = None):
```

Both `episode = Episode(...)` blocks get `user_id=user_id,` added right after `id=job_id,`.

- [ ] **Step 6: Update affected existing tests**

In `backend/tests/test_api.py`:
- `test_unknown_analysis_returns_404` — leave for Task 3.
- `test_job_status_unknown_returns_404` — switch fixture param `client` → `auth_client`.
- `test_upload_from_url_uses_lazily_imported_ytdlp` — read the test first, then adapt: switch to `auth_client`, and if it monkeypatches `process_url_job.delay`, keep doing so but assert the call now includes the extra `user_id` positional arg matching `AUTH_USER_ID` (import from `conftest`). If it asserts `.delay` args positionally, append `conftest.AUTH_USER_ID` to the expected tuple.

Also apply dev-DB migration if reachable (optional, non-blocking):

```powershell
& "backend\venv\Scripts\python.exe" -c "import psycopg2, os; from dotenv import load_dotenv; load_dotenv('backend/.env'); conn = psycopg2.connect(os.environ['DATABASE_URL']); cur = conn.cursor(); cur.execute('ALTER TABLE jobs ADD COLUMN IF NOT EXISTS user_id VARCHAR'); conn.commit(); print('ok')"
```

- [ ] **Step 7: Run full suite**

Run: `venv\Scripts\python.exe -m pytest tests -q`
Expected: all pass (44 prior + 5 new − 0 removed).

- [ ] **Step 8: Commit**

```bash
git add backend/database.py backend/routes/upload.py backend/worker.py backend/tests/test_auth_upload.py backend/tests/test_api.py
git commit -m "feat: require auth on upload routes, stamp Job.user_id, scope status polling (A1)"
```

---

### Task 3: Protect /analyze routes + Episode scoping (A1)

**Files:**
- Modify: `backend/routes/analyze.py`
- Test: `backend/tests/test_auth_analyze.py`
- Modify: `backend/tests/test_api.py`, `backend/tests/test_analysis_status.py`, `backend/tests/test_playback_contract.py`

**Interfaces:**
- Consumes: Task 1 fixtures
- Produces: POST `/analyze/` and GET `/analyze/{file_id}` require auth and return 404 for other users' episodes; newly created Episodes/GeneratedContent rows carry `user_id`

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/test_auth_analyze.py`:

```python
"""A1: analysis endpoints require auth and episodes are scoped to their owner."""

import json
from unittest.mock import MagicMock

from database import Episode, GeneratedContent

from conftest import AUTH_USER_ID, make_user


GROQ_JSON = json.dumps({
    "quotes": [], "clips": [], "episode_summary": "s",
    "main_themes": [], "topics_discussed": [],
    "controversial_moments": [],
    "knowledge_extracted": {"key_lessons": [], "key_insights": [], "actionable_tips": []},
    "speaker_highlights": [], "twitter_thread": ["t1"],
    "linkedin_post": "li", "instagram_caption": "ig",
})


def _mock_groq(monkeypatch):
    message = MagicMock()
    message.choices[0].message.content = GROQ_JSON
    fake = MagicMock()
    fake.chat.completions.create.return_value = message
    monkeypatch.setenv("GROQ_API_KEY", "test-key")
    monkeypatch.setattr("groq.Groq", lambda api_key: fake)


def _seed_episode(db, episode_id, owner_id):
    db.add(Episode(id=episode_id, title="T", filename="f.mp4",
                   transcript="some transcript text here", words=[],
                   word_count=4, user_id=owner_id))
    db.commit()


def test_post_analyze_requires_auth(client):
    assert client.post("/analyze/", json={"file_id": "x"}).status_code in (401, 403)


def test_get_analysis_requires_auth(client):
    assert client.get("/analyze/x").status_code in (401, 403)


def test_cannot_read_other_users_episode(auth_client, db_session):
    make_user(db_session, "other-user")
    _seed_episode(db_session, "ep-other", "other-user")
    assert auth_client.get("/analyze/ep-other").status_code == 404
    assert auth_client.post("/analyze/", json={"file_id": "ep-other"}).status_code == 404


def test_owner_can_read_and_analyze(auth_client, db_session, monkeypatch):
    _seed_episode(db_session, "ep-mine", AUTH_USER_ID)
    assert auth_client.get("/analyze/ep-mine").status_code == 200

    _mock_groq(monkeypatch)
    resp = auth_client.post("/analyze/", json={"file_id": "ep-mine"})
    assert resp.status_code == 200

    db_session.expire_all()
    contents = db_session.query(GeneratedContent).filter(
        GeneratedContent.episode_id == "ep-mine").all()
    assert contents, "analysis should produce GeneratedContent rows"
    assert all(c.user_id == AUTH_USER_ID for c in contents)
```

- [ ] **Step 2: Run to verify failure**

Run: `venv\Scripts\python.exe -m pytest tests\test_auth_analyze.py -v`
Expected: FAIL — unauthenticated calls succeed (200/500), cross-user reads return 200, created rows lack user_id.

- [ ] **Step 3: Implement scoping in routes/analyze.py**

Imports:

```python
from auth import get_current_user
from database import Episode, GeneratedContent, User, get_db
```

`POST /` signature and lookups:

```python
@router.post("/")
async def analyze_transcript(body: AnalyzeRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
```

Replace BOTH episode lookups inside the function with:

```python
    episode = db.query(Episode).filter(Episode.id == body.file_id, Episode.user_id == current_user.id).first()
```

(The fallback creation branch keeps its shape but stamps ownership: add `user_id=current_user.id,` to the `Episode(...)` constructor there.)

Every `GeneratedContent(...)` construction in the route (clips loop, quotes loop, twitter thread, linkedin, instagram) gains:

```python
                user_id=current_user.id,
```

`GET /{file_id}`:

```python
@router.get("/{file_id}")
async def get_analysis(file_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    episode = db.query(Episode).filter(Episode.id == file_id, Episode.user_id == current_user.id).first()
    if not episode:
        raise HTTPException(status_code=404, detail="Analysis not found or still processing")
```

(Remaining `contents` query stays keyed on `episode_id` — ownership is already established transitively.)

- [ ] **Step 4: Update affected existing tests**

- `backend/tests/test_api.py::test_unknown_analysis_returns_404` — switch to `auth_client` (unknown id still 404 for an authenticated user).
- `backend/tests/test_analysis_status.py` — `_seed_episode` gains `user_id` kwarg support; switch fixture params `client` → `auth_client`; seed with `user_id=AUTH_USER_ID` (import from `conftest`).
- `backend/tests/test_playback_contract.py` — `_seed_episode(db)` stamps `user_id=AUTH_USER_ID`; switch `client` → `auth_client` in the two endpoint tests. The pure-DB `test_worker_stores_on_disk_basename` needs no changes.

- [ ] **Step 5: Run full suite**

Run: `venv\Scripts\python.exe -m pytest tests -q`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add backend/routes/analyze.py backend/tests/
git commit -m "feat: require auth on analyze routes, scope episodes and content to owner (A1)"
```

---

### Task 4: Protect /generate routes + ownership checks (A1)

**Files:**
- Modify: `backend/routes/generate.py`
- Test: `backend/tests/test_auth_generate.py`

**Interfaces:**
- Consumes: Task 1 fixtures
- Produces: POST `/generate/clip` and `/generate/quote-card` require auth; requests referencing another user's `episode_id` return 404; created rows carry `user_id`; `clip.file_id != clip.episode_id` rejected with 400

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/test_auth_generate.py`:

```python
"""A1: generation endpoints require auth and verify episode ownership."""

from database import Episode

from conftest import AUTH_USER_ID, make_user


def _seed_episode(db, episode_id, owner_id):
    db.add(Episode(id=episode_id, title="T", filename="f.mp4",
                   transcript="t", words=[], word_count=1, user_id=owner_id))
    db.commit()


def test_clip_requires_auth(client):
    assert client.post("/generate/clip", json={
        "file_id": "f", "episode_id": "e", "start_time": 0, "end_time": 1,
    }).status_code in (401, 403)


def test_quote_card_requires_auth(client):
    assert client.post("/generate/quote-card", json={
        "episode_id": "e", "quote_text": "hi",
    }).status_code in (401, 403)


def test_clip_rejects_other_users_episode(auth_client, db_session):
    make_user(db_session, "other-user")
    _seed_episode(db_session, "ep-other", "other-user")
    resp = auth_client.post("/generate/clip", json={
        "file_id": "ep-other", "episode_id": "ep-other",
        "start_time": 0, "end_time": 1,
    })
    assert resp.status_code == 404


def test_quote_card_rejects_other_users_episode(auth_client, db_session):
    make_user(db_session, "other-user")
    _seed_episode(db_session, "ep-other", "other-user")
    resp = auth_client.post("/generate/quote-card", json={
        "episode_id": "ep-other", "quote_text": "hello world quote",
    })
    assert resp.status_code == 404


def test_quote_card_stamps_user_id(auth_client, db_session):
    _seed_episode(db_session, "ep-mine", AUTH_USER_ID)
    resp = auth_client.post("/generate/quote-card", json={
        "episode_id": "ep-mine", "quote_text": "hello world quote",
    })
    assert resp.status_code == 200

    from database import GeneratedContent
    row = db_session.query(GeneratedContent).filter(
        GeneratedContent.episode_id == "ep-mine",
        GeneratedContent.content_type == "quote_card").first()
    assert row is not None
    assert row.user_id == AUTH_USER_ID
```

(No ffmpeg needed — the ownership guard runs before any media work; the happy-path quote-card test exercises real Pillow generation which runs anywhere.)

- [ ] **Step 2: Run to verify failure**

Run: `venv\Scripts\python.exe -m pytest tests\test_auth_generate.py -v`
Expected: FAIL — unauthenticated calls reach business logic; foreign episodes accepted.

- [ ] **Step 3: Implement**

In `backend/routes/generate.py`, imports:

```python
from auth import get_current_user
from database import Episode, GeneratedContent, User, get_db
```

Add a shared guard above the routes:

```python
def _owned_episode_or_404(db: Session, episode_id: str, user: User) -> Episode:
    episode = db.query(Episode).filter(
        Episode.id == episode_id, Episode.user_id == user.id
    ).first()
    if not episode:
        raise HTTPException(status_code=404, detail="Episode not found")
    return episode
```

`POST /clip`:

```python
@router.post("/clip")
async def create_clip(body: ClipRequest, db: Session = Depends(_db_session), current_user: User = Depends(get_current_user)):
    """Cut a video clip, save it to DB, and return a download URL."""
    episode = _owned_episode_or_404(db, body.episode_id, current_user)
    if body.file_id != body.episode_id:
        raise HTTPException(status_code=400, detail="file_id and episode_id must match")
```

and stamp `user_id=current_user.id,` on its `GeneratedContent(...)`.

`POST /quote-card`:

```python
@router.post("/quote-card")
async def create_quote_card(body: QuoteCardRequest, db: Session = Depends(_db_session), current_user: User = Depends(get_current_user)):
    """Generate a quote card image, save it to DB, and return a download URL."""
    _owned_episode_or_404(db, body.episode_id, current_user)
```

stamp `user_id=current_user.id,` on its `GeneratedContent(...)` too.

- [ ] **Step 4: Run full suite**

Run: `venv\Scripts\python.exe -m pytest tests -q`
Expected: all pass (existing security tests target pure helpers — unaffected).

- [ ] **Step 5: Commit**

```bash
git add backend/routes/generate.py backend/tests/test_auth_generate.py
git commit -m "feat: require auth on generate routes, verify episode ownership (A1)"
```

---

### Task 5: Protect /calendar routes + user-scoped queries; remove dead middleware (A1)

**Files:**
- Modify: `backend/routes/calendar.py`
- Delete: `backend/middleware.py` (dead code per AUDIT A1 step 5 / B15)
- Test: `backend/tests/test_auth_calendar.py`
- Modify: `backend/tests/test_api.py` (calendar tests switch to `auth_client`)

**Interfaces:**
- Consumes: Task 1 fixtures
- Produces: all four calendar routes require auth; `GET /calendar/episodes` lists only own episodes; schedule/posts/status are scoped via episode ownership; new ScheduledPosts carry `user_id`

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/test_auth_calendar.py`:

```python
"""A1: calendar endpoints require auth and scope everything to the owner."""

from datetime import date

from database import Episode, GeneratedContent, ScheduledPost

from conftest import AUTH_USER_ID, make_user


def _seed_episode_with_content(db, episode_id, owner_id):
    db.add(Episode(id=episode_id, title="T", filename="f.mp4",
                   transcript="t", words=[], word_count=1, user_id=owner_id))
    db.add(GeneratedContent(id=f"c-{episode_id}", user_id=owner_id,
                            episode_id=episode_id, content_type="quote",
                            title="q", body="quote body", content_metadata={}))
    db.commit()


def test_episodes_list_requires_auth(client):
    assert client.get("/calendar/episodes").status_code in (401, 403)


def test_schedule_requires_auth(client):
    assert client.post("/calendar/schedule", json={
        "episode_id": "e", "start_date": "2026-01-01",
    }).status_code in (401, 403)


def test_episodes_list_scoped(auth_client, db_session):
    make_user(db_session, "other-user")
    _seed_episode_with_content(db_session, "mine", AUTH_USER_ID)
    _seed_episode_with_content(db_session, "theirs", "other-user")

    ids = [e["id"] for e in auth_client.get("/calendar/episodes").json()["data"]["episodes"]]
    assert "mine" in ids
    assert "theirs" not in ids


def test_schedule_rejects_other_users_episode(auth_client, db_session):
    make_user(db_session, "other-user")
    _seed_episode_with_content(db_session, "theirs", "other-user")
    resp = auth_client.post("/calendar/schedule", json={
        "episode_id": "theirs", "start_date": "2026-01-01"})
    assert resp.status_code == 404


def test_schedule_stamps_user_and_posts_scoped(auth_client, db_session):
    _seed_episode_with_content(db_session, "mine", AUTH_USER_ID)
    resp = auth_client.post("/calendar/schedule", json={
        "episode_id": "mine", "start_date": "2026-01-01"})
    assert resp.status_code == 200

    posts = db_session.query(ScheduledPost).filter(
        ScheduledPost.episode_id == "mine").all()
    assert posts
    assert all(p.user_id == AUTH_USER_ID for p in posts)

    listing = auth_client.get("/calendar/posts/mine")
    assert listing.status_code == 200

    post_id = posts[0].id
    ok = auth_client.patch(f"/calendar/posts/{post_id}/status", params={"status": "posted"})
    assert ok.status_code == 200


def test_posts_hidden_for_other_users_episode(auth_client, db_session):
    make_user(db_session, "other-user")
    _seed_episode_with_content(db_session, "theirs", "other-user")
    db_session.add(ScheduledPost(id="sp-1", user_id="other-user", episode_id="theirs",
                                 content_id="c-theirs", content_type="quote",
                                 content_body="b", scheduled_date=date(2026, 1, 1),
                                 platform="twitter", status="scheduled"))
    db_session.commit()
    assert auth_client.get("/calendar/posts/theirs").status_code == 404
    assert auth_client.patch("/calendar/posts/sp-1/status",
                             params={"status": "posted"}).status_code == 404
```

- [ ] **Step 2: Run to verify failure**

Run: `venv\Scripts\python.exe -m pytest tests\test_auth_calendar.py -v`
Expected: FAIL — unauthenticated succeeds, lists leak all users' episodes.

- [ ] **Step 3: Implement scoping in routes/calendar.py**

Imports:

```python
from auth import get_current_user
from database import Episode, GeneratedContent, ScheduledPost, User, get_db
```

Add a shared guard:

```python
def _owned_episode_or_404(db: Session, episode_id: str, user: User) -> Episode:
    episode = db.query(Episode).filter(
        Episode.id == episode_id, Episode.user_id == user.id
    ).first()
    if not episode:
        raise HTTPException(status_code=404, detail="Episode not found")
    return episode
```

All four route signatures gain `current_user: User = Depends(get_current_user)`.

- `schedule_content`: replace its episode lookup with `_owned_episode_or_404(db, body.episode_id, current_user)`; the bulk delete becomes safe as-is once ownership is verified, but stamp each new `ScheduledPost(...)` with `user_id=current_user.id,`.
- `get_posts`: start with `_owned_episode_or_404(db, episode_id, current_user)` before querying posts.
- `update_post_status`: after fetching the post (keep the existing 404), verify ownership through the episode:

```python
    _owned_episode_or_404(db, post.episode_id, current_user)
```

- `get_episodes`:

```python
    episodes = db.query(Episode).filter(
        Episode.user_id == current_user.id
    ).order_by(Episode.created_at.desc()).limit(50).all()
```

- [ ] **Step 4: Remove dead middleware**

Delete `backend/middleware.py` (verified never imported anywhere).

- [ ] **Step 5: Update existing calendar tests**

In `backend/tests/test_api.py`, switch every test hitting `/calendar/*` from `client` to `auth_client` (they seed episodes directly — also add `user_id=AUTH_USER_ID` where those seeds construct Episodes, importing `AUTH_USER_ID` from `conftest`).

- [ ] **Step 6: Run full suite**

Run: `venv\Scripts\python.exe -m pytest tests -q`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add backend/routes/calendar.py backend/tests/ backend/middleware.py
git commit -m "feat: require auth on calendar routes, scope queries to owner; drop dead middleware (A1)"
```

---

### Task 6: Central frontend API wrapper with Bearer token + single refresh retry

**Files:**
- Create: `frontend/lib/api.ts`
- Test: `frontend/lib/__tests__/api.test.ts`

**Interfaces:**
- Consumes: localStorage keys `access_token` / `refresh_token` (already used by auth page + AuthContext); backend `POST /auth/refresh`
- Produces (consumed by Task 7 & 8):
  - `API_BASE: string`
  - `getAccessToken(): string | null` (SSR-safe)
  - `authHeaders(): Record<string, string>` — `{}` when no token
  - `apiFetch(url: string, init?: RequestInit): Promise<Response>` — attaches Authorization; on 401 tries `POST /auth/refresh` ONCE and retries the original request; gives up transparently otherwise

- [ ] **Step 1: Write the failing test**

Create `frontend/lib/__tests__/api.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch, authHeaders, getAccessToken } from "../api";

const jsonResponse = (body: unknown, status = 200) =>
  ({ ok: status < 400, status, json: async () => body }) as Response;

describe("apiFetch", () => {
  beforeEach(() => {
    localStorage.setItem("access_token", "stale-token");
    localStorage.setItem("refresh_token", "valid-refresh");
  });
  afterEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it("attaches the Bearer header", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    await apiFetch("http://x/api");

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.Authorization).toBe("Bearer stale-token");
  });

  it("retries once with a fresh token after refreshing on 401", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({}, 401)) // original -> 401
      .mockResolvedValueOnce(                       // refresh succeeds
        jsonResponse({ access_token: "fresh-token" })
      )
      .mockResolvedValueOnce(jsonResponse({ done: true })); // retry OK
    vi.stubGlobal("fetch", fetchMock);

    const res = await apiFetch("http://x/api");
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(localStorage.getItem("access_token")).toBe("fresh-token");
    const [, retryInit] = fetchMock.mock.calls[2];
    expect(retryInit.headers.Authorization).toBe("Bearer fresh-token");
  });

  it("does not retry when refresh fails", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({}, 401))
      .mockResolvedValueOnce(jsonResponse({ detail: "bad" }, 401)); // refresh fails
    vi.stubGlobal("fetch", fetchMock);

    const res = await apiFetch("http://x/api");
    expect(res.status).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not attach a header when logged out", async () => {
    localStorage.removeItem("access_token");
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}));
    vi.stubGlobal("fetch", fetchMock);

    await apiFetch("http://x/api");
    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.Authorization).toBeUndefined();
  });
});

describe("helpers", () => {
  afterEach(() => {
    localStorage.clear();
  });

  it("getAccessToken reads localStorage", () => {
    localStorage.setItem("access_token", "tok");
    expect(getAccessToken()).toBe("tok");
  });

  it("authHeaders is empty without a token", () => {
    localStorage.removeItem("access_token");
    expect(authHeaders()).toEqual({});
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run (workdir `frontend`): `npx vitest run lib/__tests__/api.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `frontend/lib/api.ts`:

```ts
// Single place for authenticated API calls: attaches the Bearer token and
// retries once through POST /auth/refresh on a 401 (AUDIT A1 step 4).

export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("access_token");
}

export function authHeaders(): Record<string, string> {
  const token = getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function refreshAccessToken(): Promise<boolean> {
  const refreshToken =
    typeof window !== "undefined" ? localStorage.getItem("refresh_token") : null;
  if (!refreshToken) return false;
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    if (!data.access_token) return false;
    localStorage.setItem("access_token", data.access_token);
    if (data.refresh_token) {
      localStorage.setItem("refresh_token", data.refresh_token);
    }
    return true;
  } catch {
    return false;
  }
}

export async function apiFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const doFetch = () =>
    fetch(url, {
      ...init,
      headers: {
        ...(init.headers || {}),
        ...authHeaders(),
      },
    });

  let res = await doFetch();
  if (res.status === 401 && (await refreshAccessToken())) {
    res = await doFetch();
  }
  return res;
}
```

- [ ] **Step 4: Run to verify pass + build**

Run: `npm test` → all suites green (23 + 6 new = 29).
Run: `npm run build` → clean.

- [ ] **Step 5: Commit**

```bash
git add frontend/lib/api.ts frontend/lib/__tests__/api.test.ts
git commit -m "feat: central apiFetch wrapper with bearer token and refresh-once retry"
```

---

### Task 7: Send credentials from pollJobStatus + calendarApi libs

**Files:**
- Modify: `frontend/lib/pollJobStatus.ts`, `frontend/lib/calendarApi.ts`
- Modify: `frontend/lib/__tests__/pollJobStatus.test.ts`, `frontend/lib/__tests__/calendarApi.test.ts` (header assertions added)

**Interfaces:**
- Consumes: `authHeaders` / `apiFetch` from Task 6
- Produces: both libs transmit the Bearer token; signatures unchanged (call sites in Task 8 stay untouched)

- [ ] **Step 1: Extend pollJobStatus tests**

In `frontend/lib/__tests__/pollJobStatus.test.ts`, inside `beforeEach` of the main describe add `localStorage.setItem("access_token", "test-token");`, in `afterEach` add `localStorage.clear();`, and add one test:

```ts
  it("sends the Authorization header", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ status: "done" }));
    vi.stubGlobal("fetch", fetchMock);
    pollJobStatus("http://x", "j1", () => {});
    await vi.advanceTimersByTimeAsync(2000);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://x/upload/status/j1");
    expect(init.headers.Authorization).toBe("Bearer test-token");
  });
```

- [ ] **Step 2: Implement in pollJobStatus.ts**

Import at top:

```ts
import { authHeaders } from "./api";
```

Change the inner fetch to merge headers:

```ts
      const res = await fetch(`${apiBase}/upload/status/${jobId}`, {
        headers: authHeaders(),
      });
```

- [ ] **Step 3: Extend calendarApi tests**

In `frontend/lib/__tests__/calendarApi.test.ts`, add to `afterEach`: `localStorage.clear();` and in each describe's setup set `localStorage.setItem("access_token", "cal-token");`. Add one assertion-heavy test:

```ts
describe("auth headers", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("updatePostStatus sends the PATCH with a bearer token", async () => {
    localStorage.setItem("access_token", "cal-token");
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ success: true }));
    vi.stubGlobal("fetch", fetchMock);

    await updatePostStatus("http://x", "p1", "posted");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/calendar/posts/p1/status");
    expect(init.method).toBe("PATCH");
    expect(init.headers.Authorization).toBe("Bearer cal-token");
  });
});
```

- [ ] **Step 4: Implement in calendarApi.ts**

Import at top:

```ts
import { authHeaders } from "./api";
```

Merge into each of the three fetches:

```ts
// scheduleEpisode
  const res = await fetch(`${apiBase}/calendar/schedule`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ episode_id: episodeId, start_date: startDate }),
  });

// fetchPosts
  const res = await fetch(`${apiBase}/calendar/posts/${episodeId}`, {
    headers: authHeaders(),
  });

// updatePostStatus
  const res = await fetch(`${apiBase}/calendar/posts/${postId}/status?status=${newStatus}`, {
    method: "PATCH",
    headers: authHeaders(),
  });
```

- [ ] **Step 5: Verify + commit**

Run: `npm test && npm run build` → all green.

```bash
git add frontend/lib/pollJobStatus.ts frontend/lib/calendarApi.ts frontend/lib/__tests__/
git commit -m "feat: send bearer credentials from polling and calendar libs"
```

---

### Task 8: Wire pages — upload XHR/fetches, analyze polling/generation, remaining episodes lists

**Files:**
- Modify: `frontend/app/upload/page.tsx`, `frontend/app/analyze/[id]/page.tsx`, `frontend/app/calendar/page.tsx`, `frontend/app/dashboard/page.tsx`, `frontend/app/generate/page.tsx`

**Interfaces:**
- Consumes: `apiFetch`, `authHeaders` from Task 6
- Produces: every page-level API call carries credentials (matches backend enforcement from Tasks 2–5)

- [ ] **Step 1: upload/page.tsx**

Add import: `import { API_BASE, apiFetch, authHeaders } from "../../lib/api";` — remove the local `const API_BASE = ...` line (same value now exported by lib).

`triggerAnalysis`: swap `await fetch(\`${API_BASE}/analyze\`...)` → `await apiFetch(\`${API_BASE}/analyze\`...)` (headers/body unchanged — apiFetch injects auth).

`handleUrlProcess`: swap `fetch(\`${API_BASE}/upload/url\`...)` → `apiFetch(...)`.

XHR in `handleFileSubmit` — right before `xhr.open(...)`, insert:

```ts
    const token = authHeaders().Authorization;
    if (token) xhr.setRequestHeader("Authorization", token);
```

- [ ] **Step 2: analyze/[id]/page.tsx**

Add import: `import { API_BASE, apiFetch } from "../../../../lib/api";` (verify relative depth against existing imports — the file currently defines `API_BASE` locally at line ~15; delete that line and use the imported one).

Three swaps:
- polling: `fetch(\`${API_BASE}/analyze/${params.id}\`)` → `apiFetch(...)`
- clip generation (~line 321): `fetch(\`${API_BASE}/generate/clip\`...)` → `apiFetch(...)`
- quote card (~line 350): `fetch(\`${API_BASE}/generate/quote-card\`...)` → `apiFetch(...)`

- [ ] **Step 3: calendar/page.tsx**

Swap `fetchEpisodes`'s raw fetch (~line 136) → `apiFetch(\`${API_BASE}/calendar/episodes\`)` (add the lib import; remove local API_BASE if identical).

- [ ] **Step 4: dashboard/page.tsx + generate/page.tsx**

Both call `${API_BASE}/calendar/episodes` (~line 26/~line 27). Apply the same one-line swap to `apiFetch` with the lib import in each.

- [ ] **Step 5: Verify**

Run: `npm test && npm run build` → all green, no type errors.
Manual smoke (dev servers running, logged in via UI): upload a small MP4 end-to-end → transcription completes → analysis dashboard populates → generate a quote card downloads. Logged-out visit to any page shows empty/error states rather than data.

- [ ] **Step 6: Commit**

```bash
git add frontend/app/upload/page.tsx "frontend/app/analyze/[id]/page.tsx" frontend/app/calendar/page.tsx frontend/app/dashboard/page.tsx frontend/app/generate/page.tsx
git commit -m "feat: send auth credentials on all page-level API calls (A1)"
```

---

## Self-Review Notes

- **Spec coverage:** AUDIT A1 recommended fixes: (1) auth deps on all four routers ✓ Tasks 2–5; (2) set user_id at creation ✓ Jobs/Episodes/content/posts; (3) scope every query ✓ per-router; (4) frontend Authorization header ✓ Tasks 6–8 (+refresh-once); (5) delete middleware.py ✓ Task 5. C2 half-wired multi-tenancy closed end-to-end. D7 signed files deliberately deferred (Phase 3) — documented.
- **Placeholder scan:** none — every code step is complete; two steps direct the implementer to *read* an existing test before adapting it (explicitly scoped instructions given).
- **Type consistency:** `auth_client` / `AUTH_USER_ID` / `bearer_for` / `make_user` defined once in Task 1 and consumed verbatim later; `apiFetch`/`authHeaders` signatures consistent between Tasks 6–8; worker arg appended last so existing positional callers stay source-compatible.
