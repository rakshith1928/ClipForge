import os

# Use an isolated sqlite database so the suite runs without Postgres.
os.environ["DATABASE_URL"] = "sqlite:////tmp/clipforge_smoke.db"

from fastapi import HTTPException
from pydantic import ValidationError

from routes.generate import (
    QuoteCardRequest,
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
