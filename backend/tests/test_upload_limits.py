import math
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import HTTPException

from routes.generate import ClipRequest
from routes.upload import save_upload


@pytest.mark.asyncio
async def test_save_upload_rejects_oversized():
    # Mock file that exceeds 2GB - patch aiofiles to avoid writing 2GB to disk
    mock_file = MagicMock()
    mock_file.filename = "big.mp4"
    # Simulate 3 chunks that exceed limit
    chunks = [b"x" * (1024 * 1024)] * 2049  # 2049 MB
    mock_file.read = AsyncMock(side_effect=chunks + [b""])
    mock_out = AsyncMock()
    # save_upload does `import aiofiles` inside function, so patch aiofiles.open globally
    with patch("aiofiles.open") as mock_aio_open, patch.object(Path, "unlink", return_value=None) as mock_unlink:
        mock_aio_open.return_value.__aenter__.return_value = mock_out
        mock_aio_open.return_value.__aexit__.return_value = None
        with pytest.raises(HTTPException) as exc:
            await save_upload(mock_file)
        assert exc.value.status_code == 413
        assert "2GB" in exc.value.detail
        # Ensure streaming was capped: write should not exceed 2048 chunks (2GB)
        assert mock_out.write.call_count <= 2048
        assert mock_out.write.call_count >= 2047  # allow 2048 or 2047 depending on timing
        assert mock_unlink.called


def test_clip_request_rejects_negative():
    with pytest.raises(Exception):
        ClipRequest(file_id="abc", episode_id="abc", start_time=-1, end_time=10)


def test_clip_request_rejects_nan():
    with pytest.raises(Exception):
        ClipRequest(file_id="abc", episode_id="abc", start_time=float('nan'), end_time=10)


def test_clip_request_rejects_end_before_start():
    with pytest.raises(Exception):
        ClipRequest(file_id="abc", episode_id="abc", start_time=10, end_time=5)


def test_quote_card_rejects_bad_hex():
    from routes.generate import QuoteCardRequest
    with pytest.raises(Exception):
        QuoteCardRequest(episode_id="x", quote_text="hello", bg_color="not-hex", text_color="#ffffff", accent_color="#7c3aed")
    with pytest.raises(Exception):
        QuoteCardRequest(episode_id="x", quote_text="hello", bg_color="#fff", text_color="#ffffff", accent_color="#7c3aed")
