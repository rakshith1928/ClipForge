# Podclip / ClipForge — Full Engineering Audit

**Date:** 2026-08-16
**Scope:** `backend/` (FastAPI + Celery, Python 3.13), `frontend/` (Next.js 16 + React 19 + Tailwind v4), root files
**Verification notes:**
- All 26 existing tests pass (`backend/venv` + `pytest`).
- `backend/.env` was **never committed** to git (checked full history with `git log --all`); `.gitignore` correctly excludes it along with `uploads/`, `venv/`, `node_modules/`, `.next/`.
- No code was modified during this audit.

**Severity legend:** Critical > High > Medium > Low.

---

## A. Critical / High findings

### A1. No authentication on any business route

- **Severity:** Critical (Security)
- **Location:** `backend/routes/upload.py`, `analyze.py`, `generate.py`, `calendar.py` — every router
- **Problem:** `get_current_user` is defined (`auth.py:77`) but only used by `/auth/me` (`auth.py:232`). None of `/upload`, `/upload/url`, `/upload/status/{job_id}`, `/analyze*`, `/generate/*`, `/calendar/*` require it. `backend/middleware.py` is dead code (never imported). The frontend also never sends an `Authorization` header.
- **Why it matters:** Anyone on the internet can read **any** episode's full transcript (IDOR via `/upload/status/{job_id}` and `/analyze/{file_id}`), burn Groq/Deepgram/FFmpeg spend, download arbitrary user media via `/files/`, and mutate `ScheduledPost.status` for anyone. The whole auth system (register/login/OAuth/refresh) exists but protects nothing.
- **Evidence:**
  ```python
  @router.get("/upload/status/{job_id}")   # no Depends
  async def get_job_status(job_id: str):
  ...
  @router.post("/analyze")                  # no Depends
  async def analyze_transcript(body: AnalyzeRequest):
  ```
  `grep get_current_user` → only `auth.py:232` and the dead `middleware.py`.
- **Recommended fix:**
  1. Add `Depends(get_current_user)` to all four routers.
  2. Actually set `Episode.user_id` (and `ScheduledPost.user_id`) at creation — currently always NULL, so the `User.episodes` relationship is dead.
  3. Scope every query: `db.query(Episode).filter(Episode.id == file_id, Episode.user_id == current_user.id)`.
  4. Frontend: attach `Authorization: Bearer` in a shared fetch wrapper (see C5).
  5. Delete or implement `middleware.py`.

### A2. SSRF + unbounded server-side download via `POST /upload/url`

- **Severity:** High (Security)
- **Location:** `backend/routes/upload.py:253-306` (`start_upload_from_url`), `backend/worker.py:88-177` (`process_url_job`)
- **Problem:** The URL is passed straight to yt-dlp with **no domain allowlist or address validation**. `extract_info(url, download=False)` and later `ydl.download([url])` make the server fetch arbitrary URLs — including internal ones (`http://169.254.169.254/...`, `127.0.0.1:6379`, LAN hosts). There is also no download size cap, and the file is kept on disk permanently.
- **Why it matters:** Unauthenticated (see A1) SSRF against cloud metadata / internal services, plus a disk-filling vector (arbitrary file downloaded and never cleaned).
- **Evidence:**
  ```python
  ydl = YoutubeDL({"outtmpl": str(video_path), "quiet": True})
  info = await loop.run_in_executor(None, ydl.extract_info, body.url, False)  # arbitrary URL
  ```
  The only guard is a 1-hour *duration* check, which does nothing against non-video/internal targets.
- **Recommended fix:** Whitelist hosts (`youtube.com`, `youtu.be`, `youtube-nocookie.com`, …); validate the parsed URL scheme is http/https and that resolved IPs are not private/loopback/link-local; set `max_filesize` and `socket_timeout`; apply retention/cleanup (see C4).

### A3. No upload size limit; whole audio read into memory

- **Severity:** High (Security / Reliability)
- **Location:** `backend/routes/upload.py:157-250`, `backend/worker.py:30-36`
- **Problem:** `save_upload` streams 1 MB chunks with **no maximum** (UI claims "up to 2 GB"). In the worker, `transcribe_audio` does `audio = audio_path.read_bytes()` — a 2 GB `.wav` upload (allowed content-type) means ~2 GB+ of RAM per request, with no auth (A1) and no rate limiting (A5).
- **Why it matters:** Trivial disk exhaustion and OOM crash of the worker; each job holds the file forever (no retention policy).
- **Recommended fix:** Count bytes while streaming and 413 above a cap (e.g., 2 GB); stream to Deepgram in chunks or cap audio duration; enforce retention (see C4).

### A4. Blocking calls inside `async def` routes stall the entire server

- **Severity:** High (Bug / Architecture)
- **Location:** `backend/routes/analyze.py:77-252`, `backend/routes/generate.py:127-187`
- **Problem:** Two long, blocking operations run directly on the event loop:
  1. `POST /analyze` — the **synchronous** Groq SDK call (`client.chat.completions.create`, typically 30–60 s) inside an async route.
  2. `POST /generate/clip` — `subprocess.run([...ffmpeg ... libx264 ...])` (minutes for long clips) inside an async route.
- **Why it matters:** While one request is encoding/analyzing, *every other request on that worker* (health checks, status polling, uploads) is stalled. Under even mild concurrency this makes the API unusable.
- **Evidence:**
  ```python
  async def analyze_transcript(body: AnalyzeRequest):
      ...
  completion = client.chat.completions.create(...)   # sync client, blocks loop
  ```
- **Recommended fix:** Convert both to Celery tasks (the worker infrastructure already exists) returning a job id, or at minimum wrap with `await loop.run_in_executor(None, ...)`. The Celery approach also fixes A7.

### A5. Anonymous access to expensive compute + no rate limiting = cost DoS

- **Severity:** High (Security / Ops)
- **Location:** all of the above (Groq, Deepgram, yt-dlp, FFmpeg)
- **Problem:** Combined with A1: no auth, no rate limits, no per-user quotas anywhere in the stack.
- **Why it matters:** An anonymous attacker can loop `/upload/url` + `/analyze` to burn LLM/ASR API credits and CPU indefinitely. This is the most likely way this project gets a large bill.
- **Recommended fix:** A1 (auth) + `slowapi` (or gateway-level) rate limits per IP/user + per-user daily quotas on analyze/clip endpoints + alerting on API spend.

### A6. Audio playback is broken for file uploads (core feature)

- **Severity:** High (Bug)
- **Location:** `backend/worker.py:49` vs `frontend/app/analyze/[id]/page.tsx:92`
- **Problem:** For file uploads the worker stores `Episode.filename = original_filename` (e.g., `"My Podcast.mp4"`), but the file on disk is `{uuid}.mp4`. The frontend builds the player URL as:
  ```ts
  setAudioUrl(`${API_BASE}/files/${data.episode.filename}`)   // → /files/My%20Podcast.mp4 → 404
  ```
  So the transcript player, word highlighting, and **all clip preview playback are silently dead for every file upload** (they only work for URL uploads, where `filename` happens to be the on-disk name). The `play()` rejection is swallowed by `catch` — no error surfaces.
- **Why it matters:** The central "find viral moments and preview them" flow does not work for the primary input type (direct file upload).
- **Evidence:** `worker.py:49 filename=original_filename`; `upload.py:194-195` saves as `str(uuid4()) + ext`; `uploads/` contains only UUID-named files.
- **Recommended fix:** Store the on-disk basename (add a `storage_path` column; keep `filename` for display), and add an end-to-end test that asserts `GET /files/{episode.filename}` returns 200.

### A7. Analysis results page renders a permanent blank "Complete" state (race)

- **Severity:** High (Bug)
- **Location:** `frontend/app/upload/page.tsx:353-364` vs `backend/routes/analyze.py:278-400`
- **Problem:** On job completion the upload page fires `POST /analyze` **fire-and-forget** (no one awaits it), then the user clicks "Find Viral Clips" → `/analyze/{id}`. `GET /analyze/{file_id}` returns **200 the moment the Episode row exists** (the worker created it at transcription time) with empty `clips/quotes/threads` because the LLM hasn't finished. The frontend treats any 200 as final: `setIsSyncing(false)` → empty tabs, "AI Analysis Complete", no re-poll. Result: a dead results page until manual refresh.
- **Why it matters:** With a 30–60 s LLM call, most users who click promptly will hit this. It is the most visible UX bug in the app.
- **Recommended fix:** Model analysis state server-side (`Episode.analysis_status: pending|complete|error`, updated by an analyze **Celery task** instead of the fire-and-forget POST); keep polling `GET /analyze/{id}` until the status is terminal. This also fixes A4 at the same time.

### A8. Live secrets on disk; insecure silent fallbacks

- **Severity:** High (Security)
- **Location:** `backend/.env`; `backend/auth.py:17`; `backend/main.py:17-19`
- **Problem:** `backend/.env` holds real keys (Deepgram, Gemini, Groq, Postgres password, Google OAuth, JWT `SECRET_KEY`). It was **never committed** to git (good), but it sits unencrypted in the dev repo, and there is no evidence these keys have ever been rotated or are dev-only. Separately, the code silently falls back to `"changeme"` (JWT) and `"changeme_session_secret"` (sessions) when env vars are missing — a missing variable doesn't fail, it silently produces a world-guessable signing key.
- **Why it matters:** One mis-`git add` or one production deploy with an unset var and every JWT ever issued is forgeable.
- **Recommended fix:** Treat all keys in that file as compromised → rotate them; move secrets to a secret manager or at minimum outside the repo tree; make `SECRET_KEY`/DB password **required** (fail fast at startup unless `ENVIRONMENT=dev`).

---

## B. Medium / Low findings

### B1. OAuth tokens delivered in URL query params

- **Severity:** Medium (Security)
- **Location:** `backend/auth.py:256-285`; `frontend/app/auth/page.tsx:52-82`
- **Problem:** Callback redirects to `/auth?token=…&refresh=…` → both tokens land in browser history, and potentially server/proxy logs and `Referer` headers. The frontend stores them in `localStorage` (XSS-exfiltrable) and never strips them from the URL.
- **Recommended fix:** Short-lived single-use code exchanged via `POST` for tokens; or httpOnly `Secure` cookies; at minimum `window.history.replaceState` to clear the query string immediately on receipt.

### B2. Open redirect on the auth page

- **Severity:** Medium (Security)
- **Location:** `frontend/app/auth/page.tsx:57, 95-99`
- **Problem:** `redirect.startsWith("/")` is the only check — `?redirect=//evil.com` passes (protocol-relative), so a logged-in victim following a crafted link is sent to an external site after authenticating.
- **Recommended fix:** `redirect.startsWith("/") && !redirect.startsWith("//")`, ideally an allowlist of internal paths.

### B3. Exception details leaked to clients

- **Severity:** Medium (Security)
- **Location:** `auth.py:212`, `analyze.py:250`, `generate.py:185`, `calendar.py:211`, `upload.py:299`
- **Problem:** `detail=str(e)` returns raw exceptions to the client — SQLAlchemy/psycopg2 error text on register race (duplicate email), Groq SDK errors, and FFmpeg stderr containing **absolute server paths**.
- **Recommended fix:** `logger.exception(...)` server-side; return a generic `detail` to the client.

### B4. Stuck jobs: no Celery retries, timeouts, or recovery

- **Severity:** Medium (Reliability)
- **Location:** `backend/celery_app.py`, `backend/worker.py`
- **Problem:** If the worker dies or Deepgram hangs mid-job, `Job.status` stays `"transcribing"` forever; the frontend polls indefinitely. No `time_limit`/`soft_time_limit`, no `acks_late`, no retry, no sweeper for stale jobs.
- **Recommended fix:** `task_acks_late=True`, `autoretry_for` with backoff for transient (network) errors, hard `time_limit`, plus a periodic Celery beat task that fails jobs stuck > N minutes and cleans their files.

### B5. Orphaned job + file if broker is down

- **Severity:** Medium (Reliability)
- **Location:** `backend/routes/upload.py:237-250`
- **Problem:** The file is saved and the `Job` row committed **before** `process_file_job.delay()`. If Redis is unreachable, the client gets a 500, the job is stuck at `"uploading"` forever, and the file is orphaned (the only cleanup is in the worker's `finally`).
- **Recommended fix:** Wrap `.delay()` in try/except → mark job `"failed"` and delete the saved file on dispatch failure; log loudly.

### B6. Upload page leaks polling intervals on unmount

- **Severity:** Medium (Frontend bug)
- **Location:** `frontend/app/upload/page.tsx:145-184` (file mode), `186-244` (URL mode)
- **Problem:** Both `setInterval`s are created inside async callbacks and never cleared; if the user navigates away mid-upload, the intervals keep polling `/upload/status/...` forever (leak + setState-after-unmount).
- **Recommended fix:** Track interval ids in refs; clear them in a `useEffect` cleanup and on completion.

### B7. Calendar page ignores HTTP errors

- **Severity:** Medium (Frontend bug)
- **Location:** `frontend/app/calendar/page.tsx:96-116`
- **Problem:** `handleSchedule` never checks `res.ok` — on a 500 (e.g., "No schedulable content") it still shows **"30-Day Plan Generated!"** then reloads stale posts. `updateStatus` likewise updates optimistically without any response validation.
- **Recommended fix:** Check `res.ok` on both fetches; show an error toast otherwise; roll back optimistic state on failure.

### B8. Frontend auth state is client-trusted and incomplete

- **Severity:** Medium (Frontend / Security)
- **Location:** `frontend/app/context/AuthContext.tsx`
- **Problem:** `checkAuth` only checks the token's local `exp` — it **never calls `/auth/me`**, so a deleted user (or a token issued under a different `SECRET_KEY`) still appears logged in. Also, the OAuth flow saves tokens but never saves the `user` object, so after OAuth login `isLoggedIn=true` with `user=null`.
- **Recommended fix:** Validate against `/auth/me` on boot (and reuse its response as the user object); handle 401 there with a refresh attempt.

### B9. Missing numeric/format validation

- **Severity:** Low (Bug)
- **Location:** `backend/routes/generate.py:26-34, 64-72`
- **Problem:** `ClipRequest.start_time/end_time` accept negatives and `NaN`/`Infinity` (pydantic parses JSON `NaN` as float) → `str(nan)` reaches ffmpeg → 500. Quote-card colors are interpolated into Pillow (`accent_color + "40"`) — a non-hex input throws → 500 with leaked message (B3).
- **Recommended fix:** `Field(ge=0)`, `model_validator` for `end_time > start_time`, regex `^#[0-9a-fA-F]{6}$` for colors.

### B10. UI copy and backend disagree on accepted formats

- **Severity:** Low (Integration)
- **Location:** `frontend/app/upload/page.tsx:455-462` vs `backend/routes/upload.py:160`
- **Problem:** UI promises "MP4, MOV, and AVI up to 2 GB"; backend allowlist is `video/mp4, video/quicktime, audio/mpeg, audio/wav, audio/mp3` — **AVI is rejected**, and the 2 GB cap is not enforced (see A3). The auth page's "8+ characters, at least 1 special character" also omits the server's required digit (`auth.py:20`).
- **Recommended fix:** Align allowlist with copy (or fix copy), enforce the cap server-side, match password rule text.

### B11. Fragile handling of LLM output

- **Severity:** Low (Bug)
- **Location:** `backend/routes/analyze.py:151-160`
- **Problem:** `quote["text"]` (KeyError if the model omits it), no retry on Groq 429/5xx, and the fallback Episode stores `transcript[:500]` while reporting the real `word_count` (inconsistent data that later pages will serve).
- **Recommended fix:** Use `.get()` with skip-on-missing; add a bounded retry with backoff; store the full transcript in the fallback path.

### B12. Register race → 500

- **Severity:** Low (Bug)
- **Location:** `backend/auth.py:199-213`
- **Problem:** Check-then-insert; concurrent duplicate registrations hit `IntegrityError` → generic 500 with DB error text (also B3).
- **Recommended fix:** Catch `IntegrityError` specifically → 409 "Email already registered".

### B13. Configuration sprawl

- **Severity:** Low (Architecture)
- **Location:** `backend/main.py:43`, `upload.py:18`, `generate.py:15`, `auth.py:17`
- **Problem:** `UPLOAD_DIR` is defined separately in two modules with an env override, while `main.py` hardcodes `StaticFiles(directory="uploads")` — if the env var points elsewhere, `/files` serves the wrong directory. `SECRET_KEY` has **two different** insecure defaults in two modules. `load_dotenv()` is called in 4+ modules, so config depends on import order (e.g., `auth.py` reads env at import time).
- **Recommended fix:** One `config.py` (pydantic-settings) imported by everyone; mount `/files` from the same `UPLOAD_DIR`; single `SECRET_KEY` accessor.

### B14. Dependency file doesn't match reality

- **Severity:** Low (Ops)
- **Location:** `backend/requirements.txt`
- **Problem:** Unpinned and drifted: file says `sqlalchemy<2`, the venv has **2.0.49** (the code still uses the legacy `declarative_base` import — works, deprecated). Code uses pydantic-**v1**-style `@validator` on installed pydantic 2.12 (deprecated; tests are configured to silence the warnings). `passlib` 1.7.4 is unmaintained.
- **Recommended fix:** Generate a lock file (`pip-compile`/uv) and install from it in CI; migrate to `field_validator`; consider dropping passlib for direct `bcrypt` calls.

### B15. Dead code and junk

- **Severity:** Low (Quality)
- **Location:** various
- **Problem:** `backend/auth.py:67 decode_token` (never called); `backend/middleware.py` (never imported); `User.episodes` relationship + `user_id` columns (never populated — see A1); `frontend/app/data/mockData.ts` (imported nowhere); root `download.py` (dev script containing an expired signed Google URL); root `postcss.config.mjs` + stray root `node_modules/` (Vite leftovers — the app is Next.js); `calendar.py:91 scheduled.append(1)` used as a counter; `print()` used for operational logging throughout the backend.
- **Recommended fix:** Delete the dead items; replace `print` with a configured `logging` setup (see C6).

### B16. Misc small items

- **Severity:** Low
- `backend/main.py:11-13` — `init_db()`/`create_engine` run at **import time** (side-effectful import; no migration story — see C3).
- `backend/main.py:15-19` — CORS hardcoded to `http://localhost:3000`; fine for dev, but there is no env-driven production story.
- `frontend/app/analyze/[id]/page.tsx:40-47` — an invalid id polls `404` forever with a permanent "Analyzing…" spinner (no max attempts / error state).
- `frontend/app/analyze/[id]/page.tsx:205-226` — `file_id` and `episode_id` are passed the same `params.id`; works only because the DB keeps them 1:1 by construction (fragile coupling; see A1/C2).
- `backend/routes/generate.py:178` — DB commit happens *after* ffmpeg; on commit failure the encoded file is orphaned (no cleanup on failure).

---

## C. Architecture improvements

1. **C1 — One async execution model.** The app has two overlapping mechanisms (HTTP request scope + Celery) and uses them inconsistently: transcription is Celery, but the *more expensive* operations (LLM analysis, clip encoding) run in-request and block the loop (A4, A7). Standardize: any operation > ~1 s is a Celery job with a `Job`-style status resource and polling/SSE. This also unifies progress reporting and retries.
2. **C2 — Enforce the user→data model end to end.** There is a `User` with FKs on every resource; nothing writes or reads them. Either implement ownership (A1) or delete the columns/relationship. Half-wired multi-tenancy is a latent bug factory (e.g., the dashboard page is a client-side "coming soon" stub while `GET /calendar/episodes` returns *all* users' episodes).
3. **C3 — Adopt a migration framework.** Schema changes currently happen via `Base.metadata.create_all()` at import (the column/sanitization fixes in commit history landed without a migration path). Add **Alembic** before the schema grows further; `create_all` only for fresh dev DBs.
4. **C4 — File storage layer + retention.** Uploads, extracted audio, and generated clips live in one flat `uploads/` dir with no lifecycle: originals are kept "forever for clip cutting" (worker comments), temp audio is cleaned but clips are never cleaned; disk grows unbounded (made worse by A3). Introduce a small storage abstraction (local now, S3-compatible later) with generated object keys, ownership metadata in the DB, and a retention sweeper.
5. **C5 — Single config module.** pydantic-settings-based `config.py` (see B13) with environment validation at startup.
6. **C6 — Structured logging.** Replace `print` with `logging` (or structlog) with request/job correlation ids — today there is no way to trace a job through API → worker → Deepgram/Groq when it fails.
7. **C7 — Frontend data layer.** The pages hand-roll fetch + polling + intervals (the source of B6/B7/A7). Adopt TanStack Query (caching, retries, stale-while-revalidate) and a thin API client that injects the auth header and handles 401→refresh→retry centrally.
8. **C8 — Share types between sides.** `FrontendClip` is a manually-mirrored copy of the backend's shape (with an `imageUrl` field the backend never sends). Generate TS types from the FastAPI OpenAPI schema to prevent drift.
9. **C9 — Test coverage gaps.** The 26 passing tests cover calendar logic and 404s. Zero coverage for: auth endpoints (register/login/refresh/OAuth state), the analyze pipeline (mock Groq), the worker pipeline (mock Deepgram), clip generation (ffmpeg present/absent), and the upload→playback contract that A6 broke. This is exactly the class of bug that goes unnoticed without an integration test that asserts `/files/{episode.filename}` is reachable.

---

## D. Security improvements

1. **D1 — Actually enforce authentication** (A1) + **D2 — Rate limiting & quotas** (A5): these two are ~80% of the security posture; nothing else is very meaningful without them.
2. **D3 — SSRF protection** (A2): domain allowlist + IP-range blocklist + `max_filesize`/timeouts on yt-dlp.
3. **D4 — Resource limits** (A3): server-side upload cap, 413 responses, streaming to Deepgram.
4. **D5 — Token handling** (B1/B8): out of URL and out of localStorage (httpOnly cookies or code-exchange), server-side session validation via `/auth/me`, refresh tokens with rotation (the refresh token is currently a static 7-day bearer with no revocation — adding a `jti` denylist/DB check would allow killing sessions).
5. **D6 — Fail fast on secrets** (A8): required-in-production validation, single `SECRET_KEY` source, rotation of everything currently in `backend/.env`, no secrets in the repo tree even untracked (`.env` outside the working dir or in a secret manager).
6. **D7 — Authorization on static files:** `/files` is an unauthenticated `StaticFiles` mount over all user content. Once A1 lands, serve generated clips via short-lived signed URLs (or an authenticated route) instead.
7. **D8 — Input validation pass** (B9/B10/B11/B12): constrained pydantic models everywhere; safe-by-default error responses (B3); register race → 409.
8. **D9 — Supply chain & CI gates:** pinned lock file (B14), `pip-audit` + `ruff` + `bandit` in CI, `npm audit` on the frontend. (The currently installed `python-jose` 3.5.0 and `pillow` 12.2.0 are current; the risk is the *unpinned* file, not today's install.)
9. **D10 — Production deployment surface:** env-driven CORS, HTTPS-only cookies, security headers middleware, and an access/audit log of who analyzed/uploaded/generated what (the data exists once `user_id` is populated).

---

## E. Suggested refactoring roadmap

### Phase 0 — Stop the bleeding (1–2 days)
- Rotate all keys in `backend/.env`; add fail-fast config checks (A8, D6).
- Fix A6 (store on-disk filename; e2e-assert `/files/...` 200) and A7 (add `analysis_status`; poll until terminal) — these two make the core product actually work.
- Frontend quick wins: B6 (interval cleanup), B7 (res.ok checks), B2 (redirect validation).
- Pin the backend lock file (B14).

### Phase 1 — Make it safe (week 1–2)
- A1: auth dependencies + user-scoped queries + frontend auth header (D1).
- A4/A7 complete: move `/analyze` and `/generate/clip` into Celery jobs with status polling.
- A2/A3/B9: URL allowlist + SSRF guards, upload caps, constrained models (D3/D4/D8).
- Rate limiting + quotas (D2).
- Worker reliability: retries, `acks_late`, timeouts, stale-job sweeper, file cleanup on dispatch failure (B4/B5).
- Generic error responses + structured logging (B3, C6).

### Phase 2 — Make it maintainable (weeks 3–4)
- C3 Alembic; C4 storage abstraction + retention; C5 config module; C1 full job-based async model.
- B1/B8: code-exchange OAuth flow (or httpOnly cookies), `/auth/me` validation, token revocation (D5).
- Frontend: TanStack Query + central API client (C7); generated TS types (C8).
- CI: pytest (with mocked Groq/Deepgram/ffmpeg) + ruff + bandit + pip-audit; add auth/analyze/worker test coverage (C9).

### Phase 3 — Production readiness (weeks 5–6+)
- E2E Playwright suite covering upload → transcribe → analyze → clip → calendar (would have caught A6/A7).
- Signed-URL file serving (D7), audit logging (D10), spend alerting (A5).
- Load-test concurrent clip encoding (C1) and decide on worker autoscaling.
- Real dashboard (currently a stub) backed by the now-user-scoped episodes.

### If you can only do five things, in priority order
1. **A1** — enforce authentication + user scoping.
2. **A6 + A7** — make the core upload → analyze → playback flow actually work.
3. **A2 + A3** — SSRF guards and size limits.
4. **A4** — stop blocking the event loop.
5. **A8** — rotate the exposed secrets.

Everything else is hardening on top of those.

---

## Appendix: Things that are already in good shape

- `.gitignore` correctly excludes `backend/.env`, `backend/uploads/`, `venv/`, `node_modules/`, `.next/`; none of these (or `.env`) appear in git history.
- Backend path-traversal guards in `generate.py` (`sanitize_filename`, `_ensure_within_upload_dir`) exist and are tested (commit `6e3077b` addressed review findings F1–F4).
- Frontend renders all user/LLM content through React text nodes; no `dangerouslySetInnerHTML` found.
- CORS is restricted to `http://localhost:3000` (dev-appropriate).
- `yt-dlp` is imported lazily (avoids import-time side effects); URL uploads have a max-duration cap.
- The 26-test backend suite passes and includes regression tests for the earlier ZeroDivisionError and lazy-import bugs.
- Frontend uses a proper state store (zustand) for playback with selector-scoped subscriptions.
