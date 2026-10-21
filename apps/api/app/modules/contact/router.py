"""The contact form of the public landing page.

The endpoint is public, a visitor does not need an account to reach the
team. Every request is stored in the database, so a missing mail server never
loses a message.
"""

import logging

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.email import (
    EmailDeliveryError,
    send_contact_message_email,
    smtp_is_configured,
)
from app.db.models import ContactMessage
from app.db.session import get_db
from app.modules.contact.schemas import ContactRequest, ContactResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/contact", tags=["Contact"])


@router.post("", response_model=ContactResponse, status_code=status.HTTP_201_CREATED)
def send_contact_message(
    request: ContactRequest,
    db: Session = Depends(get_db),
):
    """Store a message of the contact form and forward it to the team."""
    record = ContactMessage(
        name=request.name.strip(),
        email=str(request.email).strip().lower(),
        subject=request.normalized_subject(),
        message=request.message.strip(),
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    if smtp_is_configured():
        try:
            send_contact_message_email(
                to_email=settings.contact_inbox_email,
                name=record.name,
                email=record.email,
                subject=record.subject,
                message=record.message,
            )
        except EmailDeliveryError as error:
            # The message stays in the database, the team can answer it there.
            logger.warning("The contact message was not forwarded: %s", error)

    return ContactResponse(
        message="Thanks for reaching out. We will get back to you shortly.",
        reference=str(record.id),
    )
