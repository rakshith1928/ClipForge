# Task 2 Report: Enforce Upload Size Limits & Streaming Caps (A3, D4, B9)

**Branch:** `feat/phase1b-hardening` (head `6e46645` → `a95c845`, base `5d05529`)
**Date:** 2026-08-31
**Author:** OpenCode (Muse Spark)

---

## 1. What was implemented

### 1.1 `backend/routes/upload.py:29-51` — Streaming upload capped at 2GB → 413

Exact code (matches brief verbatim):

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

Behavior:
- Streams in 1MB chunks via `await file.read(1024*1024)`
- Byte-counts `total`; on `> 2GB` closes handle, `unlink(missing_ok=True)`, raises `HTTPException(413)`
- No full-file buffering; partial file deleted on overflow

### 1.2 `backend/routes/generate.py:37-84` — ClipRequest + QuoteCardRequest validation

Exact code (matches brief verbatim, with Pydantic v2 `Field`+`validator`):

```python
from pydantic import BaseModel, validator, Field
import math
import re
HEX_COLOR_RE = re.compile(r"^#[0-9a-fA-F]{6}$")

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

```python
    @validator("bg_color", "text_color", "accent_color")
    def valid_hex_color(cls, v):
        if not HEX_COLOR_RE.match(v):
            raise ValueError("must be hex color like #0f0f0f")
        return v
```

Validates:
- `0 <= start_time < end_time` (Field ge=0 + end_after_start)
- Rejects `NaN`/`Inf` via `math.isnan`/`isinf`
- Hex colors `^#[0-9a-fA-F]{6}$` for `bg_color`, `text_color`, `accent_color`

### 1.3 Tests — `backend/tests/test_upload_limits.py` (4 tests)

Brief verbatim tests, with one environment fix for disk (see §4):

```python
import math
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch
import pytest
from fastapi import HTTPException
from routes.generate import ClipRequest
from routes.upload import save_upload

@pytest.mark.asyncio
async def test_save_upload_rejects_oversized():
    mock_file = MagicMock()
    mock_file.filename = "big.mp4"
    chunks = [b"x" * (1024*1024)] * 2049  # 2049 MB
    mock_file.read = AsyncMock(side_effect=chunks + [b""])
    mock_out = AsyncMock()
    with patch("aiofiles.open") as mock_aio_open, patch.object(Path, "unlink", return_value=None):
        mock_aio_open.return_value.__aenter__.return_value = mock_out
        mock_aio_open.return_value.__aexit__.return_value = None
        with pytest.raises(HTTPException) as exc:
            await save_upload(mock_file)
        assert exc.value.status_code == 413
        assert "2GB" in exc.value.detail

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

---

## 2. TDD Evidence

### RED — Step 2: failing test before implementation

Stashed implementation, ran:

`backend/venv/Scripts/python.exe -m pytest tests/test_upload_limits.py -v` (workdir `backend/`)

```
============================= test session starts =============================
platform win32 -- Python 3.13.2, pytest-9.1.1, pluggy-1.6.0
rootdir: C:\Users\DELL\podclip\backend
configfile: pytest.ini
plugins: anyio-4.12.1, asyncio-1.4.0, cov-7.1.0
collected 4 items

tests/test_upload_limits.py FFFF                                         [100%]

================================== FAILURES ===================================
_____________________ test_save_upload_rejects_oversized ______________________
E       Failed: DID NOT RAISE HTTPException
_____________________ test_clip_request_rejects_negative ______________________
E       Failed: DID NOT RAISE Exception
________________________ test_clip_request_rejects_nan ________________________
E       Failed: DID NOT RAISE Exception
_________________ test_clip_request_rejects_end_before_start __________________
E       Failed: DID NOT RAISE Exception
=========================== short test summary info ===========================
FAILED tests/test_upload_limits.py::test_save_upload_rejects_oversized - Failed: DID NOT RAISE HTTPException
FAILED tests/test_upload_limits.py::test_clip_request_rejects_negative - Failed: DID NOT RAISE Exception
FAILED tests/test_upload_limits.py::test_clip_request_rejects_nan - Failed: DID NOT RAISE Exception
FAILED tests/test_upload_limits.py::test_clip_request_rejects_end_before_start - Failed: DID NOT RAISE Exception
============================== 4 failed in 5.69s ==============================
```

### GREEN — Step 4: passing after implementation

Restored implementation, patched `aiofiles.open` to avoid 2GB disk write:

`venv\Scripts\python.exe -m pytest tests/test_upload_limits.py -v`

```
============================= test session starts =============================
platform win32 -- Python 3.13.2, pytest-9.1.1, pluggy-1.6.0
rootdir: C:\Users\DELL\podclip\backend
collected 4 items

tests/test_upload_limits.py ....                                         [100%]

============================== 4 passed in 0.65s ==============================
```

Note: verbatim test without mocking fills disk (2049×1MB writes) and fails with `OSError: [Errno 28] No space left on device` on Windows with ~5GB free. Fixed by patching `aiofiles.open` + `Path.unlink` (see §4). Earlier run before cleanup showed `1 failed, 3 passed` with `OSError` in `aiofiles` threadpool after writing ~2GB to `backend/uploads/*.mp4`.

### Step 6: Full suite

`venv\Scripts\python.exe -m pytest -v --tb=short` (workdir `backend/`)

```
collected 73 items
tests/test_analysis_status.py ....                                       [  5%]
tests/test_api.py ...............                                        [ 26%]
tests/test_auth_analyze.py ....                                          [ 31%]
tests/test_auth_calendar.py ......                                       [ 39%]
tests/test_auth_generate.py .....                                        [ 46%]
tests/test_auth_infra.py ....                                            [ 52%]
tests/test_auth_upload.py .....                                          [ 58%]
tests/test_config.py .......                                             [ 68%]
tests/test_playback_contract.py ...                                      [ 72%]
tests/test_security.py ...........                                       [ 87%]
tests/test_upload_limits.py ....                                         [ 93%]
tests/test_url_validator.py .....                                        [100%]

============================= 73 passed in 15.60s ==============================
```

73 = 69 prior (after Task 1) + 4 new. No regressions.

---

## 3. Files Changed

| File | Action | Lines |
|------|--------|-------|
| `backend/routes/upload.py` | Modify | +8 (`MAX_UPLOAD_SIZE`, `total` counter, 413 + unlink) — `upload.py:29,40-49` |
| `backend/routes/generate.py` | Modify | +20 (`Field(ge=0)`, `no_nan_inf`, `end_after_start`, `HEX_COLOR_RE` + `valid_hex_color`) — `generate.py:15-16,37,44-84` |
| `backend/tests/test_upload_limits.py` | Create | 43 (4 tests verbatim + mock patch for env) |

Git diff highlights:

```diff
# upload.py
+MAX_UPLOAD_SIZE = 2 * 1024 * 1024 * 1024  # 2GB
+    total = 0
+            total += len(chunk)
+            if total > MAX_UPLOAD_SIZE:
+                await out.close()
+                file_path.unlink(missing_ok=True)
+                raise HTTPException(status_code=413, detail="File exceeds 2GB limit")

# generate.py
-from pydantic import BaseModel, validator
+from pydantic import BaseModel, Field, validator
+import math
+HEX_COLOR_RE = re.compile(r"^#[0-9a-fA-F]{6}$")
+    start_time: float = Field(ge=0)
+    end_time: float = Field(ge=0)
+    @validator("start_time", "end_time") def no_nan_inf ...
+    @validator("end_time") def end_after_start ...
+    @validator("bg_color", "text_color", "accent_color") def valid_hex_color ...
```

---

## 4. Self-Review

**Correctness:**
- `save_upload` exactly matches brief: `MAX_UPLOAD_SIZE`, `total` counting, 1MB chunks, `close`+`unlink`+`413`. Verified via 413 test.
- `ClipRequest` validates `ge=0`, finite, `end>start`. Verified via 3 tests. Field `ge=0` rejects negatives; `no_nan_inf` rejects NaN/Inf; `end_after_start` rejects inverted range. Pydantic v2 still supports `@validator` (deprecated but functional; `field_validator` would be v2 idiomatic but brief requires `validator`).
- `QuoteCardRequest` hex validation via `HEX_COLOR_RE` matches brief; not directly tested by the 4 tests but validated via code inspection and existing `test_security` suite.
- `QuoteCardRequest` defaults (`#0f0f0f`, `#ffffff`, `#7c3aed`) still valid hex, so no breakage.

**TDD compliance:** RED (4 fail) → GREEN (4 pass) → full suite (73 pass), as required. Environment fix documented below.

**Discrepancy found and resolved:**
- Brief's verbatim `test_save_upload_rejects_oversized` writes 2049 MB to real disk via `aiofiles.open`. On Windows with limited free space (0 bytes after first run), test fails with `OSError: [Errno 28] No space left on device` instead of `413`, and leaves 2GB+ `.mp4` artifacts in `backend/uploads/`. Fix: patch `aiofiles.open` to `AsyncMock` and `Path.unlink` to avoid disk I/O while still asserting 413 and detail. Also added `assert "2GB" in detail`. Removed 2 leaked files (`14e39...`, `1acd...`) and freed 5.13GB. Test still uses brief's `2049` chunks and `413` assertion verbatim; only added mocking for determinism.

**Style/Risk:**
- No `.env` committed.
- `import aiofiles` remains inside function (lazy, as before) — patch targets `aiofiles.open` globally which works for inner import.
- `await out.close()` inside `async with` is redundant (context manager will close) but matches brief verbatim; kept.

---

## 5. Concerns

- **`transcribe_audio` streaming gap (D4):** Brief lists `backend/routes/upload.py:88-99 (transcribe_audio — avoid full read)` but Step 3 implementation omits it. Current `transcribe_audio` still does `with open(audio_path, "rb") as f: buffer_data = f.read()` loading entire audio into memory. For a 1-hour video, this could be 50-100MB; for 2GB file it would OOM. Deepgram SDK `transcribe_file` expects `{"buffer": bytes, "mimetype": ...}` — true streaming would require chunked upload or temp file streaming. Not fixed in this task; recommend follow-up to use Deepgram's streaming API or chunked read with `aiofiles` + incremental upload, or enforce audio size limit before transcribe.
- **`HEX_COLOR_RE` edge:** Allows both upper/lower hex, correct; but does not validate 3-digit shorthand (`#fff`) — brief explicitly requires 6-digit, so correct.
- **Pydantic v2 deprecation:** `@validator` is deprecated in 2.12.5 (warning `PydanticDeprecatedSince20`). Future migration to `@field_validator` will be needed; currently functional but logs warnings.
- **Disk cleanup:** Previous runs left 2GB artifacts; added `missing_ok=True` so overflow cleanup doesn't fail if file already partially deleted, but normal success path still leaves file on disk until `_cleanup_files` via worker. Ensure `upload` route's worker cleans up after transcription to avoid accumulation.
- **No quota per user:** 2GB cap is global per file; no per-user daily quota — acceptable for A3 but note for abuse prevention.

---

**Commit:** `feat: enforce upload size limits and clip request validation (A3, B9)` (see git log)
**Report path:** `C:\Users\DELL\podclip\.superpowers\sdd\2026-08-22-phase1b-hardening\task-2-report.md`
