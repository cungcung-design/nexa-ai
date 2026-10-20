"""Billing usage metering and entitlement checks.

Every counter written here is idempotent per request: a request is counted
once, in the row that belongs to the organization and the billing period it
was consumed in.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from pathlib import Path
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.models import (
    Agent,
    DailyUsage,
    Document,
    KnowledgeBase,
    Membership,
    MembershipStatus,
    MonthlyUsage,
    OrganizationSubscription,
)
from app.modules.billing.plans import MONTHLY, PlanLimits, get_plan_limits


def current_period() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m")


def current_day() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def period_bounds(period: str | None = None) -> tuple[str, str]:
    """Return the inclusive start and exclusive end of a billing period."""
    moment = datetime.now(timezone.utc)
    if period:
        try:
            start = datetime.strptime(period, "%Y-%m").replace(
                tzinfo=timezone.utc
            )
        except ValueError:
            start = moment.replace(
                day=1, hour=0, minute=0, second=0, microsecond=0
            )
    else:
        start = moment.replace(
            day=1, hour=0, minute=0, second=0, microsecond=0
        )
    end = start + timedelta(days=31)
    end = end.replace(day=1)
    return start.date().isoformat(), end.date().isoformat()


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


def get_subscription(
    db: Session, organization_id: UUID
) -> OrganizationSubscription | None:
    return db.scalar(
        select(OrganizationSubscription).where(
            OrganizationSubscription.organization_id == organization_id
        )
    )


def get_limits(db: Session, organization_id: UUID) -> PlanLimits:
    return get_plan_limits(get_effective_plan(db, organization_id))


def _lock_usage_row(
    db: Session, organization_id: UUID, period: str
) -> MonthlyUsage:
    """Return the usage row for the period, locking it for updates."""
    usage = db.scalar(
        select(MonthlyUsage)
        .where(
            MonthlyUsage.organization_id == organization_id,
            MonthlyUsage.period == period,
        )
        .with_for_update()
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
        db.flush()
    return usage


def _daily_row(
    db: Session, organization_id: UUID, day: str
) -> DailyUsage:
    row = db.scalar(
        select(DailyUsage)
        .where(
            DailyUsage.organization_id == organization_id,
            DailyUsage.day == day,
        )
        .with_for_update()
    )
    if row is None:
        row = DailyUsage(
            organization_id=organization_id,
            day=day,
            request_count=0,
            workflow_executions=0,
            storage_mb=0,
        )
        db.add(row)
        db.flush()
    return row


def check_request_quota(
    db: Session,
    organization_id: UUID,
) -> None:
    """Reject the request when the monthly request quota is exhausted.

    The usage row is locked for the duration of the check so concurrent
    requests cannot both pass the limit and then both be counted.
    """
    plan = get_effective_plan(db, organization_id)
    limit = get_plan_limits(plan).monthly_requests

    period = current_period()
    usage = _lock_usage_row(db, organization_id, period)
    if usage.request_count >= limit:
        raise HTTPException(
            status_code=429,
            detail=(
                f"Monthly request quota exceeded ({limit} requests per month "
                f"on {plan} plan)"
            ),
        )


def record_request_usage(
    db: Session,
    organization_id: UUID,
    prompt_tokens: int = 0,
    completion_tokens: int = 0,
) -> None:
    """Count one metered request against the current period and day."""
    period = current_period()
    usage = _lock_usage_row(db, organization_id, period)
    usage.request_count += 1
    usage.prompt_tokens += prompt_tokens
    usage.completion_tokens += completion_tokens

    daily = _daily_row(db, organization_id, current_day())
    daily.request_count += 1
    db.commit()


def record_workflow_execution(
    db: Session, organization_id: UUID
) -> None:
    """Count one workflow execution against the current period."""
    daily = _daily_row(db, organization_id, current_day())
    daily.workflow_executions += 1
    db.commit()


def check_agent_quota(db: Session, organization_id: UUID) -> None:
    """Reject a new agent when the plan agent quota is exhausted."""
    limits = get_limits(db, organization_id)
    if limits.agents <= 0:
        return
    used = int(
        db.scalar(
            select(func.count(Agent.id)).where(
                Agent.organization_id == organization_id
            )
        )
        or 0
    )
    if used >= limits.agents:
        raise HTTPException(
            status_code=409,
            detail=(
                f"Agent quota reached ({limits.agents} agents on the current "
                "plan). Upgrade the plan to add more agents."
            ),
        )


def check_knowledge_quota(db: Session, organization_id: UUID) -> None:
    """Reject a new knowledge base when the plan quota is exhausted."""
    limits = get_limits(db, organization_id)
    if limits.knowledge_bases <= 0:
        return
    used = int(
        db.scalar(
            select(func.count(KnowledgeBase.id)).where(
                KnowledgeBase.organization_id == organization_id
            )
        )
        or 0
    )
    if used >= limits.knowledge_bases:
        raise HTTPException(
            status_code=409,
            detail=(
                f"Knowledge base quota reached ({limits.knowledge_bases} "
                "knowledge bases on the current plan)."
            ),
        )


def check_storage_quota(
    db: Session, organization_id: UUID, additional_mb: float = 0
) -> None:
    """Reject an upload that would exceed the storage quota."""
    limits = get_limits(db, organization_id)
    if limits.unlimited_storage:
        return
    if storage_mb(db, organization_id) + additional_mb > limits.storage_mb:
        raise HTTPException(
            status_code=409,
            detail=(
                f"Knowledge storage quota exceeded "
                f"({limits.storage_mb} MB on the current plan)."
            ),
        )


def check_workflow_quota(db: Session, organization_id: UUID) -> None:
    """Reject a workflow execution when the plan workflow quota is spent."""
    limits = get_limits(db, organization_id)
    if limits.unlimited_workflows:
        return
    period = current_period()
    used = db.scalar(
        select(func.coalesce(func.sum(DailyUsage.workflow_executions), 0)).where(
            DailyUsage.organization_id == organization_id,
            DailyUsage.day.like(f"{period}%"),
        )
    )
    if int(used or 0) >= limits.workflow_executions:
        raise HTTPException(
            status_code=429,
            detail=(
                f"Workflow execution quota exceeded "
                f"({limits.workflow_executions} per month)"
            ),
        )


def check_seat_quota(db: Session, organization_id: UUID) -> None:
    """Reject a new seat when the plan seat quota is exhausted."""
    limits = get_limits(db, organization_id)
    if limits.seats <= 0:
        return
    used = active_seats(db, organization_id)
    if used >= limits.seats:
        raise HTTPException(
            status_code=409,
            detail=(
                f"Seat quota reached ({limits.seats} seats on the current plan)"
            ),
        )


def active_seats(db: Session, organization_id: UUID) -> int:
    """Number of memberships that currently consume a seat."""
    return int(
        db.scalar(
            select(func.count(Membership.id)).where(
                Membership.organization_id == organization_id,
                Membership.status == MembershipStatus.ACTIVE.value,
            )
        )
        or 0
    )


def storage_mb(db: Session, organization_id: UUID) -> float:
    """Consumed knowledge storage in megabytes."""
    keys = db.scalars(
        select(Document.storage_key).where(
            Document.organization_id == organization_id,
            Document.storage_key.is_not(None),
        )
    ).all()
    if not keys:
        return 0.0
    root = Path(settings.document_storage_path)
    total = 0
    for key in keys:
        path = root / key
        try:
            total += path.stat().st_size
        except OSError:
            continue
    return round(total / (1024 * 1024), 2)


def period_workflow_executions(
    db: Session, organization_id: UUID, period: str | None = None
) -> int:
    """Workflow executions counted in the given billing period."""
    key = period or current_period()
    used = db.scalar(
        select(func.coalesce(func.sum(DailyUsage.workflow_executions), 0)).where(
            DailyUsage.organization_id == organization_id,
            DailyUsage.day.like(f"{key}%"),
        )
    )
    return int(used or 0)


def usage_trend(
    db: Session, organization_id: UUID, days: int = 7
) -> list[dict]:
    """Daily request counts for the last ``days`` days."""
    today = datetime.now(timezone.utc).date()
    start = today - timedelta(days=days - 1)
    rows = db.scalars(
        select(DailyUsage).where(
            DailyUsage.organization_id == organization_id,
            DailyUsage.day >= start.isoformat(),
        )
    ).all()
    counter = {row.day: row.request_count for row in rows}
    trend: list[dict] = []
    for offset in range(days):
        day = (start + timedelta(days=offset)).isoformat()
        trend.append({"day": day, "value": int(counter.get(day, 0))})
    return trend


def estimated_cost_cents(prompt_tokens: int, completion_tokens: int) -> int:
    """Estimated cost of the metered tokens.

    The workspace runs local models by default, so the included price is zero
    until a per thousand token price is configured.
    """
    price = max(0, int(settings.billing_price_per_1k_tokens or 0))
    if price == 0:
        return 0
    total_tokens = max(0, prompt_tokens) + max(0, completion_tokens)
    return round(total_tokens / 1000 * price)
