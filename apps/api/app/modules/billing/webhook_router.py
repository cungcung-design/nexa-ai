"""Stripe webhooks that keep the workspace subscription in sync.

Events are verified against the Stripe signing secret, deduplicated by their
event identifier and applied idempotently. An older event is recorded and
then ignored so an out-of-order delivery cannot roll the subscription back.
The stored record keeps the event identity and the workspace mapping. It
does not keep card numbers, secrets, or customer contact details.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Optional

import stripe
from fastapi import APIRouter, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.models import (
    Invoice,
    OrganizationSubscription,
    StripeWebhookEvent,
)
from app.db.session import SessionLocal
from app.modules.billing.plans import PLANS, plan_for_stripe_price
from app.modules.billing.stripe_service import (
    BillingProviderError,
    ensure_test_mode_event,
    normalize_invoice,
    webhook_configured,
)
from app.modules.security.audit import record_audit_event_safe

router = APIRouter(prefix="/api/v1/billing", tags=["Stripe Webhooks"])

#: Stripe event types that are recorded in the audit trail.
BILLING_EVENTS: dict[str, tuple[str, str]] = {
    "checkout.session.completed": ("subscription.updated", "success"),
    "customer.subscription.created": ("subscription.updated", "success"),
    "customer.subscription.updated": ("subscription.updated", "success"),
    "customer.subscription.deleted": ("subscription.updated", "success"),
    "invoice.payment_succeeded": ("payment.succeeded", "success"),
    "invoice.payment_failed": ("payment.failed", "failed"),
}

SUBSCRIPTION_EVENTS = {
    "checkout.session.completed",
    "customer.subscription.created",
    "customer.subscription.updated",
    "customer.subscription.deleted",
    "invoice.payment_succeeded",
    "invoice.payment_failed",
}


def _value(source: Any, name: str, default: Any = None) -> Any:
    if source is None:
        return default
    if isinstance(source, dict):
        return source.get(name, default)
    getter = getattr(source, "get", None)
    if callable(getter):
        found = getter(name, default)
        if found is not default:
            return found
    return getattr(source, name, default)


def _metadata_organization(source: Any) -> Optional[str]:
    metadata = _value(source, "metadata") or {}
    organization_id = _value(metadata, "organization_id")
    if organization_id:
        return str(organization_id)
    return None


def _event_object(event) -> Any:
    data = getattr(event, "data", None)
    if data is None:
        return None
    return _value(data, "object")


def _organization_id_from_event(db: Session, event) -> Optional[str]:
    provider_object = _event_object(event)
    candidates = [provider_object]
    for name in ("subscription_details", "parent"):
        nested = _value(provider_object, name)
        if nested is None:
            continue
        candidates.append(nested)
        details = _value(nested, "subscription_details")
        if details is not None:
            candidates.append(details)
    for candidate in candidates:
        organization_id = _metadata_organization(candidate)
        if organization_id:
            return organization_id

    customer_id = _value(provider_object, "customer")
    if isinstance(customer_id, str):
        match = db.scalar(
            select(OrganizationSubscription).where(
                OrganizationSubscription.stripe_customer_id == customer_id
            )
        )
        if match is not None:
            return str(match.organization_id)

    subscription_id = _value(provider_object, "subscription")
    if not isinstance(subscription_id, str) and str(
        getattr(event, "type", "")
    ).startswith("customer.subscription"):
        subscription_id = _value(provider_object, "id")
    if isinstance(subscription_id, str):
        match = db.scalar(
            select(OrganizationSubscription).where(
                OrganizationSubscription.stripe_subscription_id
                == subscription_id
            )
        )
        if match is not None:
            return str(match.organization_id)
    return None


def _public_event_record(event, organization_id: Optional[str]) -> dict:
    """Identity of an event, without payment instruments or contact data."""
    provider_object = _event_object(event)
    customer_id = _value(provider_object, "customer")
    subscription_id = _value(provider_object, "subscription")
    return {
        "id": event.id,
        "type": event.type,
        "created": int(getattr(event, "created", 0) or 0),
        "organization_id": organization_id,
        "object_id": _value(provider_object, "id"),
        "customer_id": customer_id if isinstance(customer_id, str) else None,
        "subscription_id": (
            subscription_id if isinstance(subscription_id, str) else None
        ),
        "status": _value(provider_object, "status"),
    }


def _timestamp(value: Any) -> Optional[datetime]:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    if isinstance(value, str):
        try:
            parsed = datetime.fromisoformat(value)
        except ValueError:
            parsed = None
        if parsed is not None:
            return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
        if not value.isdigit():
            return None
        value = int(value)
    try:
        return datetime.fromtimestamp(int(value), tz=timezone.utc)
    except (TypeError, ValueError, OSError):
        return None


def _organization_uuid(organization_id: str) -> Optional[uuid.UUID]:
    try:
        return uuid.UUID(str(organization_id))
    except (ValueError, AttributeError):
        return None


def _subscription(
    db: Session, organization_id: str
) -> Optional[OrganizationSubscription]:
    identifier = _organization_uuid(organization_id)
    if identifier is None:
        return None
    return db.scalar(
        select(OrganizationSubscription).where(
            OrganizationSubscription.organization_id == identifier
        )
    )


def _event_is_stale(
    db: Session, organization_id: str, event_created: datetime
) -> bool:
    """True when a newer processed event already updated this workspace."""
    created = int(event_created.timestamp())
    rows = db.scalars(
        select(StripeWebhookEvent).where(StripeWebhookEvent.processed.is_(True))
    ).all()
    for row in rows:
        payload = row.payload or {}
        recorded_org = payload.get("organization_id")
        if not recorded_org:
            legacy = (
                ((payload.get("data") or {}).get("object") or {}).get(
                    "metadata"
                )
                or {}
            )
            recorded_org = legacy.get("organization_id")
        if str(recorded_org or "") != str(organization_id):
            continue
        if payload.get("type") not in SUBSCRIPTION_EVENTS and row.event_type not in SUBSCRIPTION_EVENTS:
            continue
        previous = payload.get("created")
        if isinstance(previous, int) and previous > created:
            return True
    return False


def _price_id(provider_object: Any) -> Optional[str]:
    items = _value(provider_object, "items")
    data = _value(items, "data") or []
    try:
        price = _value(data[0], "price")
    except (IndexError, TypeError):
        return None
    if isinstance(price, str):
        return price
    identifier = _value(price, "id")
    return identifier if isinstance(identifier, str) else None


def _apply_catalog_plan(
    subscription: OrganizationSubscription, plan_key: str, interval: str
) -> None:
    catalog_plan = PLANS.get(str(plan_key).strip().upper())
    if catalog_plan is None or catalog_plan.contact_sales or catalog_plan.key == "FREE":
        return
    subscription.plan = catalog_plan.key
    normalized = "yearly" if str(interval).strip().lower() == "yearly" else "monthly"
    price = catalog_plan.price_for(normalized)
    if price is None:
        return
    subscription.interval = normalized
    subscription.price_amount = price.amount
    subscription.currency = price.currency


def _apply_subscription_update(
    subscription: OrganizationSubscription, provider_object: Any
) -> None:
    """Copy the provider subscription state onto the local record."""
    status = str(_value(provider_object, "status", "") or "").upper()
    if status:
        subscription.status = status
    current_period_start = _timestamp(
        _value(provider_object, "current_period_start")
    )
    current_period_end = _timestamp(_value(provider_object, "current_period_end"))
    if current_period_start:
        subscription.current_period_start = current_period_start
    if current_period_end:
        subscription.current_period_end = current_period_end
    cancel_at_period_end = _value(provider_object, "cancel_at_period_end")
    if cancel_at_period_end is not None:
        subscription.cancel_at_period_end = bool(cancel_at_period_end)
    provider_id = _value(provider_object, "id")
    if isinstance(provider_id, str):
        subscription.stripe_subscription_id = provider_id
    customer_id = _value(provider_object, "customer")
    if isinstance(customer_id, str):
        subscription.stripe_customer_id = customer_id
    resolved = plan_for_stripe_price(_price_id(provider_object))
    if resolved:
        plan_key, interval = resolved
        _apply_catalog_plan(subscription, plan_key, interval)
    else:
        metadata = _value(provider_object, "metadata") or {}
        _apply_catalog_plan(
            subscription,
            str(_value(metadata, "plan") or ""),
            str(_value(metadata, "interval") or subscription.interval),
        )
    subscription.checkout_session_id = None
    subscription.checkout_created_at = None


def _apply_invoice(
    db: Session, organization_id: str, provider_invoice: Any
) -> None:
    identifier = _organization_uuid(organization_id)
    if identifier is None or provider_invoice is None:
        return
    payload = normalize_invoice(provider_invoice)
    invoice = db.scalar(
        select(Invoice).where(
            Invoice.organization_id == identifier,
            Invoice.provider_invoice_id == payload["provider_invoice_id"],
        )
    )
    if invoice is None:
        invoice = Invoice(
            organization_id=identifier,
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
    if event.type in SUBSCRIPTION_EVENTS and _event_is_stale(
        db, organization_id, event_created
    ):
        return

    event_type = event.type
    provider_object = _event_object(event)

    if event_type in {
        "checkout.session.completed",
        "customer.subscription.updated",
        "customer.subscription.created",
        "customer.subscription.deleted",
    }:
        subscription = _subscription(db, organization_id)
        if subscription is None:
            return
        if event_type == "checkout.session.completed":
            customer_id = _value(provider_object, "customer")
            if isinstance(customer_id, str):
                subscription.stripe_customer_id = customer_id
            provider_subscription = _value(provider_object, "subscription")
            if isinstance(provider_subscription, str):
                subscription.stripe_subscription_id = provider_subscription
            subscription.status = "ACTIVE"
            subscription.checkout_session_id = None
            subscription.checkout_created_at = None
            metadata = _value(provider_object, "metadata") or {}
            _apply_catalog_plan(
                subscription,
                str(_value(metadata, "plan") or ""),
                str(_value(metadata, "interval") or ""),
            )
        elif event_type == "customer.subscription.deleted":
            subscription.status = "CANCELED"
            subscription.cancel_at_period_end = False
            subscription.canceled_at = datetime.now(timezone.utc)
        else:
            _apply_subscription_update(subscription, provider_object)
        db.commit()

    elif event_type in {
        "invoice.created",
        "invoice.updated",
        "invoice.payment_succeeded",
        "invoice.payment_failed",
        "invoice.finalized",
    }:
        _apply_invoice(db, organization_id, provider_object)
        subscription = _subscription(db, organization_id)
        if subscription is not None and event_type == "invoice.payment_failed":
            if subscription.status != "CANCELED":
                subscription.status = "PAST_DUE"
        elif (
            subscription is not None
            and event_type == "invoice.payment_succeeded"
            and subscription.status == "PAST_DUE"
        ):
            subscription.status = "ACTIVE"
        db.commit()


def apply_verified_event(db: Session, event) -> dict[str, bool]:
    """Record and apply an event that has already passed signature checks."""
    ensure_test_mode_event(event)
    existing = db.scalar(
        select(StripeWebhookEvent).where(
            StripeWebhookEvent.event_id == event.id
        )
    )
    if existing:
        return {"received": True, "duplicate": True}

    organization_id = _organization_id_from_event(db, event)
    webhook_event = StripeWebhookEvent(
        event_id=event.id,
        event_type=event.type,
        processed=False,
        payload=_public_event_record(event, organization_id),
    )
    db.add(webhook_event)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        return {"received": True, "duplicate": True}

    event_created = datetime.fromtimestamp(
        int(getattr(event, "created", 0) or 0), tz=timezone.utc
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
            summary=f'Stripe reported "{event.type}" for this workspace.',
        )
    return {"received": True, "duplicate": False}


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
        return apply_verified_event(db, event)
    except BillingProviderError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    finally:
        db.close()
