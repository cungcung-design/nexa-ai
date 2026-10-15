from datetime import datetime, timezone
from uuid import UUID
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.db.models import MonthlyUsage, OrganizationSubscription
from app.modules.billing.plans import get_plan_limits


def current_period() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m")


def get_effective_plan(
    db: Session,
    organization_id: UUID,
) -> str:
    subscription = db.scalar(
        select(OrganizationSubscription).where(
            OrganizationSubscription.organization_id == organization_id
        )
    )
    if subscription is None:
        return "FREE"
    if subscription.status not in {"ACTIVE", "TRIALING"}:
        return "FREE"
    return subscription.plan


def check_request_quota(
    db: Session,
    organization_id: UUID,
) -> None:
    plan = get_effective_plan(db, organization_id)
    limit = get_plan_limits(plan).monthly_requests

    period = current_period()
    usage = db.scalar(
        select(MonthlyUsage).where(
            MonthlyUsage.organization_id == organization_id,
            MonthlyUsage.period == period,
        )
    )

    if usage and usage.request_count >= limit:
        raise HTTPException(
            status_code=429,
            detail=f"Monthly request quota exceeded ({limit} requests per month on {plan} plan)",
        )


def record_request_usage(
    db: Session,
    organization_id: UUID,
    prompt_tokens: int = 0,
    completion_tokens: int = 0,
) -> None:
    period = current_period()
    usage = db.scalar(
        select(MonthlyUsage).where(
            MonthlyUsage.organization_id == organization_id,
            MonthlyUsage.period == period,
        )
    )
    if usage is None:
        usage = MonthlyUsage(
            organization_id=organization_id,
            period=period,
            request_count=0,
            prompt_tokens=0,
            completion_tokens=0,
        )
        db.add(usage)

    usage.request_count += 1
    usage.prompt_tokens += prompt_tokens
    usage.completion_tokens += completion_tokens
    db.commit()