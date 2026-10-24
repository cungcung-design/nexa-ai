"""Tests for the Billing module.

The billing module is only complete when the numbers on the screens come
from real records and when a payment provider that is not connected fails
honestly instead of returning a simulated result.
"""

import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.db.models import (
    Invoice,
    MonthlyUsage,
    OrganizationSubscription,
    PaymentMethodRecord,
)
from app.modules.billing.usage import current_period
from app.modules.security.audit_models import SecurityAuditEvent

PASSWORD = "Billing-Module-Secure-Pass"


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
    """Owner, admin, developer and viewer of one billing workspace."""
    suffix = uuid.uuid4().hex[:10]
    emails = {
        "owner": f"billing-owner-{suffix}@example.com",
        "admin": f"billing-admin-{suffix}@example.com",
        "developer": f"billing-developer-{suffix}@example.com",
        "viewer": f"billing-viewer-{suffix}@example.com",
        "outsider": f"billing-outsider-{suffix}@example.com",
    }
    tokens = {role: _register(client, email) for role, email in emails.items()}

    organization = client.post(
        "/api/v1/organizations",
        headers=_auth(tokens["owner"]),
        json={"name": "Billing Test Org", "slug": f"billing-test-{suffix}"},
    )
    assert organization.status_code == 201, organization.text
    org_id = organization.json()["id"]

    for role in ("admin", "developer", "viewer"):
        added = client.post(
            f"/api/v1/organizations/{org_id}/members",
            headers=_auth(tokens["owner"]),
            json={"email": emails[role], "role": role.upper()},
        )
        assert added.status_code == 201, added.text

    return {
        "org_id": org_id,
        "emails": emails,
        "tokens": tokens,
    }


# --- Catalog ----------------------------------------------------------------


def test_catalog_exposes_plans_prices_and_entitlements(client: TestClient, workspace):
    org_id = workspace["org_id"]

    response = client.get(
        f"/api/v1/organizations/{org_id}/billing/catalog",
        headers=_auth(workspace["tokens"]["owner"]),
    )
    assert response.status_code == 200, response.text
    body = response.json()

    assert body["currency"] == "usd"
    keys = [plan["key"] for plan in body["plans"]]
    assert keys == ["FREE", "STARTER", "PRO", "BUSINESS"]

    pro = next(plan for plan in body["plans"] if plan["key"] == "PRO")
    assert pro["monthly"]["amount"] == 4900
    assert pro["yearly"]["amount"] == 49000
    assert pro["yearly"]["monthly_equivalent"] == round(49000 / 12)
    assert pro["popular"] is True
    assert pro["limits"]["agents"] == 10
    assert pro["features"]

    free = next(plan for plan in body["plans"] if plan["key"] == "FREE")
    assert free["monthly"]["amount"] == 0
    assert free["yearly"] is None

    enterprise = next(plan for plan in body["plans"] if plan["key"] == "BUSINESS")
    assert enterprise["contact_sales"] is True
    assert enterprise["purchasable"] is False


def test_new_workspace_starts_on_the_free_plan(client: TestClient, workspace):
    org_id = workspace["org_id"]

    response = client.get(
        f"/api/v1/organizations/{org_id}/billing/subscription",
        headers=_auth(workspace["tokens"]["owner"]),
    )
    assert response.status_code == 200, response.text
    body = response.json()

    assert body["plan"] == "FREE"
    assert body["status"] == "ACTIVE"
    assert body["cancel_at_period_end"] is False
    assert body["has_provider_subscription"] is False
    assert body["limits"]["monthly_requests"] == 100
    assert body["price"]["amount"] == 0


# --- Usage ------------------------------------------------------------------


def test_usage_reports_the_real_quotas_of_the_period(client: TestClient, workspace):
    org_id = workspace["org_id"]

    response = client.get(
        f"/api/v1/organizations/{org_id}/billing/usage",
        headers=_auth(workspace["tokens"]["owner"]),
    )
    assert response.status_code == 200, response.text
    body = response.json()

    quotas = {quota["key"]: quota for quota in body["quotas"]}
    assert quotas["ai_requests"]["used"] == 0
    assert quotas["ai_requests"]["limit"] == 100
    assert quotas["workflow_executions"]["limit"] == 100
    assert quotas["knowledge_storage"]["limit"] == 100
    assert quotas["seats"]["used"] == 4
    assert quotas["seats"]["limit"] == 5
    assert body["request_count"] == 0
    assert body["period"]
    assert body["period_start"]
    assert body["period_end"]


def test_usage_is_isolated_between_organizations(client: TestClient, workspace):
    org_id = workspace["org_id"]

    response = client.get(
        f"/api/v1/organizations/{org_id}/billing/usage",
        headers=_auth(workspace["tokens"]["outsider"]),
    )
    assert response.status_code == 404, response.text


# --- Permission boundaries --------------------------------------------------


def test_billing_mutations_require_the_owner(client: TestClient, workspace):
    org_id = workspace["org_id"]
    tokens = workspace["tokens"]

    for role in ("admin", "developer", "viewer"):
        checkout = client.post(
            f"/api/v1/organizations/{org_id}/billing/checkout",
            headers=_auth(tokens[role]),
            json={"plan": "PRO", "interval": "monthly"},
        )
        assert checkout.status_code == 403, (role, checkout.text)

        settings = client.put(
            f"/api/v1/organizations/{org_id}/billing/settings",
            headers=_auth(tokens[role]),
            json={"company_name": "Nope"},
        )
        assert settings.status_code == 403, (role, settings.text)

        cancel = client.post(
            f"/api/v1/organizations/{org_id}/billing/subscription/cancel",
            headers=_auth(tokens[role]),
            json={"cancel_at_period_end": True},
        )
        assert cancel.status_code == 403, (role, cancel.text)


def test_every_member_may_read_the_billing_state(client: TestClient, workspace):
    org_id = workspace["org_id"]
    tokens = workspace["tokens"]

    for role in ("owner", "admin", "developer", "viewer"):
        for path in (
            "catalog",
            "subscription",
            "usage",
            "invoices",
            "payment-methods",
            "settings",
        ):
            response = client.get(
                f"/api/v1/organizations/{org_id}/billing/{path}",
                headers=_auth(tokens[role]),
            )
            assert response.status_code == 200, (role, path, response.text)


def test_billing_reads_are_isolated_between_organizations(client: TestClient, workspace):
    org_id = workspace["org_id"]
    outsider = workspace["tokens"]["outsider"]

    for path in ("subscription", "usage", "invoices", "payment-methods"):
        response = client.get(
            f"/api/v1/organizations/{org_id}/billing/{path}",
            headers=_auth(outsider),
        )
        assert response.status_code == 404, (path, response.text)


# --- Seat quota -------------------------------------------------------------


def test_seat_quota_is_enforced_on_both_member_paths(client: TestClient, workspace):
    """A seat is a plan entitlement, so every path that adds one is checked."""
    org_id = workspace["org_id"]
    tokens = workspace["tokens"]
    emails = workspace["emails"]

    # The workspace has four members, the free plan grants five seats.
    fifth = client.post(
        f"/api/v1/organizations/{org_id}/members",
        headers=_auth(tokens["owner"]),
        json={"email": emails["outsider"], "role": "VIEWER"},
    )
    assert fifth.status_code == 201, fifth.text

    overflow_email = f"seat-overflow-{uuid.uuid4().hex[:8]}@example.com"
    overflow_token = _register(client, overflow_email)

    # The direct member path rejects the extra seat.
    direct = client.post(
        f"/api/v1/organizations/{org_id}/members",
        headers=_auth(tokens["owner"]),
        json={"email": overflow_email, "role": "VIEWER"},
    )
    assert direct.status_code == 409, direct.text
    assert "Seat quota" in direct.json()["detail"]

    # The invitation path rejects it as well.
    invitation = client.post(
        f"/api/v1/organizations/{org_id}/team/invitations",
        headers=_auth(tokens["owner"]),
        json={"email": overflow_email, "role": "VIEWER"},
    )
    assert invitation.status_code == 201, invitation.text
    invite_token = invitation.json()["invite_token"]

    accepted = client.post(
        f"/api/v1/invitations/{invite_token}/accept",
        headers=_auth(overflow_token),
    )
    assert accepted.status_code == 409, accepted.text
    assert "Seat quota" in accepted.json()["detail"]


# --- Provider failures ------------------------------------------------------


def test_checkout_fails_honestly_when_the_provider_is_not_connected(
    client: TestClient, workspace
):
    org_id = workspace["org_id"]

    response = client.post(
        f"/api/v1/organizations/{org_id}/billing/checkout",
        headers=_auth(workspace["tokens"]["owner"]),
        json={"plan": "PRO", "interval": "monthly"},
    )
    body = response.json()
    catalog = client.get(
        f"/api/v1/organizations/{org_id}/billing/catalog",
        headers=_auth(workspace["tokens"]["owner"]),
    ).json()

    if catalog["provider_configured"]:
        assert response.status_code == 200, response.text
        assert body["checkout_url"].startswith("https://")
    else:
        assert response.status_code == 503, response.text
        assert "not connected" in body["detail"]
        assert "checkout_url" not in body


def test_portal_fails_honestly_without_a_provider_account(client: TestClient, workspace):
    org_id = workspace["org_id"]

    response = client.post(
        f"/api/v1/organizations/{org_id}/billing/portal",
        headers=_auth(workspace["tokens"]["owner"]),
    )
    body = response.json()
    assert response.status_code == 409, response.text
    assert "provider billing account" in body["detail"]


def test_free_plan_cannot_be_purchased(client: TestClient, workspace):
    org_id = workspace["org_id"]

    response = client.post(
        f"/api/v1/organizations/{org_id}/billing/checkout",
        headers=_auth(workspace["tokens"]["owner"]),
        json={"plan": "FREE", "interval": "monthly"},
    )
    assert response.status_code == 422, response.text


def test_enterprise_plan_is_not_self_serve(client: TestClient, workspace):
    org_id = workspace["org_id"]

    response = client.post(
        f"/api/v1/organizations/{org_id}/billing/checkout",
        headers=_auth(workspace["tokens"]["owner"]),
        json={"plan": "BUSINESS", "interval": "monthly"},
    )
    assert response.status_code == 422, response.text
    assert "sales" in response.json()["detail"].lower()


# --- Subscription lifecycle -------------------------------------------------


def test_cancellation_is_scheduled_and_can_be_resumed(
    client: TestClient, workspace, db_session
):
    org_id = workspace["org_id"]
    token = workspace["tokens"]["owner"]

    db_session.add(
        OrganizationSubscription(
            organization_id=uuid.UUID(org_id),
            plan="PRO",
            status="ACTIVE",
            interval="monthly",
            price_amount=4900,
            currency="usd",
        )
    )
    db_session.commit()

    canceled = client.post(
        f"/api/v1/organizations/{org_id}/billing/subscription/cancel",
        headers=_auth(token),
        json={"cancel_at_period_end": True},
    )
    assert canceled.status_code == 200, canceled.text
    assert canceled.json()["cancel_at_period_end"] is True
    assert canceled.json()["canceled_at"] is not None

    # Scheduling the same cancellation again is idempotent.
    again = client.post(
        f"/api/v1/organizations/{org_id}/billing/subscription/cancel",
        headers=_auth(token),
        json={"cancel_at_period_end": True},
    )
    assert again.status_code == 200, again.text
    assert again.json()["cancel_at_period_end"] is True

    resumed = client.post(
        f"/api/v1/organizations/{org_id}/billing/subscription/resume",
        headers=_auth(token),
    )
    assert resumed.status_code == 200, resumed.text
    assert resumed.json()["cancel_at_period_end"] is False
    assert resumed.json()["canceled_at"] is None

    # Resuming a live subscription is a conflict.
    redundant = client.post(
        f"/api/v1/organizations/{org_id}/billing/subscription/resume",
        headers=_auth(token),
    )
    assert redundant.status_code == 409, redundant.text


def test_cancelling_without_a_subscription_is_not_found(client: TestClient, workspace):
    org_id = workspace["org_id"]

    response = client.post(
        f"/api/v1/organizations/{org_id}/billing/subscription/cancel",
        headers=_auth(workspace["tokens"]["owner"]),
        json={"cancel_at_period_end": True},
    )
    assert response.status_code == 404, response.text


# --- Billing information ----------------------------------------------------


def test_billing_information_is_stored_for_the_workspace(client: TestClient, workspace):
    org_id = workspace["org_id"]
    token = workspace["tokens"]["owner"]

    updated = client.put(
        f"/api/v1/organizations/{org_id}/billing/settings",
        headers=_auth(token),
        json={
            "company_name": "Nexa Test GmbH",
            "billing_email": "billing@nexa.example.com",
            "address": "Teststreet 1, Berlin",
            "tax_id": "DE123456789",
        },
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["company_name"] == "Nexa Test GmbH"
    assert updated.json()["tax_id"] == "DE123456789"

    stored = client.get(
        f"/api/v1/organizations/{org_id}/billing/settings",
        headers=_auth(token),
    )
    assert stored.status_code == 200, stored.text
    assert stored.json()["billing_email"] == "billing@nexa.example.com"

    other = client.put(
        f"/api/v1/organizations/{org_id}/billing/settings",
        headers=_auth(token),
        json={"company_name": "Nexa Test GmbH", "billing_email": "not-an-email"},
    )
    assert other.status_code == 422, other.text


# --- Invoices and payment methods -------------------------------------------


def test_invoice_listing_only_returns_the_workspace_invoices(
    client: TestClient, workspace, db_session
):
    org_id = workspace["org_id"]
    token = workspace["tokens"]["owner"]

    other_org = client.post(
        "/api/v1/organizations",
        headers=_auth(token),
        json={"name": "Other Org", "slug": f"other-{uuid.uuid4().hex[:8]}"},
    )
    assert other_org.status_code == 201, other_org.text
    other_org_id = other_org.json()["id"]

    db_session.add(
        Invoice(
            organization_id=uuid.UUID(org_id),
            provider_invoice_id="in_test_1",
            number="INV-TEST-1",
            status="PAID",
            currency="usd",
            amount_due=4900,
            amount_paid=4900,
        )
    )
    db_session.add(
        Invoice(
            organization_id=uuid.UUID(other_org_id),
            provider_invoice_id="in_other_1",
            number="INV-OTHER-1",
            status="PAID",
            currency="usd",
            amount_due=4900,
            amount_paid=4900,
        )
    )
    db_session.commit()

    listing = client.get(
        f"/api/v1/organizations/{org_id}/billing/invoices",
        headers=_auth(token),
    )
    assert listing.status_code == 200, listing.text
    numbers = {item["number"] for item in listing.json()["items"]}
    assert "INV-TEST-1" in numbers
    assert "INV-OTHER-1" not in numbers


def test_invoice_detail_is_scoped_to_the_workspace(client: TestClient, workspace, db_session):
    org_id = workspace["org_id"]
    token = workspace["tokens"]["owner"]

    invoice = Invoice(
        organization_id=uuid.UUID(org_id),
        provider_invoice_id="in_detail_1",
        number="INV-DETAIL-1",
        status="OPEN",
        currency="usd",
        amount_due=1900,
        amount_paid=0,
    )
    db_session.add(invoice)
    db_session.commit()
    db_session.refresh(invoice)

    found = client.get(
        f"/api/v1/organizations/{org_id}/billing/invoices/{invoice.id}",
        headers=_auth(token),
    )
    assert found.status_code == 200, found.text
    assert found.json()["number"] == "INV-DETAIL-1"
    assert found.json()["amount_due"] == 1900

    missing = client.get(
        f"/api/v1/organizations/{org_id}/billing/invoices/{uuid.uuid4()}",
        headers=_auth(token),
    )
    assert missing.status_code == 404, missing.text


def test_payment_methods_are_listed_and_can_be_removed(
    client: TestClient, workspace, db_session
):
    org_id = workspace["org_id"]
    token = workspace["tokens"]["owner"]

    method = PaymentMethodRecord(
        organization_id=uuid.UUID(org_id),
        provider_payment_method_id="pm_test_123",
        brand="visa",
        last4="4242",
        exp_month=12,
        exp_year=2030,
        is_default=False,
    )
    db_session.add(method)
    db_session.commit()
    db_session.refresh(method)

    listing = client.get(
        f"/api/v1/organizations/{org_id}/billing/payment-methods",
        headers=_auth(token),
    )
    assert listing.status_code == 200, listing.text
    body = listing.json()
    assert body["items"]
    entry = next(item for item in body["items"] if item["id"] == str(method.id))
    assert entry["last4"] == "4242"
    assert entry["exp_month"] == 12
    assert "provider_payment_method_id" not in entry

    removed = client.delete(
        f"/api/v1/organizations/{org_id}/billing/payment-methods/{method.id}",
        headers=_auth(token),
    )
    assert removed.status_code == 200, removed.text

    after = client.get(
        f"/api/v1/organizations/{org_id}/billing/payment-methods",
        headers=_auth(token),
    )
    assert all(item["id"] != str(method.id) for item in after.json()["items"])


def test_payment_method_of_another_workspace_is_not_found(
    client: TestClient, workspace, db_session
):
    org_id = workspace["org_id"]
    token = workspace["tokens"]["owner"]

    method = PaymentMethodRecord(
        organization_id=uuid.UUID(org_id),
        provider_payment_method_id="pm_test_foreign",
        brand="visa",
        last4="1881",
    )
    db_session.add(method)
    db_session.commit()
    db_session.refresh(method)

    other_org = client.post(
        "/api/v1/organizations",
        headers=_auth(token),
        json={"name": "Foreign Org", "slug": f"foreign-{uuid.uuid4().hex[:8]}"},
    )
    assert other_org.status_code == 201, other_org.text
    other_org_id = other_org.json()["id"]

    response = client.delete(
        f"/api/v1/organizations/{other_org_id}/billing/payment-methods/{method.id}",
        headers=_auth(token),
    )
    assert response.status_code == 404, response.text


# --- Audit ------------------------------------------------------------------


def test_billing_changes_are_audited(client: TestClient, workspace, db_session):
    org_id = workspace["org_id"]
    token = workspace["tokens"]["owner"]

    db_session.add(
        OrganizationSubscription(
            organization_id=uuid.UUID(org_id),
            plan="PRO",
            status="ACTIVE",
            interval="monthly",
            price_amount=4900,
            currency="usd",
        )
    )
    db_session.commit()

    client.put(
        f"/api/v1/organizations/{org_id}/billing/settings",
        headers=_auth(token),
        json={"company_name": "Audited Company"},
    )
    client.post(
        f"/api/v1/organizations/{org_id}/billing/subscription/cancel",
        headers=_auth(token),
        json={"cancel_at_period_end": True},
    )

    events = client.get(
        f"/api/v1/organizations/{org_id}/audit-logs?limit=100",
        headers=_auth(token),
    )
    assert events.status_code == 200, events.text
    actions = {item["action"] for item in events.json()["items"]}
    assert "billing.information_updated" in actions
    assert "billing.subscription_canceled" in actions


def test_billing_audit_events_record_the_change(client: TestClient, workspace, db_session):
    org_id = workspace["org_id"]
    token = workspace["tokens"]["owner"]

    client.put(
        f"/api/v1/organizations/{org_id}/billing/settings",
        headers=_auth(token),
        json={"company_name": "Before", "tax_id": "A-1"},
    )
    client.put(
        f"/api/v1/organizations/{org_id}/billing/settings",
        headers=_auth(token),
        json={"company_name": "After", "tax_id": "B-2"},
    )

    event = db_session.scalar(
        select(SecurityAuditEvent)
        .where(
            SecurityAuditEvent.organization_id == uuid.UUID(org_id),
            SecurityAuditEvent.action == "billing.information_updated",
        )
        .order_by(SecurityAuditEvent.created_at.desc())
    )
    assert event is not None
    assert event.changes["before"]["company_name"] == "Before"
    assert event.changes["after"]["company_name"] == "After"
    assert event.actor_user_id is not None


def test_request_quota_is_enforced_before_a_model_call(
    client: TestClient, workspace, db_session
):
    org_id = workspace["org_id"]
    db_session.add(
        MonthlyUsage(
            organization_id=uuid.UUID(org_id),
            period=current_period(),
            request_count=100,
            prompt_tokens=0,
            completion_tokens=0,
        )
    )
    db_session.commit()

    response = client.post(
        f"/api/v1/organizations/{org_id}/agents/{uuid.uuid4()}/chat",
        headers=_auth(workspace["tokens"]["owner"]),
        json={"message": "This request is over the free quota."},
    )
    assert response.status_code == 429, response.text
    assert "quota" in response.json()["detail"].lower()


def test_agent_quota_is_enforced(client: TestClient, workspace):
    org_id = workspace["org_id"]
    token = workspace["tokens"]["owner"]
    for index in range(2):
        created = client.post(
            f"/api/v1/organizations/{org_id}/agents",
            headers=_auth(token),
            json={"name": f"Quota Agent {index}"},
        )
        assert created.status_code == 201, created.text

    overflow = client.post(
        f"/api/v1/organizations/{org_id}/agents",
        headers=_auth(token),
        json={"name": "Quota Agent overflow"},
    )
    assert overflow.status_code == 409, overflow.text
    assert "Agent quota" in overflow.json()["detail"]


def test_provider_cancellation_is_not_faked_when_stripe_is_disconnected(
    client: TestClient, workspace, db_session
):
    org_id = workspace["org_id"]
    db_session.add(
        OrganizationSubscription(
            organization_id=uuid.UUID(org_id),
            plan="PRO",
            status="ACTIVE",
            interval="monthly",
            price_amount=4900,
            currency="usd",
            stripe_subscription_id="sub_disconnected",
        )
    )
    db_session.commit()

    response = client.post(
        f"/api/v1/organizations/{org_id}/billing/subscription/cancel",
        headers=_auth(workspace["tokens"]["owner"]),
        json={"cancel_at_period_end": True},
    )
    assert response.status_code == 503, response.text

    current = client.get(
        f"/api/v1/organizations/{org_id}/billing/subscription",
        headers=_auth(workspace["tokens"]["owner"]),
    )
    assert current.status_code == 200, current.text
    assert current.json()["cancel_at_period_end"] is False
