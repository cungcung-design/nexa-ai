"""Delivery of the transactional emails.

The module keeps the conversation with the mail server in one place so the
feature modules only describe the message they want to send. Two rules hold
everywhere in this file:

* a password or a reset token is never written to a log,
* the credentials of the mail server stay inside the settings.
"""

from __future__ import annotations

import smtplib
from email.message import EmailMessage

from app.core.config import settings


class EmailDeliveryError(RuntimeError):
    """Raised when a message could not be handed over to the mail server."""


_RESERVED_SUFFIXES = (
    ".invalid",
    ".example",
    ".example.com",
    ".example.net",
    ".example.org",
    ".localhost",
    ".test",
)


def _reserved_name(value: str) -> bool:
    normalized = value.strip().lower().rstrip(".")
    return any(normalized.endswith(suffix) for suffix in _RESERVED_SUFFIXES)


def _placeholder_host(host: str) -> bool:
    normalized = host.strip().lower().rstrip(".")
    return not normalized or normalized == "localhost" or _reserved_name(normalized)


def _placeholder_sender(sender: str) -> bool:
    normalized = sender.strip().lower()
    if "@" not in normalized:
        return True
    domain = normalized.rsplit("@", 1)[1]
    return _reserved_name(domain)


def validate_smtp_settings() -> list[str]:
    """Return configuration problems. The list never contains credentials."""
    problems: list[str] = []
    host = settings.smtp_host.strip()
    sender = settings.smtp_from_email.strip()
    if _placeholder_host(host):
        problems.append("SMTP_HOST is not a deliverable mail server")
    if _placeholder_sender(sender):
        problems.append("SMTP_FROM_EMAIL is not a deliverable address")
    if settings.smtp_use_ssl and settings.smtp_use_starttls:
        problems.append("SMTP_USE_SSL and SMTP_USE_STARTTLS cannot both be enabled")
    if not 1 <= int(settings.smtp_port) <= 65535:
        problems.append("SMTP_PORT is outside 1-65535")
    return problems


def smtp_is_configured() -> bool:
    """Report whether a mail server is available for real delivery.

    A placeholder host such as ``smtp.invalid`` keeps production boot happy
    and does not count as a working server.
    """
    return not validate_smtp_settings()


def _open_smtp():
    """Open the provider connection using its configured TLS mode."""
    host = settings.smtp_host.strip()
    port = int(settings.smtp_port)
    timeout = settings.smtp_timeout_seconds
    if settings.smtp_use_ssl and settings.smtp_use_starttls:
        raise EmailDeliveryError("The mail server did not accept the message")
    if settings.smtp_use_ssl:
        server = smtplib.SMTP_SSL(host, port, timeout=timeout)
        server.ehlo()
        return server
    server = smtplib.SMTP(host, port, timeout=timeout)
    server.ehlo()
    if settings.smtp_use_starttls:
        server.starttls()
        server.ehlo()
    return server


def _deliver(message: EmailMessage) -> None:
    """Hand one message to the configured server.

    Failures are reported with a fixed sentence. The provider conversation
    can contain a password or a recipient address, and neither is re-raised.
    """
    server = None
    try:
        server = _open_smtp()
        if settings.smtp_username:
            server.login(settings.smtp_username, settings.smtp_password)
        server.send_message(message)
    except (smtplib.SMTPException, OSError) as error:
        raise EmailDeliveryError(
            "The mail server did not accept the message"
        ) from error
    finally:
        if server is not None:
            try:
                server.quit()
            except (smtplib.SMTPException, OSError):
                pass


def _build_message(
    *,
    to_email: str,
    subject: str,
    body: str,
) -> EmailMessage:
    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = (
        f"{settings.smtp_from_name} <{settings.smtp_from_email}>"
        if settings.smtp_from_name
        else settings.smtp_from_email
    )
    message["To"] = to_email
    message.set_content(body)
    return message


def _render_password_reset_body(
    *,
    reset_link: str,
    expires_in_minutes: int,
) -> str:
    return (
        "We received a request to reset the password of your NEXORA account."
        "\n\n"
        "Open the link below to choose a new password. The link expires in "
        f"{expires_in_minutes} minutes and can only be used once.\n\n"
        f"{reset_link}\n\n"
        "If you did not request a password reset you can safely ignore this "
        "email. Your password stays unchanged."
    )


def _render_email_verification_body(
    *,
    verification_link: str,
    expires_in_minutes: int,
) -> str:
    return (
        "Welcome to NEXORA.\n\n"
        "Confirm this address to activate your account and start building your "
        "workspace.\n\n"
        f"{verification_link}\n\n"
        "The link expires in "
        f"{expires_in_minutes} minutes and can only be used once."
    )


def send_email_verification_email(
    *,
    to_email: str,
    verification_link: str,
    expires_in_minutes: int,
) -> None:
    """Send the address confirmation email to ``to_email``."""
    message = _build_message(
        to_email=to_email,
        subject="Verify your NEXORA email address",
        body=_render_email_verification_body(
            verification_link=verification_link,
            expires_in_minutes=expires_in_minutes,
        ),
    )

    _deliver(message)


def send_password_reset_email(
    *,
    to_email: str,
    reset_link: str,
    expires_in_minutes: int,
) -> None:
    """Send the password reset email to ``to_email``.

    The function raises :class:`EmailDeliveryError` when the mail server
    rejects the message so the caller never reports a success that did not
    happen.
    """
    message = _build_message(
        to_email=to_email,
        subject="Reset your NEXORA password",
        body=_render_password_reset_body(
            reset_link=reset_link,
            expires_in_minutes=expires_in_minutes,
        ),
    )

    _deliver(message)


def _render_contact_body(
    *,
    name: str,
    email: str,
    subject: str,
    message: str,
) -> str:
    return (
        "A visitor sent a message through the contact form of NEXORA."
        "\n\n"
        f"Name: {name}\n"
        f"Email: {email}\n"
        f"Topic: {subject}\n\n"
        f"{message}\n\n"
        "Answer the sender directly at the address above."
    )


def send_contact_message_email(
    *,
    to_email: str,
    name: str,
    email: str,
    subject: str,
    message: str,
) -> None:
    """Forward a message of the contact form to the inbox of the team.

    The function raises :class:`EmailDeliveryError` when the mail server
    rejects the message, the caller keeps the stored request in that case.
    """
    mail = _build_message(
        to_email=to_email,
        subject=f"NEXORA contact: {subject}",
        body=_render_contact_body(
            name=name,
            email=email,
            subject=subject,
            message=message,
        ),
    )

    _deliver(mail)
