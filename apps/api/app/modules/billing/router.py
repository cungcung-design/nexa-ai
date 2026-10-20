"""Billing module APIs: catalog, subscription, usage, invoices and methods.

Billing information always belongs to a single workspace. Every endpoint
resolves the membership first, so a caller can never read or change billing
data of another organization.
"""

from __future__ import annotations

import uuid as uuid_mod
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.permissions import Permission, has_permission
from app.db.models import (
    BillingProfile,
    Invoice,
    Membership,
    OrganizationSubscription,
    PaymentMethodRecord,
    User,
)
from app.db.session import get_db
from app.modules.auth.dependencies import get_current_user
from app.modules.billing.plans import (
    CATALOG_ORDER,
    CURRENCY,
    MONTHLY,
    PLANS,
    YEARLY,
    get_plan,
    get_plan_limits,
)
from app.modules.billing.schemas import (
    BillingSettingsResponse,
    BillingSettingsUpdate,
    CancelRequest,
    CatalogPlanResponse,
    CatalogResponse,
    CheckoutRequest,
    CheckoutResponse,
    InvoiceListResponse,
    InvoiceResponse,
    MessageResponse,
    PaymentMethodListResponse,
    PaymentMethodResponse,
    PlanLimitsResponse,
    PlanPriceResponse,
    PortalSessionResponse,
    SubscriptionResponse,
    UsagePointResponse,
    UsageQuotaResponse,
    UsageResponse,
)
from app.modules.billing.stripe_service import (
    BillingProviderError,
    BillingProviderUnavailable,
    create_checkout_session,
    create_portal_session,
    detach_payment_method,
    list_payment_methods,
    list_provider_invoices,
    normalize_invoice,
    normalize_payment_method,
    provider_configured,
    set_default_payment_method,
)
from app.modules.billing.usage import (
    active_seats,
    current_period,
    estimated_cost_cents,
    get_effective_plan,
    get_subscription,
    period_bounds,
    period_workflow_executions,
    storage_mb,
    usage_trend,
)
from app.modules.organizations.router import require_membership
from app.modules.security.audit import record_audit_event

router = APIRouter(
    prefix="/api/v1/organizations/{organization_id}/billing",
    tags=["Billing"],
)

#: A checkout session blocks new checkouts for this long.
CHECKOUT_LOCK_MINUTES = 15


# --- Helpers ----------------------------------------------------------------


def _require_billing_manager(membership: Membership) -> Membership:
    """Require a membership that may change the billing configuration."""
    if not has_permission(membership.role, Permission.BILLING_MANAGE):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only owners can manage billing for this workspace",
        )
    return membership


def _limits_response(plan: str) -> PlanLimitsResponse:
    limits = get_plan_limits(plan)
    return PlanLimitsResponse(
        agents=limits.agents,
        monthly_requests=limits.monthly_requests,
        knowledge_bases=limits.knowledge_bases,
        workflow_executions=limits.workflow_executions,
        storage_mb=limits.storage_mb,
        seats=limits.seats,
    )


def _price_response(plan: str, interval: str) -> Optional[PlanPriceResponse]:
    price = get_plan(plan).price_for(interval)
    if price is None:
        return None
    return PlanPriceResponse(
        amount=price.amount,
        currency=price.currency,
        interval=price.interval,
        monthly_equivalent=price.monthly_equivalent,
        annual_total=price.annual_total,
    )


def _subscription_response(
    db: Session, organization_id: uuid_mod.UUID
) -> SubscriptionResponse:
    subscription = get_subscription(db, organization_id)
    plan = get_effective_plan(db, organization_id)
    interval = (subscription.interval if subscription else MONTHLY) or MONTHLY
    amount = subscription.price_amount if subscription else 0
    currency = subscription.currency if subscription else CURRENCY
    if not amount:
        price = get_plan(plan).price_for(interval)
        amount = price.amount if price else 0
        currency = price.currency if price else CURRENCY
    return SubscriptionResponse(
        plan=plan,
        plan_label=get_plan(plan).label,
        status=subscription.status if subscription else "ACTIVE",
        interval=interval,
        price_amount=amount,
        currency=currency,
        current_period_start=(
            subscription.current_period_start if subscription else None
        ),
        current_period_end=(
            subscription.current_period_end if subscription else None
        ),
        cancel_at_period_end=(
            bool(subscription.cancel_at_period_end) if subscription else False
        ),
        canceled_at=subscription.canceled_at if subscription else None,
        created_at=subscription.created_at if subscription else None,
        has_provider_subscription=bool(
            subscription and subscription.stripe_subscription_id
        ),
        provider_configured=provider_configured(),
        limits=_limits_response(plan),
        price=_price_response(plan, interval),
    )


def _billing_profile(
    db: Session, organization_id: uuid_mod.UUID
) -> BillingProfile:
    profile = db.scalar(
        select(BillingProfile).where(
            BillingProfile.organization_id == organization_id
        )
    )
    if profile is None:
        profile = BillingProfile(
            organization_id=organization_id,
            company_name="",
        )
        db.add(profile)
        db.commit()
        db.refresh(profile)
    return profile


def _sync_invoices(
    db: Session, subscription: Optional[OrganizationSubscription]
) -> None:
    """Mirror the provider invoices of the workspace into the database."""
    if subscription is None or not subscription.stripe_customer_id:
        return
    try:
        provider_invoices = list_provider_invoices(
            subscription.stripe_customer_id
        )
    except (BillingProviderUnavailable, BillingProviderError):
        return
    for provider_invoice in provider_invoices:
        payload = normalize_invoice(provider_invoice)
        existing = db.scalar(
            select(Invoice).where(
                Invoice.organization_id == subscription.organization_id,
                Invoice.provider_invoice_id == payload["provider_invoice_id"],
            )
        )
        if existing is None:
            existing = Invoice(
                organization_id=subscription.organization_id,
                provider_invoice_id=payload["provider_invoice_id"],
                number=payload["number"],
            )
            db.add(existing)
        existing.number = payload["number"]
        existing.status = payload["status"]
        existing.currency = payload["currency"]
        existing.amount_due = payload["amount_due"]
        existing.amount_paid = payload["amount_paid"]
        existing.tax_amount = payload["tax_amount"]
        existing.period_start = _parse_datetime(payload["period_start"])
        existing.period_end = _parse_datetime(payload["period_end"])
        existing.hosted_invoice_url = payload["hosted_invoice_url"]
        existing.invoice_pdf = payload["invoice_pdf"]
    db.commit()


def _sync_payment_methods(
    db: Session, subscription: Optional[OrganizationSubscription]
) -> None:
    """Mirror the provider payment methods into the database."""
    if subscription is None or not subscription.stripe_customer_id:
        return
    try:
        provider_methods = list_payment_methods(
            subscription.stripe_customer_id
        )
    except (BillingProviderUnavailable, BillingProviderError):
        return
    for provider_method in provider_methods:
        payload = normalize_payment_method(provider_method)
        existing = db.scalar(
            select(PaymentMethodRecord).where(
                PaymentMethodRecord.provider_payment_method_id == payload["id"]
            )
        )
        if existing is None:
            existing = PaymentMethodRecord(
                organization_id=subscription.organization_id,
                provider_payment_method_id=payload["id"],
                brand=payload["brand"],
                last4=payload["last4"],
            )
            db.add(existing)
        existing.organization_id = subscription.organization_id
        existing.brand = payload["brand"]
        existing.last4 = payload["last4"]
        existing.exp_month = payload["exp_month"]
        existing.exp_year = payload["exp_year"]
        existing.holder_name = payload["holder_name"]
    db.commit()


def _parse_datetime(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        return None


def _provider_failure(exc: Exception) -> HTTPException:
    if isinstance(exc, BillingProviderUnavailable):
        return HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)
        )
    return HTTPException(
        status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)
    )


# --- Catalog ----------------------------------------------------------------


@router.get("/catalog", response_model=CatalogResponse)
def billing_catalog(
    organization_id: uuid_mod.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """The pricing catalog with the prices and entitlements of every plan."""
    require_membership(db, current_user.id, organization_id)
    current = get_effective_plan(db, organization_id)
    plans = []
    for key in CATALOG_ORDER:
        plan = PLANS[key]
        monthly = plan.price_for(MONTHLY)
        yearly = plan.price_for(YEARLY)
        plans.append(
            CatalogPlanResponse(
                key=plan.key,
                label=plan.label,
                tagline=plan.tagline,
                features=list(plan.features),
                limits=_limits_response(plan.key),
                monthly=_price_response(plan.key, MONTHLY),
                yearly=_price_response(plan.key, YEARLY),
                contact_sales=plan.contact_sales,
                popular=plan.popular,
                purchasable=plan.purchasable,
                current=plan.key == current,
            )
        )
    return CatalogResponse(
        currency=CURRENCY,
        plans=plans,
        provider_configured=provider_configured(),
    )


# --- Plan and subscription --------------------------------------------------


@router.get("/plan")
def get_current_plan(
    organization_id: uuid_mod.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """The effective plan, its status and its entitlements."""
    require_membership(db, current_user.id, organization_id)
    subscription = get_subscription(db, organization_id)
    plan = get_effective_plan(db, organization_id)
    limits = get_plan_limits(plan)
    return {
        "plan": plan,
        "status": subscription.status if subscription else "ACTIVE",
        "limits": {
            "agents": limits.agents,
            "monthly_requests": limits.monthly_requests,
            "knowledge_bases": limits.knowledge_bases,
        },
    }


@router.get("/subscription", response_model=SubscriptionResponse)
def get_subscription_details(
    organization_id: uuid_mod.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """The subscription of the workspace including period and cancellation."""
    require_membership(db, current_user.id, organization_id)
    return _subscription_response(db, organization_id)


@router.post("/checkout", response_model=CheckoutResponse)
def create_checkout(
    organization_id: uuid_mod.UUID,
    request: CheckoutRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Start a subscription checkout for a plan."""
    membership = require_membership(db, current_user.id, organization_id)
    _require_billing_manager(membership)

    plan = get_plan(request.plan)
    if plan.key == "FREE":
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="The free plan is the default and cannot be purchased",
        )
    if plan.contact_sales:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                f"The {plan.label} plan is negotiated by sales and cannot be "
                "purchased online"
            ),
        )

    subscription = get_subscription(db, organization_id)
    now = datetime.now(timezone.utc)
    if (
        subscription is not None
        and subscription.checkout_created_at is not None
        and subscription.checkout_session_id
    ):
        age = now - subscription.checkout_created_at
        if age < timedelta(minutes=CHECKOUT_LOCK_MINUTES):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "A checkout session for this workspace is already open. "
                    "Complete or cancel it before starting a new one."
                ),
            )

    profile = _billing_profile(db, organization_id)
    customer_id = subscription.stripe_customer_id if subscription else None
    try:
        session = create_checkout_session(
            organization_id=str(organization_id),
            plan=plan.key,
            interval=request.interval,
            customer_id=customer_id,
            billing_email=profile.billing_email,
            success_url=(
                f"{(settings.frontend_url or '').rstrip('/')}"
                f"/dashboard/organizations/{organization_id}/billing/subscription"
                f"?checkout=success"
            ),
            cancel_url=(
                f"{(settings.frontend_url or '').rstrip('/')}"
                f"/dashboard/organizations/{organization_id}/billing/subscription"
                f"?checkout=canceled"
            ),
        )
    except (BillingProviderUnavailable, BillingProviderError) as exc:
        raise _provider_failure(exc)

    if subscription is None:
        subscription = OrganizationSubscription(
            organization_id=organization_id,
            plan=plan.key,
            status="PENDING",
            interval=request.interval,
            price_amount=(plan.price_for(request.interval).amount if plan.price_for(request.interval) else 0),
            currency=CURRENCY,
        )
        db.add(subscription)
    subscription.checkout_session_id = session["id"]
    subscription.checkout_created_at = now
    db.commit()

    record_audit_event(
        db,
        organization_id=organization_id,
        actor_user_id=current_user.id,
        action="billing.checkout_created",
        resource_type="billing",
        resource_id=organization_id,
        resource_name=f"{plan.label} plan",
        details={
            "plan": plan.key,
            "interval": request.interval,
            "previous_plan": get_effective_plan(db, organization_id),
        },
        changes={
            "before": {"plan": get_effective_plan(db, organization_id)},
            "after": {"plan": plan.key, "interval": request.interval},
        },
        summary=f"{current_user.email} started a plan change to {plan.label}.",
    )

    return CheckoutResponse(
        checkout_url=session["url"], session_id=session["id"]
    )


@router.post("/portal", response_model=PortalSessionResponse)
def create_billing_portal(
    organization_id: uuid_mod.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Open the provider hosted portal for subscription management."""
    membership = require_membership(db, current_user.id, organization_id)
    _require_billing_manager(membership)
    subscription = get_subscription(db, organization_id)
    if subscription is None or not subscription.stripe_customer_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This workspace has no provider billing account yet",
        )
    return_url = (
        f"{(settings.frontend_url or '').rstrip('/')}"
        f"/dashboard/organizations/{organization_id}/billing/subscription"
    )
    try:
        session = create_portal_session(subscription.stripe_customer_id, return_url)
    except (BillingProviderUnavailable, BillingProviderError) as exc:
        raise _provider_failure(exc)
    return PortalSessionResponse(url=session["url"])


@router.post("/subscription/cancel", response_model=SubscriptionResponse)
def cancel_subscription(
    organization_id: uuid_mod.UUID,
    request: CancelRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Cancel the subscription at the end of the paid period."""
    membership = require_membership(db, current_user.id, organization_id)
    _require_billing_manager(membership)
    subscription = get_subscription(db, organization_id)
    if subscription is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="This workspace has no subscription",
        )
    if subscription.status in {"CANCELED", "INCOMPLETE"}:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This subscription is already canceled",
        )

    before = {
        "status": subscription.status,
        "cancel_at_period_end": subscription.cancel_at_period_end,
    }
    subscription.cancel_at_period_end = bool(request.cancel_at_period_end)
    subscription.canceled_at = (
        datetime.now(timezone.utc) if request.cancel_at_period_end else None
    )
    db.commit()
    db.refresh(subscription)

    record_audit_event(
        db,
        organization_id=organization_id,
        actor_user_id=current_user.id,
        action="billing.subscription_canceled",
        resource_type="billing",
        resource_id=organization_id,
        resource_name=subscription.plan,
        details={"cancel_at_period_end": subscription.cancel_at_period_end},
        changes={
            "before": before,
            "after": {
                "status": subscription.status,
                "cancel_at_period_end": subscription.cancel_at_period_end,
            },
        },
        summary=(
            f"{current_user.email} scheduled the subscription cancellation "
            f"for the end of the paid period."
            if request.cancel_at_period_end
            else f"{current_user.email} canceled the subscription cancellation."
        ),
    )
    return _subscription_response(db, organization_id)


@router.post("/subscription/resume", response_model=SubscriptionResponse)
def resume_subscription(
    organization_id: uuid_mod.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Undo a scheduled cancellation."""
    membership = require_membership(db, current_user.id, organization_id)
    _require_billing_manager(membership)
    subscription = get_subscription(db, organization_id)
    if subscription is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="This workspace has no subscription",
        )
    if not subscription.cancel_at_period_end:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This subscription is not scheduled for cancellation",
        )
    subscription.cancel_at_period_end = False
    subscription.canceled_at = None
    db.commit()
    db.refresh(subscription)

    record_audit_event(
        db,
        organization_id=organization_id,
        actor_user_id=current_user.id,
        action="billing.subscription_resumed",
        resource_type="billing",
        resource_id=organization_id,
        resource_name=subscription.plan,
        details={},
        changes={
            "before": {"cancel_at_period_end": True},
            "after": {"cancel_at_period_end": False},
        },
        summary=f"{current_user.email} resumed the subscription.",
    )
    return _subscription_response(db, organization_id)


# --- Usage ------------------------------------------------------------------


@router.get("/usage", response_model=UsageResponse)
def billing_usage(
    organization_id: uuid_mod.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """The consumption of the workspace for the running billing period."""
    require_membership(db, current_user.id, organization_id)

    from app.db.models import MonthlyUsage

    subscription = get_subscription(db, organization_id)
    interval = (subscription.interval if subscription else MONTHLY) or MONTHLY
    period = current_period()
    usage = db.scalar(
        select(MonthlyUsage).where(
            MonthlyUsage.organization_id == organization_id,
            MonthlyUsage.period == period,
        )
    )
    requests = usage.request_count if usage else 0
    prompt_tokens = usage.prompt_tokens if usage else 0
    completion_tokens = usage.completion_tokens if usage else 0

    plan = get_effective_plan(db, organization_id)
    limits = get_plan_limits(plan)
    seats_used = active_seats(db, organization_id)
    used_storage = storage_mb(db, organization_id)
    trend = usage_trend(db, organization_id)

    quotas = [
        UsageQuotaResponse(
            key="ai_requests",
            label="AI Requests",
            unit="requests",
            used=requests,
            limit=limits.monthly_requests,
            unlimited=False,
            tracked=True,
        ),
        UsageQuotaResponse(
            key="workflow_executions",
            label="Workflow Executions",
            unit="executions",
            used=period_workflow_executions(db, organization_id, period),
            limit=limits.workflow_executions,
            unlimited=limits.unlimited_workflows,
            tracked=True,
        ),
        UsageQuotaResponse(
            key="knowledge_storage",
            label="Knowledge Storage",
            unit="MB",
            used=used_storage,
            limit=limits.storage_mb,
            unlimited=limits.unlimited_storage,
            tracked=True,
        ),
        UsageQuotaResponse(
            key="seats",
            label="Team Seats",
            unit="seats",
            used=seats_used,
            limit=limits.seats,
            unlimited=limits.seats <= 0,
            tracked=True,
        ),
    ]

    period_start, period_end = period_bounds(period)
    return UsageResponse(
        period=period,
        period_start=period_start,
        period_end=period_end,
        interval=interval,
        quotas=quotas,
        request_count=requests,
        prompt_tokens=prompt_tokens,
        completion_tokens=completion_tokens,
        estimated_cost_cents=estimated_cost_cents(
            prompt_tokens, completion_tokens
        ),
        seats_used=seats_used,
        trend=[
            UsagePointResponse(day=point["day"], value=point["value"])
            for point in trend
        ],
    )


# --- Invoices ---------------------------------------------------------------


@router.get("/invoices", response_model=InvoiceListResponse)
def list_invoices(
    organization_id: uuid_mod.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """The invoices issued for the workspace."""
    membership = require_membership(db, current_user.id, organization_id)
    if has_permission(membership.role, Permission.BILLING_MANAGE):
        subscription = get_subscription(db, organization_id)
        _sync_invoices(db, subscription)
    invoices = db.scalars(
        select(Invoice)
        .where(Invoice.organization_id == organization_id)
        .order_by(Invoice.created_at.desc())
    ).all()
    items = [
        InvoiceResponse(
            id=invoice.id,
            number=invoice.number,
            status=invoice.status,
            currency=invoice.currency,
            amount_due=invoice.amount_due,
            amount_paid=invoice.amount_paid,
            tax_amount=invoice.tax_amount,
            period_start=invoice.period_start,
            period_end=invoice.period_end,
            hosted_invoice_url=invoice.hosted_invoice_url,
            invoice_pdf=invoice.invoice_pdf,
            created_at=invoice.created_at,
        )
        for invoice in invoices
    ]
    return InvoiceListResponse(items=items, total=len(items))


@router.get("/invoices/{invoice_id}", response_model=InvoiceResponse)
def get_invoice(
    organization_id: uuid_mod.UUID,
    invoice_id: uuid_mod.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """A single invoice of the workspace."""
    require_membership(db, current_user.id, organization_id)
    invoice = db.scalar(
        select(Invoice).where(
            Invoice.id == invoice_id,
            Invoice.organization_id == organization_id,
        )
    )
    if invoice is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found"
        )
    return InvoiceResponse(
        id=invoice.id,
        number=invoice.number,
        status=invoice.status,
        currency=invoice.currency,
        amount_due=invoice.amount_due,
        amount_paid=invoice.amount_paid,
        tax_amount=invoice.tax_amount,
        period_start=invoice.period_start,
        period_end=invoice.period_end,
        hosted_invoice_url=invoice.hosted_invoice_url,
        invoice_pdf=invoice.invoice_pdf,
        created_at=invoice.created_at,
    )


# --- Payment methods --------------------------------------------------------


@router.get("/payment-methods", response_model=PaymentMethodListResponse)
def list_payment_methods_route(
    organization_id: uuid_mod.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """The payment methods available for the workspace."""
    membership = require_membership(db, current_user.id, organization_id)
    subscription = get_subscription(db, organization_id)
    if has_permission(membership.role, Permission.BILLING_MANAGE):
        _sync_payment_methods(db, subscription)
    methods = db.scalars(
        select(PaymentMethodRecord)
        .where(PaymentMethodRecord.organization_id == organization_id)
        .order_by(PaymentMethodRecord.created_at.desc())
    ).all()
    return PaymentMethodListResponse(
        items=[
            PaymentMethodResponse(
                id=method.id,
                brand=method.brand,
                last4=method.last4,
                exp_month=method.exp_month,
                exp_year=method.exp_year,
                holder_name=method.holder_name,
                is_default=method.is_default,
                in_use=bool(
                    subscription
                    and subscription.stripe_subscription_id
                    and method.is_default
                ),
            )
            for method in methods
        ],
        provider_configured=provider_configured(),
    )


@router.post("/payment-methods/portal", response_model=PortalSessionResponse)
def payment_method_portal(
    organization_id: uuid_mod.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Open the provider portal where a card is added or replaced."""
    membership = require_membership(db, current_user.id, organization_id)
    _require_billing_manager(membership)
    subscription = get_subscription(db, organization_id)
    if subscription is None or not subscription.stripe_customer_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "This workspace has no provider billing account yet. Start a "
                "checkout first."
            ),
        )
    return_url = (
        f"{(settings.frontend_url or '').rstrip('/')}"
        f"/dashboard/organizations/{organization_id}/billing/payment-methods"
    )
    try:
        session = create_portal_session(
            subscription.stripe_customer_id, return_url
        )
    except (BillingProviderUnavailable, BillingProviderError) as exc:
        raise _provider_failure(exc)
    return PortalSessionResponse(url=session["url"])


@router.post("/payment-methods/{payment_method_id}/default")
def set_default_payment_method_route(
    organization_id: uuid_mod.UUID,
    payment_method_id: uuid_mod.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Use a payment method for the next invoice."""
    membership = require_membership(db, current_user.id, organization_id)
    _require_billing_manager(membership)
    method = db.scalar(
        select(PaymentMethodRecord).where(
            PaymentMethodRecord.id == payment_method_id,
            PaymentMethodRecord.organization_id == organization_id,
        )
    )
    if method is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payment method not found",
        )
    subscription = get_subscription(db, organization_id)
    if subscription and subscription.stripe_customer_id:
        try:
            set_default_payment_method(
                subscription.stripe_customer_id,
                method.provider_payment_method_id,
            )
        except (BillingProviderUnavailable, BillingProviderError) as exc:
            raise _provider_failure(exc)
    for other in db.scalars(
        select(PaymentMethodRecord).where(
            PaymentMethodRecord.organization_id == organization_id
        )
    ).all():
        other.is_default = other.id == method.id
    db.commit()

    record_audit_event(
        db,
        organization_id=organization_id,
        actor_user_id=current_user.id,
        action="billing.payment_method_default",
        resource_type="billing",
        resource_id=str(method.id),
        resource_name=f"card ending in {method.last4}",
        details={"payment_method_id": str(method.id)},
        changes={"before": {}, "after": {"is_default": True}},
        summary=(
            f"{current_user.email} set the card ending in {method.last4} as "
            "the default payment method."
        ),
    )
    return MessageResponse(message="The default payment method was updated.")


@router.delete("/payment-methods/{payment_method_id}")
def remove_payment_method(
    organization_id: uuid_mod.UUID,
    payment_method_id: uuid_mod.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Remove a payment method from the workspace."""
    membership = require_membership(db, current_user.id, organization_id)
    _require_billing_manager(membership)
    method = db.scalar(
        select(PaymentMethodRecord).where(
            PaymentMethodRecord.id == payment_method_id,
            PaymentMethodRecord.organization_id == organization_id,
        )
    )
    if method is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payment method not found",
        )
    subscription = get_subscription(db, organization_id)
    if method.is_default and subscription and subscription.stripe_subscription_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "This payment method is used by the active subscription. Set "
                "another default before removing it."
            ),
        )
    if subscription and subscription.stripe_customer_id:
        try:
            detach_payment_method(method.provider_payment_method_id)
        except (BillingProviderUnavailable, BillingProviderError) as exc:
            raise _provider_failure(exc)
    db.delete(method)
    db.commit()

    record_audit_event(
        db,
        organization_id=organization_id,
        actor_user_id=current_user.id,
        action="billing.payment_method_removed",
        resource_type="billing",
        resource_id=str(payment_method_id),
        resource_name=f"card ending in {method.last4}",
        details={"payment_method_id": str(payment_method_id)},
        changes={"before": {"is_default": method.is_default}, "after": None},
        summary=(
            f"{current_user.email} removed the card ending in {method.last4}."
        ),
    )
    return MessageResponse(message="The payment method was removed.")


# --- Billing information ----------------------------------------------------


@router.get("/settings", response_model=BillingSettingsResponse)
def get_billing_settings(
    organization_id: uuid_mod.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """The billing information of the workspace."""
    require_membership(db, current_user.id, organization_id)
    profile = _billing_profile(db, organization_id)
    return BillingSettingsResponse(
        company_name=profile.company_name,
        billing_email=profile.billing_email,
        address=profile.address,
        tax_id=profile.tax_id,
    )


@router.put("/settings", response_model=BillingSettingsResponse)
def update_billing_settings(
    organization_id: uuid_mod.UUID,
    request: BillingSettingsUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update the billing information of the workspace."""
    membership = require_membership(db, current_user.id, organization_id)
    _require_billing_manager(membership)
    profile = _billing_profile(db, organization_id)
    before = {
        "company_name": profile.company_name,
        "billing_email": profile.billing_email,
        "address": profile.address,
        "tax_id": profile.tax_id,
    }
    profile.company_name = request.company_name.strip()
    profile.billing_email = (
        str(request.billing_email).strip() if request.billing_email else None
    )
    profile.address = request.address.strip() if request.address else None
    profile.tax_id = request.tax_id.strip() if request.tax_id else None
    db.commit()
    db.refresh(profile)

    record_audit_event(
        db,
        organization_id=organization_id,
        actor_user_id=current_user.id,
        action="billing.information_updated",
        resource_type="billing",
        resource_id=organization_id,
        resource_name=profile.company_name or str(organization_id),
        details={},
        changes={
            "before": before,
            "after": {
                "company_name": profile.company_name,
                "billing_email": profile.billing_email,
                "address": profile.address,
                "tax_id": profile.tax_id,
            },
        },
        summary=f"{current_user.email} updated the billing information.",
    )
    return BillingSettingsResponse(
        company_name=profile.company_name,
        billing_email=profile.billing_email,
        address=profile.address,
        tax_id=profile.tax_id,
    )
