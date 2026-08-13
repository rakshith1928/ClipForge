import os

# Use an isolated sqlite database so the suite runs without Postgres.
os.environ["DATABASE_URL"] = "sqlite:////tmp/clipforge_smoke.db"

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from routes.generate import (
    UPLOAD_DIR,
    QuoteCardRequest,
    _ensure_within_upload_dir,
    find_video_file,
    sanitize_filename,
)


def test_sanitize_strips_path_traversal():
    assert "/" not in sanitize_filename("../../../../etc/passwd", "clip")
    assert "\\" not in sanitize_filename("..\\..\\evil", "clip")
    assert ".." not in sanitize_filename("a..b", "clip")


def test_sanitize_keeps_safe_characters():
    assert sanitize_filename("My Cool Clip!", "clip") == "My_Cool_Clip_"
    assert sanitize_filename("", "clip") == "clip"


def test_sanitize_respects_max_len():
    assert len(sanitize_filename("a" * 100, "clip", max_len=10)) == 10


def test_find_video_file_rejects_path_traversal():
    for bad in ["/etc/passwd", "..\\evil", "../secret", "a/../b"]:
        try:
            find_video_file(bad)
            raise AssertionError(f"expected HTTPException for {bad!r}")
        except HTTPException as e:
            assert e.status_code == 400


def test_quote_text_rejects_empty_and_whitespace():
    for bad in ["", "   ", "\n\t"]:
        try:
            QuoteCardRequest(episode_id="e1", quote_text=bad)
            raise AssertionError(f"expected ValidationError for {bad!r}")
        except ValidationError:
            pass


def test_quote_text_rejects_overlong():
    try:
        QuoteCardRequest(episode_id="e1", quote_text="a" * 601)
        raise AssertionError("expected ValidationError for >600 chars")
    except ValidationError:
        pass


def test_quote_text_accepts_valid():
    req = QuoteCardRequest(episode_id="e1", quote_text="A perfectly fine quote.")
    assert req.quote_text == "A perfectly fine quote."


def test_ensure_within_upload_dir_accepts_inside():
    # A path joined onto UPLOAD_DIR is returned (resolved) and stays inside.
    candidate = UPLOAD_DIR / "clip_abc123_def.mp4"
    resolved = _ensure_within_upload_dir(candidate)
    assert resolved.parent == UPLOAD_DIR.resolve()


def test_ensure_within_upload_dir_rejects_escape():
    # A path that escapes UPLOAD_DIR must be rejected.
    escape = UPLOAD_DIR.parent / ".." / "tmp" / "evil.mp4"
    with pytest.raises(HTTPException):
        _ensure_within_upload_dir(escape)


def test_find_video_file_rejects_traversal_in_file_id():
    # Up-front rejection of path separators and ".." prevents probing.
    for bad in ("../../etc/passwd", "a/../b", "..\\evil", "a..b"):
        with pytest.raises(HTTPException):
            find_video_file(bad)


def test_find_video_file_missing_is_not_found():
    # A benign but non-existent id should raise FileNotFoundError, not escape.
    with pytest.raises(FileNotFoundError):
        find_video_file("00000000-0000-0000-0000-000000000000")
