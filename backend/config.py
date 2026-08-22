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
