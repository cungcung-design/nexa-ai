"""Recursive redaction of secret material.

Audit payloads, change records and exports must never contain credential
values. Only metadata about a credential change is recorded, so every value
stored under a secret-looking key is replaced before it reaches the database.
"""

from __future__ import annotations

import re
from typing import Any

REDACTED = "***REDACTED***"

# Key fragments that always mark a value as secret material.
_SECRET_TOKENS = (
    "password",
    "passwd",
    "pwd",
    "secret",
    "token",
    "api_key",
    "apikey",
    "api-key",
    "credential",
    "authorization",
    "private_key",
    "privatekey",
    "access_key",
    "accesskey",
    "session_key",
    "signature",
    "bearer",
)

# Suffixes that turn a secret-looking key into harmless metadata.
_METADATA_SUFFIXES = (
    "_changed",
    "_created",
    "_updated",
    "_rotated",
    "_revoked",
    "_removed",
    "_deleted",
    "_added",
    "_granted",
    "_id",
    "_ids",
    "_count",
    "_present",
    "_type",
    "_name",
    "_at",
    "_on",
    "_status",
    "_fingerprint",
    "_prefix",
    "_length",
)

_SECRET_KEY_RE = re.compile(
    "|".join(re.escape(token) for token in _SECRET_TOKENS),
    re.IGNORECASE,
)


def is_secret_key(key: str) -> bool:
    """Return True when a payload key holds credential material."""
    normalized = key.strip().lower().replace(" ", "_")
    if not normalized:
        return False
    if normalized.endswith(_METADATA_SUFFIXES):
        return False
    return bool(_SECRET_KEY_RE.search(normalized))


def redact_secrets(value: Any) -> Any:
    """Return a copy of ``value`` with every secret-looking value masked."""
    if isinstance(value, dict):
        redacted: dict[Any, Any] = {}
        for key, item in value.items():
            if isinstance(key, str) and is_secret_key(key):
                redacted[key] = REDACTED
            else:
                redacted[key] = redact_secrets(item)
        return redacted
    if isinstance(value, (list, tuple, set)):
        return [redact_secrets(item) for item in value]
    return value
