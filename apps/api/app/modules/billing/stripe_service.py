"""Stripe integration for the billing module.

Every call in this module talks to the real Stripe API. When the workspace
has no Stripe credentials configured the helpers raise
:class:`BillingProviderUnavailable` instead of simulating a result, so the
billing screens can show an accurate "provider not connected" state.
"""

from __future__ import annotations

from datetime import datetime, timezone
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
    """True when a Stripe test secret key is configured.

    Live keys are refused here as well as at production boot. An empty value
    leaves billing disconnected.
    """
    key = (settings.stripe_secret_key or "").strip()
    return key.startswith("sk_test_") and "REPLACE" not in key.upper()


def webhook_configured() -> bool:
    """True when a Stripe webhook signing secret is configured."""
    secret = (settings.stripe_webhook_secret or "").strip()
    return secret.startswith("whsec_") and "REPLACE" not in secret.upper()


def ensure_test_mode_event(event) -> None:
    """Refuse a live-mode Stripe event before it can change billing state."""
    if isinstance(event, dict):
        livemode = bool(event.get("livemode"))
    else:
        livemode = bool(getattr(event, "livemode", False))
    if livemode:
        raise BillingProviderError("Live Stripe events are not accepted")


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
        raise BillingProviderError(
            "The billing provider rejected the request"
        ) from exc


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
        "metadata": {
            "organization_id": organization_id,
            "plan": catalog_plan.key,
            "interval": interval,
        },
        "subscription_data": {
            "metadata": {
                "organization_id": organization_id,
                "plan": catalog_plan.key,
                "interval": interval,
            },
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


def schedule_provider_cancellation(
    subscription_id: str, cancel_at_period_end: bool
):
    """Tell Stripe whether the subscription ends at the period boundary."""
    return _call(
        stripe.Subscription.modify,
        subscription_id,
        cancel_at_period_end=cancel_at_period_end,
    )


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


def _invoice_field(invoice, name: str, default=None):
    try:
        value = getattr(invoice, name)
    except AttributeError:
        return default
    return default if value is None else value


def normalize_invoice(invoice) -> dict[str, Any]:
    """Reduce a Stripe invoice to the values the UI may show."""
    invoice_id = _invoice_field(invoice, "id", "")
    return {
        "provider_invoice_id": invoice_id,
        "number": _invoice_field(invoice, "number", invoice_id),
        "status": _invoice_status(_invoice_field(invoice, "status")),
        "currency": _invoice_field(invoice, "currency", "usd"),
        "amount_due": _invoice_field(invoice, "amount_due", 0) or 0,
        "amount_paid": _invoice_field(invoice, "amount_paid", 0) or 0,
        "tax_amount": _tax_amount(invoice),
        "period_start": _timestamp(_invoice_field(invoice, "period_start")),
        "period_end": _timestamp(_invoice_field(invoice, "period_end")),
        "hosted_invoice_url": _invoice_field(invoice, "hosted_invoice_url"),
        "invoice_pdf": _invoice_field(invoice, "invoice_pdf"),
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


def _tax_amount(invoice) -> int:
    tax = getattr(invoice, "tax", None)
    if tax is None:
        tax = getattr(invoice, "total_taxes_amount", None)
    try:
        return int(tax or 0)
    except (TypeError, ValueError):
        return 0


def _timestamp(value) -> Optional[str]:
    if value is None:
        return None
    if isinstance(value, datetime):
        moment = value if value.tzinfo else value.replace(tzinfo=timezone.utc)
        return moment.isoformat()
    if isinstance(value, (int, float)) or (
        isinstance(value, str) and value.isdigit()
    ):
        return datetime.fromtimestamp(int(value), tz=timezone.utc).isoformat()
    try:
        return value.isoformat()
    except AttributeError:
        return str(value)
