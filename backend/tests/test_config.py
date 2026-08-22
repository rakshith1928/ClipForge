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


def test_dev_fallback_logs_warning(monkeypatch, caplog):
    import logging

    monkeypatch.delenv("MY_SECRET", raising=False)
    monkeypatch.setenv("ENVIRONMENT", "dev")
    with caplog.at_level(logging.WARNING, logger="config"):
        assert get_secret("MY_SECRET", dev_default="dev-fallback") == "dev-fallback"
    assert any("MY_SECRET" in r.message for r in caplog.records)


def test_no_warning_when_env_set(monkeypatch, caplog):
    import logging

    monkeypatch.setenv("MY_SECRET", "real-value")
    with caplog.at_level(logging.WARNING, logger="config"):
        get_secret("MY_SECRET")
    assert not [r for r in caplog.records if "MY_SECRET" in r.message]
