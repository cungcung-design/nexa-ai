"""Stripe integration for the billing module.

Every call in this module talks to the real Stripe API. When the workspace
has no Stripe credentials configured the helpers raise
:class:`BillingProviderUnavailable` instead of simulating a result, so the
billing screens can show an accurate "provider not connected" state.
"""

from __future__ import annotations

from typing import Any, Optional

import stripe

from app.core.config import settings
from app.modules.billing.plans import (
    MONTHLY,
    Plan,
    YEARLY,
    get_plan,
)

#: Stripe API version pinned by the SDK in use.
STRIPE_API_VERSION = None


class BillingProviderUnavailable(RuntimeError):
    """Raised when the Stripe integration is not configured or unreachable."""


class BillingProviderError(RuntimeError):
    """Raised when Stripe rejected a billing operation."""


def _configure() -> None:
    stripe.api_key = settings.stripe_secret_key


def provider_configured() -> bool:
    """True when a usable Stripe secret key is configured."""
    key = (settings.stripe_secret_key or "").strip()
    if not key or "REPLACE" in key.upper():
        return False
    return True


def webhook_configured() -> bool:
    """True when a Stripe webhook signing secret is configured."""
    secret = (settings.stripe_webhook_secret or "").strip()
    if not secret or "REPLACE" in secret.upper():
        return False
    return True


def _require_provider() -> None:
    if not provider_configured():
        raise BillingProviderUnavailable(
            "The Stripe billing provider is not connected for this workspace. "
            "Set STRIPE_SECRET_KEY and the plan price identifiers to enable "
            "paid billing."
        )


def _call(operation, *args, **kwargs):
    """Run a Stripe call and translate failures into billing errors."""
    _require_provider()
    _configure()
    try:
        return operation(*args, **kwargs)
    except stripe.error.StripeError as exc:  # pragma: no cover - network path
        raise BillingProviderError(str(exc)) from exc


def create_checkout_session(
    organization_id: str,
    plan: str,
    interval: str = MONTHLY,
    customer_id: str | None = None,
    billing_email: str | None = None,
    success_url: str | None = None,
    cancel_url: str | None = None,
) -> dict[str, Any]:
    """Create a Stripe subscription checkout session for ``plan``."""
    _require_provider()
    catalog_plan: Plan = get_plan(plan)
    if catalog_plan.contact_sales:
        raise BillingProviderError(
            f"The {catalog_plan.label} plan is not available for self service checkout."
        )
    price_id = catalog_plan.stripe_price_id_for(interval)
    if not price_id:
        raise BillingProviderError(
            f"No Stripe price is configured for the {catalog_plan.label} "
            f"{interval} plan."
        )

    frontend = (settings.frontend_url or "").rstrip("/")
    params: dict[str, Any] = {
        "mode": "subscription",
        "line_items": [{"price": price_id, "quantity": 1}],
        "success_url": success_url
        or f"{frontend}/dashboard/organizations/{organization_id}/billing/subscription"
        f"?checkout=success",
        "cancel_url": cancel_url
        or f"{frontend}/dashboard/organizations/{organization_id}/billing/subscription"
        f"?checkout=canceled",
        "metadata": {"organization_id": organization_id, "plan": catalog_plan.key},
        "subscription_data": {
            "metadata": {"organization_id": organization_id},
        },
        "client_reference_id": organization_id,
        "allow_promotion_codes": True,
    }
    if customer_id:
        params["customer"] = customer_id
    elif billing_email:
        params["customer_email"] = billing_email

    session = _call(stripe.checkout.Session.create, **params)
    return {
        "id": session.id,
        "url": session.url,
        "expires_at": session.expires_at,
    }


def create_portal_session(
    customer_id: str, return_url: str
) -> dict[str, Any]:
    """Create a Stripe customer portal session."""
    session = _call(
        stripe.billing_portal.Session.create,
        customer=customer_id,
        return_url=return_url,
    )
    return {"id": session.id, "url": session.url}


def retrieve_subscription(subscription_id: str):
    """Retrieve a Stripe subscription."""
    return _call(stripe.Subscription.retrieve, subscription_id)


def list_provider_invoices(customer_id: str, limit: int = 50):
    """List Stripe invoices of a customer."""
    return _call(
        stripe.Invoice.list,
        customer=customer_id,
        limit=limit,
    )


def list_payment_methods(customer_id: str):
    """List the payment methods attached to a Stripe customer."""
    result = _call(
        stripe.PaymentMethod.list,
        customer=customer_id,
        type="card",
    )
    return list(result.data)


def attach_payment_method(
    customer_id: str, payment_method_id: str
):
    """Attach an existing payment method to a customer."""
    return _call(
        stripe.PaymentMethod.attach,
        payment_method_id,
        customer=customer_id,
    )


def detach_payment_method(payment_method_id: str):
    """Detach a payment method from its customer."""
    return _call(stripe.PaymentMethod.detach, payment_method_id)


def set_default_payment_method(
    customer_id: str, payment_method_id: str
):
    """Mark a payment method as the default for a customer."""
    return _call(
        stripe.Customer.modify,
        customer_id,
        invoice_settings={"default_payment_method": payment_method_id},
    )


def list_prices(price_ids: list[str]):
    """Retrieve the live Stripe prices for the given identifiers."""
    prices = []
    for price_id in price_ids:
        try:
            prices.append(_call(stripe.Price.retrieve, price_id))
        except BillingProviderError:
            continue
    return prices


def interval_of(price) -> str:
    """Map a Stripe price to a catalog billing interval."""
    recurring = getattr(price, "recurring", None)
    interval = getattr(recurring, "interval", None) if recurring else None
    return YEARLY if interval == "year" else MONTHLY


def normalize_payment_method(payment_method) -> dict[str, Any]:
    """Reduce a Stripe payment method to the values the UI may show."""
    card = getattr(payment_method, "card", None)
    return {
        "id": payment_method.id,
        "brand": getattr(card, "brand", "card") or "card",
        "last4": getattr(card, "last4", "") or "",
        "exp_month": getattr(card, "exp_month", None),
        "exp_year": getattr(card, "exp_year", None),
        "holder_name": getattr(card, "holder_name", None),
    }


def normalize_invoice(invoice) -> dict[str, Any]:
    """Reduce a Stripe invoice to the values the UI may show."""
    return {
        "provider_invoice_id": invoice.id,
        "number": invoice.number or invoice.id,
        "status": _invoice_status(invoice.status),
        "currency": invoice.currency or "usd",
        "amount_due": invoice.amount_due or 0,
        "amount_paid": invoice.amount_paid or 0,
        "tax_amount": invoice.total_taxes_amount or 0,
        "period_start": _timestamp(invoice.period_start),
        "period_end": _timestamp(invoice.period_end),
        "hosted_invoice_url": invoice.hosted_invoice_url,
        "invoice_pdf": invoice.invoice_pdf,
    }


def _invoice_status(status: Optional[str]) -> str:
    mapping = {
        "draft": "DRAFT",
        "open": "OPEN",
        "paid": "PAID",
        "uncollectible": "UNCOLLECTIBLE",
        "void": "VOID",
    }
    return mapping.get(status or "", (status or "DRAFT").upper())


def _timestamp(value) -> Optional[str]:
    if value is None:
        return None
    try:
        return value.isoformat()
    except AttributeError:  # pragma: no cover - defensive
        return str(value)
