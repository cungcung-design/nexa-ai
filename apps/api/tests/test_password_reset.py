"""Tests for the password reset flow.

The suite covers the neutral answer of the request endpoint, the cooldown and
the hourly limit, the single use of a token, the expiry, the new password and
the revocation of the sessions that were opened before the reset.
"""

import uuid
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.core.config import settings
from app.core.email import EmailDeliveryError
from app.db.models import PasswordResetToken
from app.modules.auth import password_reset as password_reset_service
from app.modules.auth.password_reset import hash_reset_token

PASSWORD = "Reset-Flow-Secure-Pass"
NEW_PASSWORD = "Reset-Flow-New-Password"


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _register(client: TestClient, email: str) -> str:
    created = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": PASSWORD},
    )
    assert created.status_code == 201, created.text
    return created.json()["access_token"]


def _unique_email(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:10]}@example.com"


def _request_reset(client: TestClient, email: str):
    return client.post(
        "/api/v1/auth/password-reset/request",
        json={"email": email},
    )


def _reset_token(response) -> str:
    payload = response.json()
    assert payload["dev_reset_link"], payload
    return payload["dev_reset_link"].split("token=")[-1]


def test_the_reset_link_uses_the_configured_frontend_url(
    client: TestClient, monkeypatch
):
    monkeypatch.setattr(settings, "frontend_url", "https://app.mailprovider.net")
    email = _unique_email("reset-frontend")
    _register(client, email)

    response = _request_reset(client, email)

    assert response.status_code == 200, response.text
    link = response.json()["dev_reset_link"]
    assert link.startswith(
        "https://app.mailprovider.net/password-recovery?token="
    )
    assert response.json()["message"]


def test_the_request_never_reveals_whether_an_account_exists(client: TestClient):
    known = _unique_email("reset-known")
    _register(client, known)

    known_response = _request_reset(client, known)
    unknown_response = _request_reset(client, _unique_email("reset-unknown"))

    assert known_response.status_code == 200, known_response.text
    assert unknown_response.status_code == 200, unknown_response.text
    assert (
        known_response.json()["message"]
        == unknown_response.json()["message"]
    )
    assert known_response.json()["dev_reset_link"]
    assert unknown_response.json()["dev_reset_link"] is None


def test_only_the_hash_of_a_token_is_stored(client: TestClient, db_session):
    email = _unique_email("reset-hash")
    _register(client, email)

    token = _reset_token(_request_reset(client, email))

    record = db_session.scalars(
        select(PasswordResetToken).where(
            PasswordResetToken.token_hash == hash_reset_token(token)
        )
    ).first()
    assert record is not None
    assert record.token_hash != token
    assert record.used_at is None


def test_a_second_request_inside_the_cooldown_keeps_the_first_link(
    client: TestClient, monkeypatch
):
    monkeypatch.setattr(settings, "password_reset_cooldown_seconds", 120)
    email = _unique_email("reset-cooldown")
    _register(client, email)

    first = _request_reset(client, email)
    second = _request_reset(client, email)

    assert first.json()["dev_reset_link"]
    assert second.json()["dev_reset_link"] is None
    assert second.json()["resend_available_in_seconds"] > 0

    validated = client.post(
        "/api/v1/auth/password-reset/validate",
        json={"token": _reset_token(first)},
    )
    assert validated.status_code == 200, validated.text


def test_a_new_request_replaces_the_previous_link(
    client: TestClient, monkeypatch
):
    monkeypatch.setattr(settings, "password_reset_cooldown_seconds", 0)
    email = _unique_email("reset-replace")
    _register(client, email)

    first_token = _reset_token(_request_reset(client, email))
    second_token = _reset_token(_request_reset(client, email))
    assert first_token != second_token

    refused = client.post(
        "/api/v1/auth/password-reset/confirm",
        json={"token": first_token, "password": NEW_PASSWORD},
    )
    assert refused.status_code == 400, refused.text


def test_the_request_limit_stops_new_links(client: TestClient, monkeypatch):
    monkeypatch.setattr(settings, "password_reset_cooldown_seconds", 0)
    monkeypatch.setattr(settings, "password_reset_max_requests", 2)
    email = _unique_email("reset-limit")
    _register(client, email)

    assert _request_reset(client, email).json()["dev_reset_link"]
    assert _request_reset(client, email).json()["dev_reset_link"]
    assert _request_reset(client, email).json()["dev_reset_link"] is None


def test_the_new_password_is_stored_and_the_sessions_are_revoked(
    client: TestClient,
):
    email = _unique_email("reset-confirm")
    access_token = _register(client, email)
    token = _reset_token(_request_reset(client, email))

    confirmed = client.post(
        "/api/v1/auth/password-reset/confirm",
        json={"token": token, "password": NEW_PASSWORD},
    )
    assert confirmed.status_code == 200, confirmed.text

    old_password = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": PASSWORD},
    )
    assert old_password.status_code == 401

    new_password = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": NEW_PASSWORD},
    )
    assert new_password.status_code == 200, new_password.text

    # The session that was open before the reset is signed out.
    session = client.get("/api/v1/auth/me", headers=_auth(access_token))
    assert session.status_code == 401


def test_a_token_can_only_be_used_once(client: TestClient):
    email = _unique_email("reset-single-use")
    _register(client, email)
    token = _reset_token(_request_reset(client, email))

    first = client.post(
        "/api/v1/auth/password-reset/confirm",
        json={"token": token, "password": NEW_PASSWORD},
    )
    assert first.status_code == 200, first.text

    second = client.post(
        "/api/v1/auth/password-reset/confirm",
        json={"token": token, "password": NEW_PASSWORD},
    )
    assert second.status_code == 400, second.text


def test_an_unknown_token_is_refused(client: TestClient):
    refused = client.post(
        "/api/v1/auth/password-reset/validate",
        json={"token": "not-a-real-token"},
    )
    assert refused.status_code == 400, refused.text

    confirm = client.post(
        "/api/v1/auth/password-reset/confirm",
        json={"token": "not-a-real-token", "password": NEW_PASSWORD},
    )
    assert confirm.status_code == 400, confirm.text


def test_an_expired_token_is_refused(client: TestClient, db_session):
    email = _unique_email("reset-expired")
    _register(client, email)
    token = _reset_token(_request_reset(client, email))

    record = db_session.scalars(
        select(PasswordResetToken).where(
            PasswordResetToken.token_hash == hash_reset_token(token)
        )
    ).first()
    assert record is not None
    record.expires_at = datetime.now(timezone.utc) - timedelta(minutes=1)
    db_session.commit()

    refused = client.post(
        "/api/v1/auth/password-reset/confirm",
        json={"token": token, "password": NEW_PASSWORD},
    )
    assert refused.status_code == 400, refused.text


def test_a_short_password_is_refused(client: TestClient):
    email = _unique_email("reset-short")
    _register(client, email)
    token = _reset_token(_request_reset(client, email))

    refused = client.post(
        "/api/v1/auth/password-reset/confirm",
        json={"token": token, "password": "short"},
    )
    assert refused.status_code == 422, refused.text


def test_a_failed_delivery_is_not_reported_as_a_success(
    client: TestClient, monkeypatch
):
    def broken_delivery(**kwargs):
        raise EmailDeliveryError("The mail server did not accept the message")

    monkeypatch.setattr(
        password_reset_service, "smtp_is_configured", lambda: True
    )
    monkeypatch.setattr(
        password_reset_service, "send_password_reset_email", broken_delivery
    )

    email = _unique_email("reset-delivery")
    _register(client, email)

    response = _request_reset(client, email)
    assert response.status_code == 503, response.text
    # The answer of a failed delivery never carries a link.
    assert "dev_reset_link" not in response.json()
    assert "try again" in response.json()["detail"].lower()
