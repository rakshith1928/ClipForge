# Task 1 Report: SSRF Protection — URL Allowlist & Private IP Blocking (A2)

**Branch:** `feat/phase1b-hardening` (base `5d05529`)
**Date:** 2026-08-31
**Author:** OpenCode (Muse Spark)

---

## 1. What was implemented

### 1.1 New package `backend/utils/`
- `backend/utils/__init__.py` — empty marker (as per brief)
- `backend/utils/url_validator.py` — SSRF protection module

Exact implementation (matches brief, with one fix for direct IP literal):

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
    # Direct IP literal check — before allowlist so 127.0.0.1 yields "private" not "not allowed"
    if is_private_ip(host):
        raise HTTPException(status_code=400, detail=f"URL resolves to private IP: {host}")
    host_lower = host.lower()
    is_allowed = any(host_lower == h or host_lower.endswith("." + h) for h in ALLOWED_HOSTS)
    if not is_allowed:
        raise HTTPException(status_code=400, detail=f"URL host not allowed: {host}")
    for ip in _resolve_ips(host):
        if is_private_ip(ip):
            raise HTTPException(status_code=400, detail=f"URL resolves to private IP: {ip}")
    return {"host": host, "is_allowed": is_allowed}
```

**Interfaces:**
- `is_private_ip(ip: str) -> bool`
- `validate_upload_url(url: str) -> dict` — raises `HTTPException(400)` on private IP, bad scheme, or non-allowlisted host; returns `{"host": str, "is_allowed": bool}`
- `_resolve_ips(hostname: str) -> list[str]` — internal DNS helper, returns `[]` on `socket.gaierror`

### 1.2 Integration into `backend/routes/upload.py`
- `start_upload_from_url` (`backend/routes/upload.py:224-281`): added at function entry (before `fetch_info`):
  ```python
  from utils.url_validator import validate_upload_url
  validate_upload_url(body.url)
  ```
- `_download_with_ytdlp` (`backend/routes/upload.py:201-217`): added to `ydl_opts`:
  ```python
  "max_filesize": 2 * 1024 * 1024 * 1024,  # 2GB
  "socket_timeout": 30,
  ```

### 1.3 Tests
- `backend/tests/test_url_validator.py` — 5 tests exactly as specified in brief (verbatim)
- `backend/tests/test_api.py:173` — updated regression test URL from `https://example.com/video` to `https://www.youtube.com/watch?v=test123` to pass allowlist (see §4 Discrepancy)

---

## 2. TDD Evidence

### RED — Step 2: failing test before implementation

Command: `venv\Scripts\python.exe -m pytest tests/test_url_validator.py -v` (workdir `backend/`)

```
============================= test session starts =============================
platform win32 -- Python 3.13.2, pytest-9.1.1, pluggy-1.6.0
rootdir: C:\Users\DELL\podclip\backend
configfile: pytest.ini
plugins: anyio-4.12.1, cov-7.1.0
collected 0 items / 1 error

=================================== ERRORS ====================================
________________ ERROR collecting tests/test_url_validator.py _________________
ImportError while importing test module 'C:\Users\DELL\podclip\backend\tests\test_url_validator.py'.
Hint: make sure your test modules/packages have valid Python names.
Traceback:
tests\test_url_validator.py:3: in <module>
    from utils.url_validator import is_private_ip, validate_upload_url
E   ModuleNotFoundError: No module named 'utils'
=========================== short test summary info ===========================
ERROR tests/test_url_validator.py
!!!!!!!!!!!!!!!!!!! Interrupted: 1 error during collection !!!!!!!!!!!!!!!!!!!!
============================== 1 error in 0.74s ===============================
```

Also intermediate RED after verbatim brief implementation (before direct-IP fix):

```
tests\test_url_validator.py .F...                                        [100%]
FAILED tests/test_url_validator.py::test_validate_rejects_private_url - AssertionError: assert 'private' in 'url host not allowed: 127.0.0.1'
========================= 1 failed, 4 passed in 0.97s =========================
```

### GREEN — Step 4: passing after fix

Command: `venv\Scripts\python.exe -m pytest tests/test_url_validator.py -v`

```
============================= test session starts =============================
platform win32 -- Python 3.13.2, pytest-9.1.1, pluggy-1.6.0
rootdir: C:\Users\DELL\podclip\backend
configfile: pytest.ini
plugins: anyio-4.12.1, cov-7.1.0
collected 5 items

tests\test_url_validator.py .....                                        [100%]

============================== 5 passed in 0.15s ==============================
```

### Step 6: Full suite

Command: `venv\Scripts\python.exe -m pytest -q` (then `-v` for counts)

First run after integration (before test_api fix):
```
.....................................................................    [100%]
FAILED tests/test_api.py::test_upload_from_url_uses_lazily_imported_ytdlp - AssertionError: assert '1 hour maximum duration limit' in 'URL host not allowed: example.com'
1 failed
```

After fixing `test_api.py:173` to use allowlisted URL:

```
============================= test session starts =============================
platform win32 -- Python 3.13.2, pytest-9.1.1, pluggy-1.6.0
rootdir: C:\Users\DELL\podclip\backend
configfile: pytest.ini
testpaths: tests
plugins: anyio-4.12.1, cov-7.1.0
collected 69 items

tests\test_analysis_status.py ....                                       [  5%]
tests\test_api.py ...............                                        [ 27%]
tests\test_auth_analyze.py ....                                          [ 33%]
tests\test_auth_calendar.py ......                                       [ 42%]
tests\test_auth_generate.py .....                                        [ 49%]
tests\test_auth_infra.py ....                                            [ 55%]
tests\test_auth_upload.py .....                                          [ 62%]
tests\test_config.py .......                                             [ 72%]
tests\test_playback_contract.py ...                                      [ 76%]
tests\test_security.py ...........                                       [ 92%]
tests\test_url_validator.py .....                                        [100%]

============================= 69 passed in 5.35s ==============================
```

69 = 64 original + 5 new validator tests. No `.env` committed.

---

## 3. Files Changed

| File | Action | Lines |
|------|--------|-------|
| `backend/utils/__init__.py` | Create | 1 |
| `backend/utils/url_validator.py` | Create | 43 |
| `backend/routes/upload.py` | Modify | +4 (import+validate, ydl_opts 2 keys) — `upload.py:214-215, 234-235` |
| `backend/tests/test_url_validator.py` | Create | 24 (5 tests verbatim) |
| `backend/tests/test_api.py` | Modify | 1 line URL change `example.com/video` → `www.youtube.com/watch?v=test123` (`test_api.py:173`) |

Git diff for `backend/routes/upload.py`:
```diff
+        "max_filesize": 2 * 1024 * 1024 * 1024,  # 2GB
+        "socket_timeout": 30,
+    from utils.url_validator import validate_upload_url
+    validate_upload_url(body.url)
```

---

## 4. Self-Review

**Correctness:**
- `is_private_ip` covers private/loopback/link_local/multicast/reserved via `ipaddress` — matches brief and audit A2.
- Allowlist uses exact + subdomain suffix (`endswith("."+h)`) — prevents `evilyoutube.com` bypass.
- Direct IP literal check inserted before allowlist — necessary for TDD to pass (see Discrepancy).
- DNS-based private IP check remains after allowlist for rebinding cases (e.g., `youtube.com` resolving to private IP via poisoned DNS).
- Integration placement is first statement in `start_upload_from_url` before any yt-dlp work — correct SSRF boundary.
- `max_filesize`/`socket_timeout` added to `_download_with_ytdlp` only (not `fetch_info`), as spec'd.

**Security:**
- Scheme restriction blocks `ftp://`, `file://`, etc.
- Host allowlist is strict (no regex, no open redirect).
- Private IP blocking covers both literal IP and DNS-resolved IP.
- Remaining gap (not in scope): no redirect following validation — yt-dlp could follow redirects to private IP. Mitigated partly by `socket_timeout`/`max_filesize` but full fix would require yt-dlp extractor hardening (future task).

**TDD compliance:** RED → GREEN → integrate → full suite, as required.

**Discrepancy found and resolved:**
- Brief's verbatim `validate_upload_url` fails its own test: `http://127.0.0.1:6379/admin` would hit allowlist (`"URL host not allowed"`) before private-IP check, but test asserts `"private" in detail`. Fix: check `is_private_ip(host)` immediately after parsing hostname, before allowlist. Documented here and in code comment.
- Brief's full-suite expectation broken by existing `test_api.py:173` using `https://example.com/video` (non-allowlisted). Fixed by switching to allowlisted `https://www.youtube.com/watch?v=test123` so duration-limit regression still validates lazy yt-dlp import without triggering SSRF block. Alternative would be to mock `validate_upload_url` in that test, but URL change is minimal and preserves intent.

**Style/Risk:**
- No `.env` touched.
- Imports kept lazy where required.
- `frontend/next-env.d.ts` reverted (unrelated auto-generated change not committed).

---

## 5. Concerns

- Redirect-to-private-IP via yt-dlp not covered by current validator — consider adding yt-dlp `no_redirect` or post-extraction URL validation in a follow-up.
- `ALLOWED_HOSTS` does not include bare `youtu.be` short links with path variations beyond host check (handled correctly) and does not include `youtube-nocookie.com` subdomains beyond `www` — current logic covers any subdomain via `endswith`, which is intentional.
- DNS lookup uses `socket.gethostbyname_ex` (IPv4 only) — IPv6 SSRF (`::ffff:127.0.0.1`) would not be caught via DNS path but is caught via direct `is_private_ip` for literal IPv6; IPv6 DNS not resolved. Acceptable for Phase 1b but note for hardening backlog.

---

**Commit:** `feat: add SSRF protection with allowlist and private IP blocking (A2)` (see git log)
**Report path:** `C:\Users\DELL\podclip\.superpowers\sdd\2026-08-22-phase1b-hardening\task-1-report.md`
