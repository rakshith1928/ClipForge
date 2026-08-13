import os

# Use an isolated sqlite database so the suite runs without Postgres.
os.environ["DATABASE_URL"] = "sqlite:////tmp/clipforge_smoke.db"

from routes.generate import sanitize_filename


def test_sanitize_strips_path_traversal():
    assert "/" not in sanitize_filename("../../../../etc/passwd", "clip")
    assert "\\" not in sanitize_filename("..\\..\\evil", "clip")
    assert ".." not in sanitize_filename("a..b", "clip")


def test_sanitize_keeps_safe_characters():
    assert sanitize_filename("My Cool Clip!", "clip") == "My_Cool_Clip_"
    assert sanitize_filename("", "clip") == "clip"


def test_sanitize_respects_max_len():
    assert len(sanitize_filename("a" * 100, "clip", max_len=10)) == 10
