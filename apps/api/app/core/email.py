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


def smtp_is_configured() -> bool:
    """Report whether a mail server is available for real delivery."""
    return bool(settings.smtp_host.strip() and settings.smtp_from_email.strip())


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
        "We received a request to reset the password of your Nexa AI account."
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
        "Welcome to Nexa AI.\n\n"
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
        subject="Verify your Nexa AI email address",
        body=_render_email_verification_body(
            verification_link=verification_link,
            expires_in_minutes=expires_in_minutes,
        ),
    )

    server = None
    try:
        server = smtplib.SMTP(
            settings.smtp_host,
            settings.smtp_port,
            timeout=settings.smtp_timeout_seconds,
        )
        server.ehlo()
        if settings.smtp_use_starttls:
            server.starttls()
            server.ehlo()
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
        subject="Reset your Nexa AI password",
        body=_render_password_reset_body(
            reset_link=reset_link,
            expires_in_minutes=expires_in_minutes,
        ),
    )

    server = None
    try:
        server = smtplib.SMTP(
            settings.smtp_host,
            settings.smtp_port,
            timeout=settings.smtp_timeout_seconds,
        )
        server.ehlo()
        if settings.smtp_use_starttls:
            server.starttls()
            server.ehlo()
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
