"""Redact secrets and message content before they reach an operational log."""

from __future__ import annotations

import logging
import re

_REPLACEMENTS = (
    re.compile(r"(?i)(token|password|secret|authorization|api[_-]?key)=([^&\s]+)"),
    re.compile(r"(?i)\bbearer\s+[A-Za-z0-9._\-+/=]+"),
    re.compile(r"\bsk_(?:test|live)_[A-Za-z0-9]+"),
    re.compile(r"\bwhsec_[A-Za-z0-9]+"),
)


def redact_text(value: str) -> str:
    """Return text with credentials and reset tokens replaced."""
    redacted = value
    redacted = _REPLACEMENTS[0].sub(r"\1=[redacted]", redacted)
    for pattern in _REPLACEMENTS[1:]:
        redacted = pattern.sub("[redacted]", redacted)
    return redacted


class RedactingFilter(logging.Filter):
    """Remove secrets from a log record without dropping the record."""

    def filter(self, record: logging.LogRecord) -> bool:
        record.msg = redact_text(str(record.msg))
        if isinstance(record.args, dict):
            record.args = {
                key: redact_text(value) if isinstance(value, str) else value
                for key, value in record.args.items()
            }
        elif isinstance(record.args, tuple):
            record.args = tuple(
                redact_text(value) if isinstance(value, str) else value
                for value in record.args
            )
        return True


def install_redacting_logs() -> None:
    """Attach the filter to the process loggers that write operational output."""
    redactor = RedactingFilter()
    for name in ("", "uvicorn", "uvicorn.access", "uvicorn.error", "celery"):
        logger = logging.getLogger(name)
        if not any(isinstance(item, RedactingFilter) for item in logger.filters):
            logger.addFilter(redactor)
