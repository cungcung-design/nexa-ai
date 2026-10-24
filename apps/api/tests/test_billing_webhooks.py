"""Stripe webhook verification, idempotency, and subscription transitions.

These tests sign fixtures locally. They do not call Stripe and they do not
use a live secret.
"""

import hashlib
import hmac
import json
import time
import uuid

import pytest
import stripe
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.core.config import settings
from app.db.models import Invoice, OrganizationSubscription, StripeWebhookEvent
from app.modules.billing.webhook_router import apply_verified_event

PASSWORD = "Billing-Webhook-Pass"
WEBHOOK_SECRET = "whsec_test_billing_fixture"
PRO_PRICE = "price_test_pro_monthly"


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _register(client: TestClient, email: str) -> str:
    created = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": PASSWORD},
    )
    assert created.status_code == 201, created.text
    return created.json()["access_token"]


@pytest.fixture
def workspace(client: TestClient):
    suffix = uuid.uuid4().hex[:10]
    token = _register(client, f"billing-hook-{suffix}@example.com")
    organization = client.post(
        "/api/v1/organizations",
        headers=_auth(token),
        json={"name": "Webhook Org", "slug": f"webhook-{suffix}"},
    )
    assert organization.status_code == 201, organization.text
    return {"org_id": organization.json()["id"], "token": token}


@pytest.fixture
def signed_billing(monkeypatch):
    monkeypatch.setattr(settings, "stripe_webhook_secret", WEBHOOK_SECRET)
    monkeypatch.setattr(settings, "stripe_pro_price_id", PRO_PRICE)
    return WEBHOOK_SECRET


def _sign(payload: bytes, secret: str, stamp: int | None = None) -> str:
    moment = int(time.time()) if stamp is None else stamp
    signed = f"{moment}.{payload.decode()}"
    digest = hmac.new(
        secret.encode("utf-8"), signed.encode("utf-8"), hashlib.sha256
    ).hexdigest()
    return f"t={moment},v1={digest}"


def _event(body: dict, secret: str = WEBHOOK_SECRET):
    raw = json.dumps(body)
    return stripe.Webhook.construct_event(raw, _sign(raw.encode(), secret), secret)


def _subscription_event(
    organization_id: str,
    *,
    event_id: str,
    created: int,
    event_type: str = "customer.subscription.updated",
    status: str = "active",
    price_id: str = PRO_PRICE,
    customer: str = "cus_test",
    subscription_id: str = "sub_test",
    plan: str = "PRO",
    interval: str = "monthly",
) -> dict:
    return {
        "id": event_id,
        "object": "event",
        "api_version": "2024-06-20",
        "created": created,
        "type": event_type,
        "livemode": False,
        "pending_webhooks": 1,
        "request": {"id": None, "idempotency_key": None},
        "data": {
            "object": {
                "id": subscription_id,
                "object": "subscription",
                "status": status,
                "customer": customer,
                "cancel_at_period_end": False,
                "current_period_start": created,
                "current_period_end": created + 2592000,
                "metadata": {
                    "organization_id": organization_id,
                    "plan": plan,
                    "interval": interval,
                },
                "items": {
                    "object": "list",
                    "data": [
                        {
                            "id": "si_test",
                            "object": "subscription_item",
                            "price": {"id": price_id, "object": "price"},
                        }
                    ],
                },
            }
        },
    }


def _ensure_subscription(db_session, organization_id: str, **values):
    row = OrganizationSubscription(
        organization_id=uuid.UUID(organization_id),
        plan=values.get("plan", "FREE"),
        status=values.get("status", "ACTIVE"),
        interval="monthly",
        price_amount=values.get("price_amount", 0),
        currency="usd",
        stripe_customer_id=values.get("stripe_customer_id"),
        stripe_subscription_id=values.get("stripe_subscription_id"),
    )
    db_session.add(row)
    db_session.commit()
    return row


def test_missing_signature_does_not_change_the_subscription(
    client: TestClient, workspace
):
    response = client.post(
        "/api/v1/billing/webhook",
        content=b"{}",
        headers={"Content-Type": "application/json"},
    )
    assert response.status_code == 400, response.text
    assert "signature" in response.json()["detail"].lower()


def test_unconfigured_webhook_secret_rejects_a_signed_body(
    client: TestClient, workspace
):
    raw = b'{"id":"evt_unconfigured"}'
    response = client.post(
        "/api/v1/billing/webhook",
        content=raw,
        headers={
            "Content-Type": "application/json",
            "stripe-signature": _sign(raw, "whsec_not_the_configured_secret"),
        },
    )
    assert response.status_code == 503, response.text


def test_invalid_signature_is_rejected(client: TestClient, workspace, signed_billing):
    raw = b'{"id":"evt_bad"}'
    response = client.post(
        "/api/v1/billing/webhook",
        content=raw,
        headers={
            "Content-Type": "application/json",
            "stripe-signature": _sign(raw, "whsec_wrong_secret"),
        },
    )
    assert response.status_code == 400, response.text
    assert response.json()["detail"] == "Invalid signature"


def test_subscription_update_sets_plan_and_ignores_an_older_event(
    workspace, db_session, signed_billing
):
    org_id = workspace["org_id"]
    _ensure_subscription(db_session, org_id)
    newer = _event(
        _subscription_event(org_id, event_id="evt_new", created=1_761_200_000)
    )
    older = _event(
        _subscription_event(
            org_id,
            event_id="evt_old",
            created=1_761_100_000,
            price_id="price_test_starter",
            status="active",
            plan="STARTER",
            interval="monthly",
        )
    )

    assert apply_verified_event(db_session, newer)["duplicate"] is False
    assert apply_verified_event(db_session, older)["duplicate"] is False

    current = db_session.scalar(
        select(OrganizationSubscription).where(
            OrganizationSubscription.organization_id == uuid.UUID(org_id)
        )
    )
    assert current.plan == "PRO"
    assert current.status == "ACTIVE"
    assert current.price_amount == 4900
    assert current.stripe_subscription_id == "sub_test"
    assert current.interval == "monthly"


def test_duplicate_event_is_not_applied_twice(workspace, db_session, signed_billing):
    org_id = workspace["org_id"]
    _ensure_subscription(db_session, org_id)
    event = _event(
        _subscription_event(org_id, event_id="evt_once", created=1_761_200_100)
    )
    assert apply_verified_event(db_session, event)["duplicate"] is False
    again = apply_verified_event(db_session, event)
    assert again["duplicate"] is True
    stored = db_session.scalars(
        select(StripeWebhookEvent).where(
            StripeWebhookEvent.event_id == "evt_once"
        )
    ).all()
    assert len(stored) == 1


def test_checkout_completion_records_the_interval(
    workspace, db_session, signed_billing
):
    org_id = workspace["org_id"]
    _ensure_subscription(db_session, org_id)
    event = _event(
        {
            "id": "evt_checkout",
            "object": "event",
            "api_version": "2024-06-20",
            "created": 1_761_200_200,
            "type": "checkout.session.completed",
            "livemode": False,
            "pending_webhooks": 1,
            "request": {"id": None, "idempotency_key": None},
            "data": {
                "object": {
                    "id": "cs_test",
                    "object": "checkout.session",
                    "customer": "cus_checkout",
                    "subscription": "sub_checkout",
                    "metadata": {
                        "organization_id": org_id,
                        "plan": "STARTER",
                        "interval": "yearly",
                    },
                    "customer_details": {
                        "email": "hidden-billing@example.com"
                    },
                }
            },
        }
    )
    apply_verified_event(db_session, event)
    current = db_session.scalar(
        select(OrganizationSubscription).where(
            OrganizationSubscription.organization_id == uuid.UUID(org_id)
        )
    )
    assert current.plan == "STARTER"
    assert current.interval == "yearly"
    assert current.price_amount == 19000
    assert current.status == "ACTIVE"
    assert current.stripe_customer_id == "cus_checkout"
    stored = db_session.scalar(
        select(StripeWebhookEvent).where(
            StripeWebhookEvent.event_id == "evt_checkout"
        )
    )
    assert "hidden-billing@example.com" not in json.dumps(stored.payload)


def test_payment_failure_and_recovery_update_status_and_hide_card_data(
    workspace, db_session, signed_billing
):
    org_id = workspace["org_id"]
    _ensure_subscription(
        db_session,
        org_id,
        plan="PRO",
        price_amount=4900,
        stripe_customer_id="cus_invoice",
    )
    failed = _event(
        {
            "id": "evt_failed",
            "object": "event",
            "api_version": "2024-06-20",
            "created": 1_761_200_300,
            "type": "invoice.payment_failed",
            "livemode": False,
            "pending_webhooks": 1,
            "request": {"id": None, "idempotency_key": None},
            "data": {
                "object": {
                    "id": "in_failed",
                    "object": "invoice",
                    "number": "INV-FAILED",
                    "status": "open",
                    "currency": "usd",
                    "amount_due": 4900,
                    "amount_paid": 0,
                    "customer": "cus_invoice",
                    "period_start": 1_761_200_300,
                    "period_end": 1_763_792_300,
                    "payment_method_details": {
                        "card": {"number": "4242424242424242"}
                    },
                }
            },
        }
    )
    apply_verified_event(db_session, failed)
    current = db_session.scalar(
        select(OrganizationSubscription).where(
            OrganizationSubscription.organization_id == uuid.UUID(org_id)
        )
    )
    assert current.status == "PAST_DUE"
    invoice = db_session.scalar(
        select(Invoice).where(Invoice.provider_invoice_id == "in_failed")
    )
    assert invoice is not None
    assert invoice.number == "INV-FAILED"
    assert invoice.amount_due == 4900
    stored = db_session.scalar(
        select(StripeWebhookEvent).where(
            StripeWebhookEvent.event_id == "evt_failed"
        )
    )
    assert "4242424242424242" not in json.dumps(stored.payload)

    paid = _event(
        {
            "id": "evt_paid",
            "object": "event",
            "api_version": "2024-06-20",
            "created": 1_761_200_400,
            "type": "invoice.payment_succeeded",
            "livemode": False,
            "pending_webhooks": 1,
            "request": {"id": None, "idempotency_key": None},
            "data": {
                "object": {
                    "id": "in_failed",
                    "object": "invoice",
                    "number": "INV-FAILED",
                    "status": "paid",
                    "currency": "usd",
                    "amount_due": 4900,
                    "amount_paid": 4900,
                    "customer": "cus_invoice",
                    "period_start": 1_761_200_300,
                    "period_end": 1_763_792_300,
                }
            },
        }
    )
    apply_verified_event(db_session, paid)
    db_session.refresh(current)
    db_session.refresh(invoice)
    assert current.status == "ACTIVE"
    assert invoice.status == "PAID"
    assert invoice.amount_paid == 4900


def test_subscription_deletion_cancels_access(workspace, db_session, signed_billing):
    org_id = workspace["org_id"]
    _ensure_subscription(
        db_session,
        org_id,
        plan="PRO",
        price_amount=4900,
        stripe_subscription_id="sub_delete",
    )
    event = _event(
        _subscription_event(
            org_id,
            event_id="evt_deleted",
            created=1_761_200_500,
            event_type="customer.subscription.deleted",
            status="canceled",
            subscription_id="sub_delete",
        )
    )
    apply_verified_event(db_session, event)
    current = db_session.scalar(
        select(OrganizationSubscription).where(
            OrganizationSubscription.organization_id == uuid.UUID(org_id)
        )
    )
    assert current.status == "CANCELED"


def test_signed_webhook_route_applies_the_event(
    client: TestClient, workspace, db_session, signed_billing, monkeypatch
):
    org_id = workspace["org_id"]
    _ensure_subscription(db_session, org_id)
    body = _subscription_event(
        org_id, event_id="evt_route", created=1_761_200_600
    )
    raw = json.dumps(body).encode()

    class _Keeper:
        def close(self):
            return None

        def __getattr__(self, name):
            return getattr(db_session, name)

    monkeypatch.setattr(
        "app.modules.billing.webhook_router.SessionLocal",
        lambda: _Keeper(),
    )
    response = client.post(
        "/api/v1/billing/webhook",
        content=raw,
        headers={
            "Content-Type": "application/json",
            "stripe-signature": _sign(raw, WEBHOOK_SECRET),
        },
    )
    assert response.status_code == 200, response.text
    assert response.json()["received"] is True
    current = db_session.scalar(
        select(OrganizationSubscription).where(
            OrganizationSubscription.organization_id == uuid.UUID(org_id)
        )
    )
    assert current.plan == "PRO"
