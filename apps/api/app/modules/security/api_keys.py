import hashlib
import secrets
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.security.models import OrganizationAPIKey


ALLOWED_SCOPES = frozenset({
    "agent:invoke",
    "agent:read",
})


def generate_api_key() -> tuple[str, str, str]:
    random_part = secrets.token_urlsafe(32)

    plaintext = f"nexa_live_{random_part}"

    key_hash = hashlib.sha256(
        plaintext.encode("utf-8")
    ).hexdigest()

    prefix = plaintext[:20]

    return plaintext, prefix, key_hash


def hash_api_key(plaintext: str) -> str:
    return hashlib.sha256(
        plaintext.encode("utf-8")
    ).hexdigest()


def authenticate_api_key(
    db: Session,
    plaintext: str,
    required_scope: str,
) -> OrganizationAPIKey | None:
    if required_scope not in ALLOWED_SCOPES:
        return None

    key_hash = hash_api_key(plaintext)
    key_prefix = plaintext[:20]

    record = db.scalar(
        select(OrganizationAPIKey).where(
            OrganizationAPIKey.key_prefix == key_prefix,
            OrganizationAPIKey.key_hash == key_hash,
            OrganizationAPIKey.is_active.is_(True),
            OrganizationAPIKey.revoked_at.is_(None),
        )
    )

    if record is None:
        return None

    if record.expires_at is not None and record.expires_at <= datetime.now(
        timezone.utc
    ):
        return None

    if required_scope not in record.scopes:
        return None

    return record