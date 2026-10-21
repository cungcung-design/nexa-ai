"""The password reset flow of the authentication module.

The flow has three public steps:

* ``request``  – a visitor asks for a link. The answer is the same for every
  address so the endpoint cannot be used to find out which accounts exist.
* ``validate`` – a link is checked before the form is shown.
* ``confirm``  – the new password is stored, the link is spent and every
  session of the account is signed out.

Only the hash of a token is stored, a token works exactly once and every
newer request replaces the link that came before it.
"""

from __future__ import annotations

import hashlib
import secrets
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from urllib.parse import quote

from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.email import (
    EmailDeliveryError,
    send_password_reset_email,
    smtp_is_configured,
)
from app.core.security import hash_password
from app.db.models import PasswordResetToken, User, utc_now

#: The answer of the request endpoint. It is identical for every address.
NEUTRAL_MESSAGE = (
    "If an account exists for that address, a password reset link is on its way."
)

#: The answer of the validate and the confirm endpoint.
INVALID_TOKEN_MESSAGE = "This reset link is invalid or has expired."


class PasswordResetError(Exception):
    """Raised when a reset link cannot be used."""


@dataclass
class ResetRequestResult:
    """The outcome of a reset request.

    ``created`` tells the caller whether a link was issued, ``dev_reset_link``
    carries the link itself when no mail server is available. The router only
    forwards the link outside of production.
    """

    created: bool
    resend_available_in_seconds: int
    dev_reset_link: str | None = None
    user_id: uuid.UUID | None = None


def hash_reset_token(token: str) -> str:
    """Return the digest that is stored for a reset token."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def build_reset_link(base_url: str, token: str) -> str:
    """Build the link that is sent in the email."""
    return (
        f"{base_url.rstrip('/')}/password-recovery"
        f"?token={quote(token, safe='')}"
    )


def _as_utc(value: datetime) -> datetime:
    """Treat a naive timestamp as UTC so the comparisons stay correct."""
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value


def _latest_token(db: Session, user_id) -> PasswordResetToken | None:
    return db.scalars(
        select(PasswordResetToken)
        .where(PasswordResetToken.user_id == user_id)
        .order_by(PasswordResetToken.created_at.desc())
        .limit(1)
    ).first()


def _requests_in_window(
    db: Session,
    user_id,
    window_start: datetime,
) -> int:
    return int(
        db.scalar(
            select(func.count())
            .select_from(PasswordResetToken)
            .where(
                PasswordResetToken.user_id == user_id,
                PasswordResetToken.created_at >= window_start,
            )
        )
        or 0
    )


def _invalidate_open_tokens(db: Session, user_id, moment: datetime) -> None:
    """Mark every open token of the account as used."""
    db.execute(
        update(PasswordResetToken)
        .where(
            PasswordResetToken.user_id == user_id,
            PasswordResetToken.used_at.is_(None),
        )
        .values(used_at=moment)
    )


def request_password_reset(
    db: Session,
    email: str,
    *,
    base_url: str | None = None,
) -> ResetRequestResult:
    """Ask for a password reset link.

    The function never tells the caller whether the address belongs to an
    account. When the address is unknown, when the cooldown of the account is
    still running or when the hourly limit is reached, the returned result is
    empty and no mail is sent.
    """
    normalized = (email or "").strip().lower()
    user = db.query(User).filter(User.email == normalized).first()
    cooldown = max(settings.password_reset_cooldown_seconds, 0)
    if user is None:
        return ResetRequestResult(
            created=False,
            resend_available_in_seconds=cooldown,
        )

    now = utc_now()
    latest = _latest_token(db, user.id)
    if latest is not None and latest.used_at is None:
        age = (now - _as_utc(latest.created_at)).total_seconds()
        if age < cooldown:
            return ResetRequestResult(
                created=False,
                resend_available_in_seconds=int(cooldown - age) + 1,
                user_id=user.id,
            )

    window_start = now - timedelta(
        minutes=max(settings.password_reset_request_window_minutes, 1)
    )
    if _requests_in_window(db, user.id, window_start) >= max(
        settings.password_reset_max_requests, 1
    ):
        return ResetRequestResult(
            created=False,
            resend_available_in_seconds=cooldown,
            user_id=user.id,
        )

    # A new link replaces the links that were handed out before.
    _invalidate_open_tokens(db, user.id, now)

    raw_token = secrets.token_urlsafe(32)
    record = PasswordResetToken(
        user_id=user.id,
        token_hash=hash_reset_token(raw_token),
        expires_at=now
        + timedelta(minutes=max(settings.password_reset_token_minutes, 1)),
        used_at=None,
        created_at=now,
    )
    db.add(record)
    db.commit()

    link = build_reset_link(
        base_url or settings.frontend_url,
        raw_token,
    )

    dev_link: str | None = None
    if smtp_is_configured():
        try:
            send_password_reset_email(
                to_email=user.email,
                reset_link=link,
                expires_in_minutes=settings.password_reset_token_minutes,
            )
        except EmailDeliveryError:
            # The link never left the building, so it is removed and the
            # visitor may ask again right away.
            db.delete(record)
            db.commit()
            raise
    else:
        # Without a mail server the link is handed back to the caller, which
        # only forwards it outside of production.
        dev_link = link

    return ResetRequestResult(
        created=True,
        resend_available_in_seconds=cooldown,
        dev_reset_link=dev_link,
        user_id=user.id,
    )


def find_valid_token(
    db: Session,
    token: str,
) -> PasswordResetToken | None:
    """Return the token behind ``token`` when it may still be used."""
    candidate = (token or "").strip()
    if not candidate:
        return None

    record = db.scalars(
        select(PasswordResetToken).where(
            PasswordResetToken.token_hash == hash_reset_token(candidate)
        )
    ).first()
    if record is None or record.used_at is not None:
        return None
    if _as_utc(record.expires_at) <= utc_now():
        return None
    return record


def validate_reset_token(db: Session, token: str) -> PasswordResetToken:
    """Return the token behind ``token`` or raise :class:`PasswordResetError`."""
    record = find_valid_token(db, token)
    if record is None:
        raise PasswordResetError(INVALID_TOKEN_MESSAGE)
    return record


def confirm_password_reset(
    db: Session,
    token: str,
    password: str,
) -> User:
    """Store the new password and sign every session of the account out."""
    record = validate_reset_token(db, token)
    user = db.get(User, record.user_id)
    if user is None:
        raise PasswordResetError(INVALID_TOKEN_MESSAGE)

    now = utc_now()
    user.password_hash = hash_password(password)
    # The bump signs every session that was opened before this moment out.
    user.token_version = int(user.token_version or 0) + 1
    record.used_at = now
    _invalidate_open_tokens(db, user.id, now)
    db.commit()
    return user
