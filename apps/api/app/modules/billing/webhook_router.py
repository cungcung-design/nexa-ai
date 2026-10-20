"""Stripe webhooks that keep the workspace subscription in sync.

Events are verified against the Stripe signing secret, deduplicated by their
event identifier and applied idempotently. Older events are ignored so an
out-of-order delivery cannot roll the subscription back to an earlier state.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional

import stripe
from fastapi import APIRouter, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.models import (
    Invoice,
    OrganizationSubscription,
    StripeWebhookEvent,
)
from app.db.session import SessionLocal
from app.modules.billing.plans import get_plan, plan_for_stripe_price
from app.modules.billing.stripe_service import (
    normalize_invoice,
    provider_configured,
    webhook_configured,
)
from app.modules.security.audit import record_audit_event_safe

router = APIRouter(prefix="/api/v1/billing", tags=["Stripe Webhooks"])

#: Stripe event types that are recorded in the audit trail.
BILLING_EVENTS: dict[str, tuple[str, str]] = {
    "checkout.session.completed": ("subscription.updated", "success"),
    "customer.subscription.updated": ("subscription.updated", "success"),
    "customer.subscription.deleted": ("subscription.updated", "success"),
    "invoice.payment_succeeded": ("payment.succeeded", "success"),
    "invoice.payment_failed": ("payment.failed", "failed"),
}


def _organization_id_from_event(event) -> Optional[str]:
    payload = event.to_dict()
    candidates = [
        (payload.get("data") or {}).get("object") or {},
        payload,
    ]
    for candidate in candidates:
        metadata = candidate.get("metadata") or {}
        organization_id = metadata.get("organization_id")
        if organization_id:
            return organization_id
    return None


def _timestamp(value: Any) -> Optional[datetime]:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    try:
        return datetime.fromtimestamp(int(value), tz=timezone.utc)
    except (TypeError, ValueError):
        return None


def _subscription(
    db: Session, organization_id: str
) -> Optional[OrganizationSubscription]:
    try:
        import uuid as uuid_mod

        identifier = uuid_mod.UUID(str(organization_id))
    except (ValueError, AttributeError):
        return None
    return db.scalar(
        select(OrganizationSubscription).where(
            OrganizationSubscription.organization_id == identifier
        )
    )


def _apply_subscription_update(
    db: Session, subscription: OrganizationSubscription, provider_object: Any
) -> None:
    """Copy the provider subscription state onto the local record."""
    status = str(getattr(provider_object, "status", "") or "").upper()
    if status:
        subscription.status = status
    current_period_start = _timestamp(
        getattr(provider_object, "current_period_start", None)
    )
    current_period_end = _timestamp(
        getattr(provider_object, "current_period_end", None)
    )
    if current_period_start:
        subscription.current_period_start = current_period_start
    if current_period_end:
        subscription.current_period_end = current_period_end
    cancel_at_period_end = getattr(
        provider_object, "cancel_at_period_end", None
    )
    if cancel_at_period_end is not None:
        subscription.cancel_at_period_end = bool(cancel_at_period_end)
    provider_id = getattr(provider_object, "id", None)
    if provider_id:
        subscription.stripe_subscription_id = provider_id
    items = getattr(provider_object, "items", None)
    price_id = None
    if items is not None:
        try:
            price_id = items.data[0].price.id
        except (AttributeError, IndexError, TypeError):
            price_id = None
    resolved = plan_for_stripe_price(price_id)
    if resolved:
        plan_key, interval = resolved
        subscription.plan = plan_key
        subscription.interval = interval
        price = get_plan(plan_key).price_for(interval)
        if price:
            subscription.price_amount = price.amount
            subscription.currency = price.currency
    subscription.checkout_session_id = None
    subscription.checkout_created_at = None


def _apply_invoice(
    db: Session, organization_id: str, provider_invoice: Any
) -> None:
    payload = normalize_invoice(provider_invoice)
    invoice = db.scalar(
        select(Invoice).where(
            Invoice.organization_id == organization_id,
            Invoice.provider_invoice_id == payload["provider_invoice_id"],
        )
    )
    if invoice is None:
        invoice = Invoice(
            organization_id=organization_id,
            provider_invoice_id=payload["provider_invoice_id"],
            number=payload["number"],
        )
        db.add(invoice)
    invoice.number = payload["number"]
    invoice.status = payload["status"]
    invoice.currency = payload["currency"]
    invoice.amount_due = payload["amount_due"]
    invoice.amount_paid = payload["amount_paid"]
    invoice.tax_amount = payload["tax_amount"]
    invoice.period_start = _timestamp(payload["period_start"])
    invoice.period_end = _timestamp(payload["period_end"])
    invoice.hosted_invoice_url = payload["hosted_invoice_url"]
    invoice.invoice_pdf = payload["invoice_pdf"]


def _apply_event(
    db: Session, event, organization_id: str, event_created: datetime
) -> None:
    """Apply a provider event to the local subscription and invoices."""
    event_type = event.type
    provider_object = (event.data.get("object") if event.data else None)

    if event_type in {
        "checkout.session.completed",
        "customer.subscription.updated",
        "customer.subscription.deleted",
        "customer.subscription.created",
    }:
        subscription = _subscription(db, organization_id)
        if subscription is None:
            return
        # Out-of-order deliveries are ignored: an older event must never
        # overwrite a newer state.
        if (
            subscription.updated_at is not None
            and event_created < subscription.updated_at
        ):
            return
        if event_type == "checkout.session.completed":
            customer_id = getattr(provider_object, "customer", None)
            if isinstance(customer_id, str):
                subscription.stripe_customer_id = customer_id
            provider_subscription = getattr(
                provider_object, "subscription", None
            )
            if isinstance(provider_subscription, str):
                subscription.stripe_subscription_id = provider_subscription
            subscription.status = "ACTIVE"
            subscription.checkout_session_id = None
            subscription.checkout_created_at = None
            metadata = getattr(provider_object, "metadata", None) or {}
            plan_key = metadata.get("plan")
            if plan_key:
                subscription.plan = str(plan_key).upper()
                subscription.interval = str(
                    metadata.get("interval", subscription.interval)
                )
        elif event_type == "customer.subscription.deleted":
            subscription.status = "CANCELED"
            subscription.canceled_at = datetime.now(timezone.utc)
        else:
            _apply_subscription_update(db, subscription, provider_object)
        db.commit()

    elif event_type in {
        "invoice.created",
        "invoice.updated",
        "invoice.payment_succeeded",
        "invoice.payment_failed",
        "invoice.finalized",
    }:
        _apply_invoice(db, organization_id, provider_object)
        if event_type == "invoice.payment_failed":
            subscription = _subscription(db, organization_id)
            if subscription is not None:
                subscription.status = "PAST_DUE"
                db.commit()
        else:
            db.commit()


@router.post("/webhook")
async def stripe_webhook(request: Request):
    payload = await request.body()
    signature = request.headers.get("stripe-signature")

    if not signature:
        raise HTTPException(
            status_code=400,
            detail="Missing Stripe signature",
        )
    if not webhook_configured():
        raise HTTPException(
            status_code=503,
            detail="The Stripe webhook secret is not configured",
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
            select(StripeWebhookEvent).where(
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

        organization_id = _organization_id_from_event(event)
        event_created = datetime.fromtimestamp(
            getattr(event, "created", 0) or 0, tz=timezone.utc
        )
        if organization_id:
            _apply_event(db, event, organization_id, event_created)
            webhook_event.processed = True
            db.commit()

        audit = BILLING_EVENTS.get(event.type)
        if audit and organization_id:
            action, outcome = audit
            record_audit_event_safe(
                db,
                organization_id=organization_id,
                actor_type="system",
                action=action,
                resource_type="billing",
                resource_id=organization_id,
                resource_name=organization_id,
                outcome=outcome,
                source="stripe_webhook",
                details={
                    "stripe_event_id": event.id,
                    "stripe_event_type": event.type,
                },
                summary=(
                    f"Stripe reported \"{event.type}\" for this workspace."
                ),
            )
    finally:
        db.close()

    return {"received": True}
