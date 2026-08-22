# Phase 0 — Stop the Bleeding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the two core product bugs (A6 broken playback, A7 blank analysis race), add fail-fast secret validation (A8), and land the frontend quick wins (B2/B6/B7) from AUDIT.md.

**Architecture:** All backend changes are additive SQLAlchemy columns + small route edits, fully covered by pytest (existing suite at `backend/tests/`). Frontend logic is extracted into pure, unit-testable modules under `frontend/lib/` (tested with vitest) and wired into existing pages; page wiring itself is verified via `npm run build`.

**Tech Stack:** FastAPI + SQLAlchemy + pytest · Next.js 16 / React 19 / TypeScript · vitest + jsdom + React Testing Library

## Global Constraints

- Python venv lives at `backend/venv`; run all backend commands with `backend\venv\Scripts\python.exe` from `workdir: backend`.
- Run frontend commands with `npm` from `workdir: frontend`.
- NEVER commit or read `backend/.env` contents into code or tests.
- **Manual prerequisite (user action, not a task — A8 part 1):** rotate every key currently in `backend/.env` (Deepgram, Gemini, Groq, Postgres password, Google OAuth, JWT `SECRET_KEY`). No code task covers this.
- DB note: `Base.metadata.create_all()` only creates missing tables, it does NOT alter existing tables. After Tasks 3 & 4, an existing dev Postgres DB needs:
  `ALTER TABLE episodes ADD COLUMN storage_path VARCHAR;`
  `ALTER TABLE episodes ADD COLUMN analysis_status VARCHAR;`
  (The test suite uses a fresh temp SQLite DB per session, so tests are unaffected.)
- Commit style: conventional commits (`fix:`, `chore:`, `test:`), one commit per task.
- Existing 26 tests must stay green after every task.

---

### Task 1: Pin backend dependencies to installed versions (B14)

**Files:**
- Modify: `backend/requirements.txt`

**Interfaces:**
- Consumes: nothing
- Produces: pinned `requirements.txt`; later tasks install from it

- [ ] **Step 1: Generate pinned requirements from the actual venv**

```powershell
$freeze = & "backend\venv\Scripts\python.exe" -m pip freeze
Get-Content backend\requirements.txt | Where-Object { $_ -match '^[a-zA-Z]' } | ForEach-Object {
  $name = ($_ -split '\[|==|<|>|=|;')[0].Trim()
  $match = $freeze | Where-Object { $_ -like "$name==*" } | Select-Object -First 1
  if ($match) { $match } else { Write-Warning "NOT PINNED (name drift): $_"; $_ }
} | Set-Content backend\requirements.txt
```

Expected: each line becomes `package==x.y.z`. If a warning fires (e.g., `deepgram` vs `deepgram-sdk`), manually fix that line using `pip freeze` output.

- [ ] **Step 2: Verify install resolves cleanly**

Run: `& "backend\venv\Scripts\python.exe" -m pip install -r backend\requirements.txt --dry-run`
Expected: exit code 0, "Would install ..." or "Requirement already satisfied" lines only.

- [ ] **Step 3: Run full backend suite**

Run (workdir `backend`): `venv\Scripts\python.exe -m pytest tests -q`
Expected: 26 passed (or more).

- [ ] **Step 4: Commit**

```bash
git add backend/requirements.txt
git commit -m "chore: pin backend dependencies to installed versions (B14)"
```

---

### Task 2: Fail-fast secret configuration (A8/D6)

**Files:**
- Create: `backend/config.py`
- Test: `backend/tests/test_config.py`
- Modify: `backend/auth.py:25` (SECRET_KEY)
- Modify: `backend/main.py:32` (SessionMiddleware secret)

**Interfaces:**
- Consumes: env vars `SECRET_KEY`, `ENVIRONMENT`
- Produces: `config.get_secret(name: str, *, dev_default: str | None = None) -> str`, raises `config.MissingSecretError`

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_config.py`:

```python
import pytest

from config import MissingSecretError, get_secret


def test_returns_env_value_when_set(monkeypatch):
    monkeypatch.setenv("MY_SECRET", "real-value")
    assert get_secret("MY_SECRET") == "real-value"


def test_dev_default_used_in_dev(monkeypatch):
    monkeypatch.delenv("MY_SECRET", raising=False)
    monkeypatch.setenv("ENVIRONMENT", "dev")
    assert get_secret("MY_SECRET", dev_default="dev-fallback") == "dev-fallback"


def test_raises_in_production_when_missing(monkeypatch):
    monkeypatch.delenv("MY_SECRET", raising=False)
    monkeypatch.setenv("ENVIRONMENT", "production")
    with pytest.raises(MissingSecretError):
        get_secret("MY_SECRET")


def test_raises_when_missing_and_no_default(monkeypatch):
    monkeypatch.delenv("MY_SECRET", raising=False)
    monkeypatch.setenv("ENVIRONMENT", "dev")
    with pytest.raises(MissingSecretError):
        get_secret("MY_SECRET")


def test_missing_env_treated_as_dev_by_default(monkeypatch):
    monkeypatch.delenv("MY_SECRET", raising=False)
    monkeypatch.delenv("ENVIRONMENT", raising=False)
    assert get_secret("MY_SECRET", dev_default="dev-fallback") == "dev-fallback"
```

- [ ] **Step 2: Run test to verify it fails**

Run (workdir `backend`): `venv\Scripts\python.exe -m pytest tests\test_config.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'config'`

- [ ] **Step 3: Write minimal implementation**

Create `backend/config.py`:

```python
# Central secret access. Fails fast on missing secrets outside dev,
# instead of silently falling back to world-guessable defaults (AUDIT A8).

import os


class MissingSecretError(RuntimeError):
    """Raised when a required secret is missing outside dev."""


def get_secret(name: str, *, dev_default: str | None = None) -> str:
    value = os.getenv(name)
    if value:
        return value
    environment = os.getenv("ENVIRONMENT", "dev").lower()
    if environment == "dev" and dev_default is not None:
        return dev_default
    raise MissingSecretError(
        f"Required secret '{name}' is not set and ENVIRONMENT='{environment}'"
    )
```

- [ ] **Step 4: Run test to verify it passes**

Run: `venv\Scripts\python.exe -m pytest tests\test_config.py -v`
Expected: 5 passed

- [ ] **Step 5: Wire into auth.py and main.py**

In `backend/auth.py`, replace line 25:

```python
SECRET_KEY = os.getenv("SECRET_KEY", "changeme")
```

with:

```python
from config import get_secret

SECRET_KEY = get_secret("SECRET_KEY", dev_default="changeme")
```

(place the import with the other local imports below `from database import ...`)

In `backend/main.py`, replace line 32:

```python
app.add_middleware(SessionMiddleware, secret_key=os.getenv("SECRET_KEY", "changeme_session_secret"))
```

with:

```python
from config import get_secret

app.add_middleware(
    SessionMiddleware,
    secret_key=get_secret("SECRET_KEY", dev_default="changeme_session_secret"),
)
```

- [ ] **Step 6: Run full backend suite**

Run: `venv\Scripts\python.exe -m pytest tests -q`
Expected: all pass (tests run in dev mode → fallbacks apply).

- [ ] **Step 7: Commit**

```bash
git add backend/config.py backend/tests/test_config.py backend/auth.py backend/main.py
git commit -m "feat: fail-fast secret config, no silent insecure defaults (A8)"
```

---

### Task 3: Store on-disk filename so playback works for uploads (A6 backend)

**Files:**
- Test: `backend/tests/test_playback_contract.py`
- Modify: `backend/database.py` (Episode model)
- Modify: `backend/worker.py` (both Episode creations)
- Modify: `backend/routes/analyze.py` (GET `/analyze/{file_id}` response)

**Interfaces:**
- Consumes: existing `Episode` model
- Produces: `Episode.storage_path` column (on-disk basename served by `/files`); GET `/analyze/{id}` returns `episode.storage_path` (frontend Task 8 relies on this exact key)

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_playback_contract.py`:

```python
"""Regression tests for AUDIT A6: file-upload episodes stored the display
filename, but on-disk files are UUID-named, so /files/{filename} was always
a 404 and playback silently died."""

from pathlib import Path

from database import Episode

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
    )
    db.add(episode)
    db.commit()


def test_analyze_returns_storage_path_separate_from_display_name(client, db_session):
    _seed_episode(db_session)
    resp = client.get("/analyze/e2e-playback")
    assert resp.status_code == 200
    body = resp.json()
    assert body["episode"]["storage_path"] == "e2e-playback.mp4"
    assert body["episode"]["filename"] == "My Original Podcast.mp4"


def test_files_endpoint_serves_storage_path(client, db_session):
    _seed_episode(db_session)
    UPLOADS_DIR.mkdir(exist_ok=True)
    target = UPLOADS_DIR / "e2e-playback.mp4"
    target.write_bytes(b"\x00fake-media\x00")
    try:
        resp = client.get("/files/e2e-playback.mp4")
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `venv\Scripts\python.exe -m pytest tests\test_playback_contract.py -v`
Expected: FAIL — first test errors on unknown key `storage_path` (KeyError on `body["episode"]["storage_path"]`); constructor raises `TypeError: 'storage_path' is an invalid keyword argument`.

- [ ] **Step 3: Add the column**

In `backend/database.py`, inside `Episode` (after `filename = Column(String)`):

```python
    filename = Column(String)
    # On-disk basename actually served by /files (UUID-named).
    # `filename` stays the human-readable display name.
    storage_path = Column(String, nullable=True)
```

- [ ] **Step 4: Populate it in the worker**

In `backend/worker.py`, `process_file_job` Episode creation (~line 46) add:

```python
        episode = Episode(
            id=job_id,
            title=title or original_filename or "Untitled Podcast",
            filename=original_filename,
            storage_path=saved_path.name,
            transcript=transcription["transcript"],
            words=transcription["words"],
            word_count=len(transcription["words"]),
            duration=transcription.get("duration", 0),
        )
```

In `process_url_job` Episode creation (~line 132) add:

```python
        episode = Episode(
            id=job_id,
            title=title or f"Video from {url[:60]}",
            filename=str(actual_path.name),
            storage_path=str(actual_path.name),
            transcript=transcription["transcript"],
            words=transcription["words"],
            word_count=len(transcription["words"]),
            duration=transcription.get("duration", 0),
        )
```

- [ ] **Step 5: Expose it in GET /analyze/{file_id}**

In `backend/routes/analyze.py` `get_analysis` return dict, extend the `episode` block:

```python
        "episode": {
            "title": episode.title or "Untitled Podcast",
            "summary": episode.episode_summary or "",
            "filename": episode.filename or "",
            "storage_path": episode.storage_path or "",
            "duration": episode.duration or 0,
            "words": episode.words or [],
        },
```

- [ ] **Step 6: Run test to verify it passes**

Run: `venv\Scripts\python.exe -m pytest tests\test_playback_contract.py -v`
Expected: 3 passed

- [ ] **Step 7: Apply migration to dev DB (if it exists)**

```powershell
& "backend\venv\Scripts\python.exe" -c "import psycopg2, os; from dotenv import load_dotenv; load_dotenv('backend/.env'); conn = psycopg2.connect(os.environ['DATABASE_URL']); cur = conn.cursor(); cur.execute('ALTER TABLE episodes ADD COLUMN IF NOT EXISTS storage_path VARCHAR'); conn.commit(); print('ok')"
```

Expected: prints `ok`. (Skip if no dev DB.)

- [ ] **Step 8: Run full suite and commit**

Run: `venv\Scripts\python.exe -m pytest tests -q`
Expected: all pass

```bash
git add backend/database.py backend/worker.py backend/routes/analyze.py backend/tests/test_playback_contract.py
git commit -m "fix: store on-disk basename in Episode.storage_path so /files playback works (A6)"
```

---

### Task 4: Server-side analysis status (A7 backend)

**Files:**
- Test: `backend/tests/test_analysis_status.py`
- Modify: `backend/database.py` (Episode model)
- Modify: `backend/routes/analyze.py` (POST + GET)

**Interfaces:**
- Consumes: existing POST `/analyze/` and GET `/analyze/{file_id}`
- Produces: `Episode.analysis_status` ∈ {NULL, `"pending"`, `"complete"`, `"error"`}; GET response includes top-level `analysis_status` (defaults `"pending"`); POST response includes `analysis_status: "complete"` (frontend Task 8 polls on this exact field)

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_analysis_status.py`:

```python
"""Regression tests for AUDIT A7: GET /analyze returned 200 with empty results
the moment the Episode row existed, so the results page rendered a permanent
blank 'Complete' state while the LLM was still running."""

import json
from unittest.mock import MagicMock

from database import Episode

GROQ_JSON = json.dumps({
    "quotes": [],
    "clips": [],
    "episode_summary": "s",
    "main_themes": [],
    "topics_discussed": [],
    "controversial_moments": [],
    "knowledge_extracted": {"key_lessons": [], "key_insights": [], "actionable_tips": []},
    "speaker_highlights": [],
    "twitter_thread": ["t1"],
    "linkedin_post": "li",
    "instagram_caption": "ig",
})


def _seed_episode(db):
    ep = Episode(
        id="st-1", title="T", filename="f.mp4",
        transcript="some transcript text here", words=[], word_count=4,
    )
    db.add(ep)
    db.commit()


def _mock_groq(monkeypatch, client_mock):
    monkeypatch.setenv("GROQ_API_KEY", "test-key")
    monkeypatch.setattr("groq.Groq", lambda api_key: client_mock)


def test_get_reports_pending_when_never_analyzed(client, db_session):
    _seed_episode(db_session)
    resp = client.get("/analyze/st-1")
    assert resp.status_code == 200
    assert resp.json()["analysis_status"] == "pending"


def test_post_marks_episode_complete(client, db_session, monkeypatch):
    _seed_episode(db_session)
    message = MagicMock()
    message.choices[0].message.content = GROQ_JSON
    fake = MagicMock()
    fake.chat.completions.create.return_value = message
    _mock_groq(monkeypatch, fake)

    resp = client.post("/analyze/", json={"file_id": "st-1"})
    assert resp.status_code == 200
    assert resp.json()["analysis_status"] == "complete"

    db_session.expire_all()
    ep = db_session.query(Episode).filter(Episode.id == "st-1").first()
    assert ep.analysis_status == "complete"


def test_post_failure_marks_episode_error(client, db_session, monkeypatch):
    _seed_episode(db_session)
    fake = MagicMock()
    fake.chat.completions.create.side_effect = RuntimeError("boom")
    _mock_groq(monkeypatch, fake)

    resp = client.post("/analyze/", json={"file_id": "st-1"})
    assert resp.status_code == 500

    db_session.expire_all()
    ep = db_session.query(Episode).filter(Episode.id == "st-1").first()
    assert ep.analysis_status == "error"

    # And the frontend can now see the terminal error state:
    got = client.get("/analyze/st-1")
    assert got.json()["analysis_status"] == "error"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `venv\Scripts\python.exe -m pytest tests\test_analysis_status.py -v`
Expected: FAIL — `analysis_status` missing from GET payload / TypeError on Episode kwarg.

- [ ] **Step 3: Add the column**

In `backend/database.py`, `Episode` (after `storage_path`):

```python
    analysis_status = Column(String, nullable=True)  # None | pending | complete | error
```

- [ ] **Step 4: Update routes/analyze.py**

Add helper above the routes (after `find_timestamp`):

```python
def _mark_analysis_error(db: Session, file_id: str) -> None:
    episode = db.query(Episode).filter(Episode.id == file_id).first()
    if episode:
        episode.analysis_status = "error"
        db.commit()
```

In `analyze_transcript`, right after the empty-transcript check and before the Groq client is created:

```python
    episode.analysis_status = "pending"
    db.commit()
```

In the success path, just before the final `db.commit()` (~line 284):

```python
        episode.analysis_status = "complete"
        db.commit()
```

Replace the two exception handlers at the bottom of the route with:

```python
    except json.JSONDecodeError as e:
        _mark_analysis_error(db, body.file_id)
        raise HTTPException(status_code=500, detail=f"Invalid JSON from Groq: {str(e)}") from e
    except Exception as e:
        db.rollback()
        _mark_analysis_error(db, body.file_id)
        raise HTTPException(status_code=500, detail=str(e)) from e
```

In the success return dict, add as a top-level key:

```python
            "analysis_status": "complete",
```

In `get_analysis` return dict, add as a top-level key:

```python
        "analysis_status": episode.analysis_status or "pending",
```

- [ ] **Step 5: Run test to verify it passes**

Run: `venv\Scripts\python.exe -m pytest tests\test_analysis_status.py -v`
Expected: 3 passed

- [ ] **Step 6: Full suite + dev DB migration + commit**

Run: `venv\Scripts\python.exe -m pytest tests -q`
Expected: all pass

```powershell
& "backend\venv\Scripts\python.exe" -c "import psycopg2, os; from dotenv import load_dotenv; load_dotenv('backend/.env'); conn = psycopg2.connect(os.environ['DATABASE_URL']); cur = conn.cursor(); cur.execute('ALTER TABLE episodes ADD COLUMN IF NOT EXISTS analysis_status VARCHAR'); conn.commit(); print('ok')"
```

```bash
git add backend/database.py backend/routes/analyze.py backend/tests/test_analysis_status.py
git commit -m "fix: track Episode.analysis_status server-side so results page can poll until terminal (A7)"
```

---

### Task 5: Frontend test infrastructure (vitest + jsdom + RTL)

**Files:**
- Modify: `frontend/package.json` (devDeps + scripts)
- Create: `frontend/vitest.config.ts`
- Create: `frontend/vitest.setup.ts`
- Test: `frontend/lib/__tests__/playbackStore.test.ts`

**Interfaces:**
- Produces: `npm test` runs vitest; `frontend/lib/__tests__/` convention for all later test files

- [ ] **Step 1: Install dev dependencies**

Run (workdir `frontend`): `npm install -D vitest jsdom @testing-library/react @testing-library/dom @testing-library/jest-dom @vitejs/plugin-react`

- [ ] **Step 2: Config files**

Create `frontend/vitest.config.ts`:

```ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./vitest.setup.ts",
  },
});
```

Create `frontend/vitest.setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
```

In `frontend/package.json` `scripts`, add:

```json
    "test": "vitest run",
    "test:watch": "vitest"
```

- [ ] **Step 3: Smoke test against existing store**

Create `frontend/lib/__tests__/playbackStore.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { usePlaybackStore } from "../../store/usePlaybackStore";

describe("usePlaybackStore", () => {
  it("starts idle", () => {
    const s = usePlaybackStore.getState();
    expect(s.currentTime).toBe(0);
    expect(s.totalDuration).toBe(0);
    expect(s.isPlaying).toBe(false);
  });

  it("updates currentTime", () => {
    usePlaybackStore.getState().setCurrentTime(12.5);
    expect(usePlaybackStore.getState().currentTime).toBe(12.5);
    usePlaybackStore.getState().setCurrentTime(0); // reset shared singleton
  });
});
```

- [ ] **Step 4: Run**

Run (workdir `frontend`): `npm test`
Expected: 2 passed

- [ ] **Step 5: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/vitest.config.ts frontend/vitest.setup.ts frontend/lib
git commit -m "chore: set up vitest + RTL for frontend unit tests"
```

---

### Task 6: Safe redirect validation (B2)

**Files:**
- Create: `frontend/lib/safeRedirect.ts`
- Test: `frontend/lib/__tests__/safeRedirect.test.ts`
- Modify: `frontend/app/auth/page.tsx` (two call sites)

**Interfaces:**
- Produces: `safeRedirectPath(raw: string | null | undefined): string` — returns the path iff it starts with a single `/`, else `"/"`

- [ ] **Step 1: Write the failing test**

Create `frontend/lib/__tests__/safeRedirect.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { safeRedirectPath } from "../safeRedirect";

describe("safeRedirectPath", () => {
  it.each([
    [null, "/"],
    [undefined, "/"],
    ["", "/"],
    ["/calendar", "/calendar"],
    ["/analyze/abc?x=1", "/analyze/abc?x=1"],
    ["//evil.com", "/"],                    // protocol-relative open redirect
    ["//evil.com/back", "/"],
    ["/\\\\evil.com", "/"],                 // backslash trick
    ["https://evil.com", "/"],              // absolute URL
    ["javascript:alert(1)", "/"],
    ["calendar", "/"],                      // relative, not root-relative
  ])("safeRedirectPath(%j) === %j", (input, expected) => {
    expect(safeRedirectPath(input)).toBe(expected);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run (workdir `frontend`): `npx vitest run lib/__tests__/safeRedirect.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `frontend/lib/safeRedirect.ts`:

```ts
// Only allow same-origin root-relative paths (AUDIT B2: ?redirect=//evil.com).

export function safeRedirectPath(raw: string | null | undefined): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) {
    return "/";
  }
  return raw;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run lib/__tests__/safeRedirect.test.ts`
Expected: 11 passed

- [ ] **Step 5: Wire into auth page**

In `frontend/app/auth/page.tsx` add the import near the top:

```ts
import { safeRedirectPath } from "../../lib/safeRedirect";
```

Replace the OAuth-effect redirect block (lines ~34–38):

```ts
      if (redirect && redirect.startsWith("/")) {
        router.replace(redirect);
      } else {
        router.replace("/");
      }
```

with:

```ts
      router.replace(safeRedirectPath(redirect));
```

And in `handleSubmit` (lines ~85–90), replace:

```ts
        const redirect = searchParams.get("redirect");
        if (redirect && redirect.startsWith("/")) {
          router.replace(redirect);
        } else {
          router.replace("/");
        }
```

with:

```ts
        router.replace(safeRedirectPath(searchParams.get("redirect")));
```

- [ ] **Step 6: Verify build + commit**

Run (workdir `frontend`): `npm run build`
Expected: build completes without type errors.

```bash
git add frontend/lib/safeRedirect.ts frontend/lib/__tests__/safeRedirect.test.ts frontend/app/auth/page.tsx
git commit -m "fix: validate OAuth/login redirect targets against open redirects (B2)"
```

---

### Task 7: Cancellable upload-status polling (B6)

**Files:**
- Create: `frontend/lib/pollJobStatus.ts`
- Test: `frontend/lib/__tests__/pollJobStatus.test.ts`
- Modify: `frontend/app/upload/page.tsx` (both polling blocks + unmount cleanup)

**Interfaces:**
- Produces: `pollJobStatus(apiBase: string, jobId: string, onUpdate: (u: JobStatusUpdate) => void, intervalMs?: number): () => void` — returns a cancel function; auto-stops on `done`/`error`. `JobStatusUpdate = { status: string; progress?: number; transcript?: string; file_id?: string; error?: string }`

- [ ] **Step 1: Write the failing test**

Create `frontend/lib/__tests__/pollJobStatus.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { pollJobStatus } from "../pollJobStatus";

const jsonResponse = (body: unknown) =>
  ({ ok: true, json: async () => body }) as Response;

describe("pollJobStatus", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("emits an update on every tick", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ status: "transcribing", progress: 50 })));
    const updates: string[] = [];
    pollJobStatus("http://x", "j1", (u) => updates.push(u.status));
    await vi.advanceTimersByTimeAsync(2000);
    await vi.advanceTimersByTimeAsync(2000);
    expect(updates).toEqual(["transcribing", "transcribing"]);
  });

  it("auto-stops once the job reaches done", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ status: "done", file_id: "f1" }));
    vi.stubGlobal("fetch", fetchMock);
    const updates: string[] = [];
    pollJobStatus("http://x", "j1", (u) => updates.push(u.status));
    await vi.advanceTimersByTimeAsync(2000);
    await vi.advanceTimersByTimeAsync(10000);
    expect(updates).toEqual(["done"]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("cancel() stops polling immediately", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ status: "queued" }));
    vi.stubGlobal("fetch", fetchMock);
    const updates: string[] = [];
    const cancel = pollJobStatus("http://x", "j1", (u) => updates.push(u.status));
    await vi.advanceTimersByTimeAsync(2000);
    cancel();
    await vi.advanceTimersByTimeAsync(20000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(updates).toEqual(["queued"]);
  });

  it("ignores non-ok responses and network errors", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce({ ok: false } as Response)
      .mockResolvedValue(jsonResponse({ status: "done" }));
    vi.stubGlobal("fetch", fetchMock);
    const updates: string[] = [];
    pollJobStatus("http://x", "j1", (u) => updates.push(u.status));
    await vi.advanceTimersByTimeAsync(6000);
    expect(updates).toEqual(["done"]);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run (workdir `frontend`): `npx vitest run lib/__tests__/pollJobStatus.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `frontend/lib/pollJobStatus.ts`:

```ts
// Polls /upload/status/{jobId} until the job reaches a terminal state.
// Returns a cancel() function so callers can clean up on unmount (AUDIT B6).

export type JobStatusUpdate = {
  status: string;
  progress?: number;
  transcript?: string;
  file_id?: string;
  error?: string;
};

export function pollJobStatus(
  apiBase: string,
  jobId: string,
  onUpdate: (update: JobStatusUpdate) => void,
  intervalMs = 2000
): () => void {
  let timer: ReturnType<typeof setInterval> | null = null;

  const stop = () => {
    if (timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  };

  timer = setInterval(async () => {
    try {
      const res = await fetch(`${apiBase}/upload/status/${jobId}`);
      if (!res.ok) return; // wait for next tick
      const data: JobStatusUpdate = await res.json();
      onUpdate(data);
      if (data.status === "done" || data.status === "error") stop();
    } catch {
      // network hiccup during polling — retry next tick
    }
  }, intervalMs);

  return stop;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run lib/__tests__/pollJobStatus.test.ts`
Expected: 4 passed

- [ ] **Step 5: Wire into upload page**

In `frontend/app/upload/page.tsx`:

Add import:

```ts
import { pollJobStatus } from "../../lib/pollJobStatus";
```

Inside `UploadPageInner`, next to `const hasFetched = useRef(false);` add:

```ts
  const cancelPollingRef = useRef<(() => void) | null>(null);

  // B6: never leak polling intervals across navigation
  useEffect(() => {
    return () => cancelPollingRef.current?.();
  }, []);
```

Replace the URL-mode polling block in `handleUrlProcess` (lines ~64–89, the whole `const interval = setInterval(...)` assignment) with:

```ts
      // 2. Poll the status endpoint every 2 seconds
      cancelPollingRef.current = pollJobStatus(API_BASE, jobId, (s) => {
        setProgress(s.progress || 0);
        if (s.status === "done") {
          setStatus("done");
          setTranscript(s.transcript || "");
          if (s.file_id) {
            setFileId(s.file_id);
            triggerAnalysis(s.file_id);
          }
        } else if (s.status === "error") {
          setStatus("error");
          setError(s.error || "Failed to process video.");
        } else {
          setStatus(s.status as Status);
        }
      });
```

Replace the file-mode polling block in `handleFileSubmit`'s XHR `load` handler (lines ~147–171) with:

```ts
          // The upload is finished, now start polling the background task
          cancelPollingRef.current = pollJobStatus(API_BASE, jobId, (s) => {
            if (s.status === "done") {
              setProgress(100);
              setStatus("done");
              setTranscript(s.transcript || "");
              if (s.file_id) {
                setFileId(s.file_id);
                triggerAnalysis(s.file_id);
              }
            } else if (s.status === "error") {
              setStatus("error");
              setError(s.error || "Failed to process video.");
            } else {
              setStatus(s.status as Status);
            }
          });
```

(Note: file-mode intentionally keeps its XHR-driven progress bar; only status comes from polling.)

- [ ] **Step 6: Verify + commit**

Run (workdir `frontend`): `npm test && npm run build`
Expected: all vitest suites pass; build succeeds.

```bash
git add frontend/lib/pollJobStatus.ts frontend/lib/__tests__/pollJobStatus.test.ts frontend/app/upload/page.tsx
git commit -m "fix: cancellable upload-status polling, clear intervals on unmount (B6)"
```

---

### Task 8: Calendar API helpers with res.ok checks (B7)

**Files:**
- Create: `frontend/lib/calendarApi.ts`
- Test: `frontend/lib/__tests__/calendarApi.test.ts`
- Modify: `frontend/app/calendar/page.tsx` (posts effect, handleSchedule, updateStatus)

**Interfaces:**
- Consumes: backend `/calendar/schedule`, `/calendar/posts/{episodeId}`, `/calendar/posts/{postId}/status`
- Produces:
  - `scheduleEpisode(apiBase, episodeId, startDate): Promise<void>` — throws Error(server detail) on !ok
  - `fetchPosts(apiBase, episodeId): Promise<CalendarPost[]>` — throws on !ok
  - `updatePostStatus(apiBase, postId, newStatus): Promise<void>` — throws on !ok
  - `type CalendarPost = { id: string; status: string; [k: string]: unknown }`

- [ ] **Step 1: Write the failing test**

Create `frontend/lib/__tests__/calendarApi.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchPosts, scheduleEpisode, updatePostStatus } from "../calendarApi";

const jsonResponse = (body: unknown, ok = true) =>
  ({ ok, status: ok ? 200 : 500, json: async () => body }) as Response;

afterEach(() => vi.unstubAllGlobals());

describe("fetchPosts", () => {
  it("returns the posts array", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ data: { posts: [{ id: "p1" }] } })));
    await expect(fetchPosts("http://x", "e1")).resolves.toEqual([{ id: "p1" }]);
  });

  it("throws on HTTP error with server detail", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ detail: "No schedulable content" }, false)));
    await expect(fetchPosts("http://x", "e1")).rejects.toThrow("No schedulable content");
  });

  it("returns [] when payload is missing", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({})));
    await expect(fetchPosts("http://x", "e1")).resolves.toEqual([]);
  });
});

describe("scheduleEpisode", () => {
  it("resolves quietly on success", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ success: true }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(scheduleEpisode("http://x", "e1", "2026-08-22")).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith(
      "http://x/calendar/schedule",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("throws on HTTP error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ detail: "Episode not found" }, false)));
    await expect(scheduleEpisode("http://x", "e1", "2026-08-22")).rejects.toThrow("Episode not found");
  });
});

describe("updatePostStatus", () => {
  it("throws on HTTP error so callers can avoid optimistic lies", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ detail: "bad id" }, false)));
    await expect(updatePostStatus("http://x", "p1", "posted")).rejects.toThrow("bad id");
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run (workdir `frontend`): `npx vitest run lib/__tests__/calendarApi.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `frontend/lib/calendarApi.ts`:

```ts
// Calendar endpoints with strict res.ok checking (AUDIT B7: the calendar page
// previously showed success toasts even on 500s).

export type CalendarPost = {
  id: string;
  status: string;
  [key: string]: unknown;
};

async function detailOf(res: Response): Promise<string> {
  try {
    const data = await res.json();
    if (Array.isArray(data.detail)) return data.detail[0]?.msg || "Request failed";
    return data.detail || `Request failed (${res.status})`;
  } catch {
    return `Request failed (${res.status})`;
  }
}

export async function scheduleEpisode(
  apiBase: string,
  episodeId: string,
  startDate: string
): Promise<void> {
  const res = await fetch(`${apiBase}/calendar/schedule`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ episode_id: episodeId, start_date: startDate }),
  });
  if (!res.ok) throw new Error(await detailOf(res));
}

export async function fetchPosts(apiBase: string, episodeId: string): Promise<CalendarPost[]> {
  const res = await fetch(`${apiBase}/calendar/posts/${episodeId}`);
  if (!res.ok) throw new Error(await detailOf(res));
  const data = await res.json();
  return data.data?.posts || [];
}

export async function updatePostStatus(
  apiBase: string,
  postId: string,
  newStatus: string
): Promise<void> {
  const res = await fetch(`${apiBase}/calendar/posts/${postId}/status?status=${newStatus}`, {
    method: "PATCH",
  });
  if (!res.ok) throw new Error(await detailOf(res));
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run lib/__tests__/calendarApi.test.ts`
Expected: 6 passed

- [ ] **Step 5: Wire into calendar page**

In `frontend/app/calendar/page.tsx` add:

```ts
import { fetchPosts, scheduleEpisode, updatePostStatus } from "../../lib/calendarApi";
```

Replace the posts-loading effect (lines ~160–174) with:

```ts
  // Load posts securely when episode changes
  useEffect(() => {
    if (!selectedEpisode) return;
    setStatus("loading");
    fetchPosts(API_BASE, selectedEpisode)
      .then((payload) => {
        setPosts(payload as Post[]);
        setStatus(payload.length > 0 ? "done" : "idle");
      })
      .catch((err) => {
        console.error(err);
        setStatus("idle");
      });
  }, [selectedEpisode]);
```

Replace `handleSchedule` (lines ~177–204) with:

```ts
  // Generate 30-day schedule
  const handleSchedule = async () => {
    if (!selectedEpisode) return;
    setScheduling(true);

    try {
      await scheduleEpisode(API_BASE, selectedEpisode, startDate);
      const scheduledPosts = await fetchPosts(API_BASE, selectedEpisode);
      setPosts(scheduledPosts as Post[]);
      setStatus(scheduledPosts.length > 0 ? "done" : "idle");
      showToast("30-Day Plan Generated!");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Scheduling failed.");
    } finally {
      setScheduling(false);
    }
  };
```

Replace `updateStatus` (lines ~207–215) with:

```ts
  // Mark post as posted/skipped
  const updateStatus = async (postId: string, newStatus: string) => {
    try {
      await updatePostStatus(API_BASE, postId, newStatus);
      setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, status: newStatus } : p)));
      if (newStatus === "posted") showToast("Post marked as successful!");
    } catch {
      showToast("Failed to update status");
    }
  };
```

- [ ] **Step 6: Verify + commit**

Run (workdir `frontend`): `npm test && npm run build`
Expected: all suites pass; build succeeds.

```bash
git add frontend/lib/calendarApi.ts frontend/lib/__tests__/calendarApi.test.ts frontend/app/calendar/page.tsx
git commit -m "fix: check res.ok on calendar schedule/status updates, surface server errors (B7)"
```

---

### Task 9: Analyze page consumes storage_path + polls until terminal (A6/A7 frontend)

**Files:**
- Modify: `frontend/app/analyze/[id]/page.tsx` (polling effect lines ~155–233)

**Interfaces:**
- Consumes: `episode.storage_path` and `analysis_status` from Tasks 3–4 backend responses
- Produces: working audio playback for file uploads; results UI only finalizes when analysis reaches a terminal state

- [ ] **Step 1: Use storage_path for media URL**

In the polling effect's `res.ok` branch, replace:

```ts
          if (data.episode?.filename) {
            setAudioUrl(`${API_BASE}/files/${data.episode.filename}`);
          }
```

with:

```ts
          const mediaFile = data.episode?.storage_path || data.episode?.filename;
          if (mediaFile) {
            setAudioUrl(`${API_BASE}/files/${mediaFile}`);
          }
```

- [ ] **Step 2: Poll until terminal analysis_status (with attempt cap)**

At the top of the effect, change the retry bookkeeping:

```ts
    let isCancelled = false;
    let retryCount = 0;
    let attempts = 0;
    let timerId: NodeJS.Timeout;
    const MAX_ATTEMPTS = 60; // ~3 minutes at 3s intervals
```

Replace everything from `if (res.status === 404)` through `setStatusText("Complete"); setIsSyncing(false); setError(null);` with:

```ts
        attempts++;

        if (attempts > MAX_ATTEMPTS) {
          setIsSyncing(false);
          setStatusText("Timed out");
          setError("Analysis is taking too long. Refresh this page in a minute.");
          return;
        }

        if (res.status === 404) {
          retryCount++;
          timerId = setTimeout(pollAnalysis, 3000);
          return;
        }

        if (!res.ok) {
          throw new Error(`Server returned ${res.status}`);
        }

        const data = await res.json();
        if (isCancelled) return;

        setFullAnalysis(data);

        setEpisodeMetadata({
          title: data.episode?.title || "Untitled Podcast",
          summary: data.episode?.summary || data.episode_summary || ""
        });

        const mediaFile = data.episode?.storage_path || data.episode?.filename;
        if (mediaFile) {
          setAudioUrl(`${API_BASE}/files/${mediaFile}`);
        }

        if (data.episode?.duration) {
          setTotalDuration(data.episode.duration);
        }

        if (data.topics_discussed && data.topics_discussed.length > 0) {
          setTopics(data.topics_discussed);
        } else if (data.main_themes && data.main_themes.length > 0) {
          setTopics(data.main_themes);
        }

        // A7: only treat the analysis as finished when the server says so
        const status = data.analysis_status || "pending";
        if (status === "pending") {
          setStatusText(`AI analysis running... (${attempts * 3}s)`);
          timerId = setTimeout(pollAnalysis, 3000);
          return;
        }

        if (status === "error") {
          setIsSyncing(false);
          setStatusText("Analysis failed");
          setError("AI analysis failed. Go back to the upload page and retry.");
          return;
        }

        if (data.clips && data.clips.length > 0) {
          const mappedClips: FrontendClip[] = data.clips.map((c: any, i: number) => ({
            id: `clip-${i}`,
            title: c.title || `Clip ${i + 1}`,
            viralScore: c.viral_score || 0,
            duration: `${formatTime(c.start_time)} - ${formatTime(c.end_time)}`,
            startTime: c.start_time || 0,
            endTime: c.end_time || 0,
            summary: c.summary || "",
            originalHook: c.hook_original || "",
            aiHook: c.hook_rewritten || "",
            clipType: c.clip_type || "insight",
            whyViral: c.why_viral || ""
          }));
          setClips(mappedClips);
        }

        setStatusText("Complete");
        setIsSyncing(false);
        setError(null);
```

(The old `else { throw ... }` branch and the trailing clip/topic mapping move into the flow above — make sure no duplicated mapping code remains.)

- [ ] **Step 3: Verify**

Run (workdir `frontend`): `npm test && npm run build`
Expected: all vitest suites pass; production build succeeds with no type errors.

- [ ] **Step 4: Manual smoke check (dev servers)**

With `uvicorn` + `npm run dev` running: upload a small MP4 → confirm the player plays (previously silent 404) → click through to `/analyze/{id}` → observe "AI analysis running..." spinner until tabs populate.

- [ ] **Step 5: Commit**

```bash
git add frontend/app/analyze/[id]/page.tsx
git commit -m "fix: play media via storage_path and poll analysis until terminal state (A6/A7)"
```

---

## Self-Review Notes

- **Spec coverage:** Phase 0 items from AUDIT.md §E: A8 fail-fast ✓ (Task 2; key rotation is the flagged manual prerequisite), A6 ✓ (Tasks 3+9), A7 ✓ (Tasks 4+9), B2 ✓ (Task 6), B6 ✓ (Task 7), B7 ✓ (Task 8), B14 ✓ (Task 1).
- **Placeholder scan:** none — every step has complete code.
- **Type consistency:** `storage_path` / `analysis_status` names match across DB columns, route payloads, and frontend reads; `pollJobStatus` signature matches its upload-page usage; `safeRedirectPath` matches both auth-page call sites.
