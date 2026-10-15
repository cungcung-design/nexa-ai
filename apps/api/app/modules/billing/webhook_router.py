import stripe
from fastapi import APIRouter, HTTPException, Request
from sqlalchemy.orm import Session
from app.core.config import settings
from app.db.session import SessionLocal
from app.db.models import StripeWebhookEvent


router = APIRouter(prefix="/api/v1/billing", tags=["Stripe Webhooks"])


@router.post("/webhook")
async def stripe_webhook(request: Request):
    payload = await request.body()
    signature = request.headers.get("stripe-signature")

    if not signature:
        raise HTTPException(
            status_code=400,
            detail="Missing Stripe signature",
        )

    try:
        event = stripe.Webhook.construct_event(
            payload, signature, settings.stripe_webhook_secret
        )
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid signature")

    db = SessionLocal()
    try:
        existing = db.scalar(
            StripeWebhookEvent.__table__.select().where(
                StripeWebhookEvent.event_id == event.id
            )
        )
        if existing:
            return {"received": True, "duplicate": True}

        webhook_event = StripeWebhookEvent(
            event_id=event.id,
            event_type=event.type,
            processed=False,
            payload=event.to_dict(),
        )
        db.add(webhook_event)
        db.commit()
    finally:
        db.close()

    return {"received": True}