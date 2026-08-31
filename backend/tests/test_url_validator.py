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
