"""SMTP delivery checks that never open a network connection.

These tests use a stand-in for the mail server. They do not prove that a
real provider accepted a message.
"""

import logging
import smtplib

import pytest

from app.core.config import settings
from app.core.email import (
    EmailDeliveryError,
    send_password_reset_email,
    smtp_is_configured,
    validate_smtp_settings,
)
from app.modules.auth.password_reset import build_reset_link


class _Server:
    def __init__(self, host, port, timeout=None):
        self.host = host
        self.port = port
        self.timeout = timeout
        self.started = False
        self.messages = []

    def ehlo(self):
        return None

    def starttls(self):
        self.started = True

    def login(self, username, password):
        self.username = username

    def send_message(self, message):
        self.messages.append(message)

    def quit(self):
        return None


def _configure(monkeypatch, **overrides):
    values = {
        "smtp_host": "smtp.mailprovider.net",
        "smtp_port": 587,
        "smtp_username": "mailbox",
        "smtp_password": "mailbox-secret",
        "smtp_from_email": "noreply@mailprovider.net",
        "smtp_from_name": "NEXORA",
        "smtp_use_ssl": False,
        "smtp_use_starttls": True,
        "frontend_url": "https://app.mailprovider.net",
    }
    values.update(overrides)
    for name, value in values.items():
        monkeypatch.setattr(settings, name, value)


def test_reset_link_uses_the_configured_frontend_url():
    link = build_reset_link("https://app.mailprovider.net/", "raw token")
    assert link == (
        "https://app.mailprovider.net/password-recovery?token=raw%20token"
    )


def test_starttls_delivery_includes_the_frontend_link(monkeypatch):
    created = {}

    def build(host, port, timeout=None):
        server = _Server(host, port, timeout)
        created["server"] = server
        return server

    monkeypatch.setattr("app.core.email.smtplib.SMTP", build)
    monkeypatch.setattr(
        "app.core.email.smtplib.SMTP_SSL",
        lambda *args, **kwargs: (_ for _ in ()).throw(
            AssertionError("implicit TLS was not requested")
        ),
    )
    _configure(monkeypatch)
    link = build_reset_link(settings.frontend_url, "reset-token")
    send_password_reset_email(
        to_email="person@mailprovider.net",
        reset_link=link,
        expires_in_minutes=30,
    )
    server = created["server"]
    assert server.started is True
    assert server.port == 587
    body = server.messages[0].get_content()
    assert link in body
    assert "mailbox-secret" not in body


def test_implicit_tls_uses_smtp_ssl(monkeypatch):
    created = {}

    def build(host, port, timeout=None):
        server = _Server(host, port, timeout)
        created["server"] = server
        return server

    monkeypatch.setattr("app.core.email.smtplib.SMTP_SSL", build)
    monkeypatch.setattr(
        "app.core.email.smtplib.SMTP",
        lambda *args, **kwargs: (_ for _ in ()).throw(
            AssertionError("STARTTLS was not requested")
        ),
    )
    _configure(monkeypatch, smtp_port=465, smtp_use_ssl=True, smtp_use_starttls=False)
    send_password_reset_email(
        to_email="person@mailprovider.net",
        reset_link="https://app.mailprovider.net/password-recovery?token=reset-token",
        expires_in_minutes=30,
    )
    assert created["server"].port == 465
    assert created["server"].started is False


def test_a_provider_error_hides_the_password_and_token(monkeypatch, caplog):
    def build(host, port, timeout=None):
        server = _Server(host, port, timeout)

        def login(username, password):
            raise smtplib.SMTPAuthenticationError(535, b"mailbox-secret rejected")

        server.login = login
        return server

    monkeypatch.setattr("app.core.email.smtplib.SMTP", build)
    _configure(monkeypatch)
    caplog.set_level(logging.DEBUG)
    with pytest.raises(EmailDeliveryError) as caught:
        send_password_reset_email(
            to_email="person@mailprovider.net",
            reset_link="https://app.mailprovider.net/password-recovery?token=reset-token",
            expires_in_minutes=30,
        )
    message = str(caught.value)
    assert message == "The mail server did not accept the message"
    assert "mailbox-secret" not in message
    assert "reset-token" not in message
    assert "mailbox-secret" not in caplog.text
    assert "reset-token" not in caplog.text


def test_placeholder_smtp_is_not_a_working_server(monkeypatch):
    _configure(
        monkeypatch,
        smtp_host="smtp.invalid",
        smtp_from_email="staging-blocked@example.invalid",
    )
    problems = validate_smtp_settings()
    assert smtp_is_configured() is False
    assert any("SMTP_HOST" in problem for problem in problems)
    assert all("mailbox-secret" not in problem for problem in problems)


def test_tls_modes_cannot_be_combined(monkeypatch):
    _configure(monkeypatch, smtp_use_ssl=True, smtp_use_starttls=True)
    assert any("cannot both" in problem for problem in validate_smtp_settings())
    assert smtp_is_configured() is False
