"""Read and export APIs for the Audit Logs module."""

from __future__ import annotations

import csv
import io
import json
import uuid as uuid_mod
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from fastapi.responses import Response
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import String, cast, func, literal, or_, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.permissions import Permission, has_permission
from app.core.redaction import redact_secrets
from app.db.models import (
    Agent,
    AgentVersion,
    Document,
    IntegrationWebhook,
    KnowledgeBase,
    Membership,
    MembershipStatus,
    Organization,
    OrganizationSubscription,
    User,
    WorkflowApproval,
    WorkspaceConnection,
)
from app.db.session import get_db
from app.modules.auth.dependencies import get_current_user
from app.modules.analytics.models import AIRequestTrace
from app.modules.security.audit import (
    SECURITY_CATEGORY_IDS,
    humanize_action,
    normalize_categories,
    sentence_case_action,
)
from app.modules.security.audit_models import AuditExport, SecurityAuditEvent
from app.modules.security.models import OrganizationAPIKey

router = APIRouter(
    prefix="/api/v1/organizations/{organization_id}/audit-logs",
    tags=["Security Audit Logs"],
)

#: Maximum number of records a single export may contain.
MAX_EXPORT_ROWS = 50_000
DEFAULT_PAGE_SIZE = 20
MAX_PAGE_SIZE = 100

FAILED_OUTCOMES = ("failed", "denied", "error")

CATEGORY_META: dict[str, dict[str, str]] = {
    "authentication": {
        "name": "Authentication",
        "description": "Sign-in attempts, sign-outs, access failures",
        "color": "#5865ff",
        "bg": "#f1f5ff",
    },
    "permissions_roles": {
        "name": "Permissions & Roles",
        "description": "Member role and permission changes",
        "color": "#a033ff",
        "bg": "#faf3ff",
    },
    "credentials_api_keys": {
        "name": "Credentials & API Keys",
        "description": "Key creation, rotation, revocation",
        "color": "#ed6500",
        "bg": "#fff8ed",
    },
    "sensitive_operations": {
        "name": "Sensitive Operations",
        "description": "Approval decisions and protected actions",
        "color": "#f02030",
        "bg": "#fff2f3",
    },
    "integration_security": {
        "name": "Integration Security",
        "description": "Provider connections and scope changes",
        "color": "#2da467",
        "bg": "#eefdf5",
    },
    "agents": {
        "name": "AI Agents",
        "description": "Agent creation, configuration and publishing",
        "color": "#795cff",
        "bg": "#f3efff",
    },
    "workflows": {
        "name": "Workflows",
        "description": "Workflow edits and execution state",
        "color": "#4265db",
        "bg": "#f1f5ff",
    },
    "integrations": {
        "name": "Integrations",
        "description": "Provider connections and configuration",
        "color": "#f07836",
        "bg": "#fff5eb",
    },
    "approvals": {
        "name": "Approvals",
        "description": "Approval requests, decisions and executions",
        "color": "#48b953",
        "bg": "#effdf1",
    },
    "knowledge": {
        "name": "Knowledge Base",
        "description": "Knowledge sources and documents",
        "color": "#0e9f6e",
        "bg": "#eefdf5",
    },
    "access": {
        "name": "Access & Roles",
        "description": "Membership, role and workspace settings",
        "color": "#a033ff",
        "bg": "#faf3ff",
    },
    "billing": {
        "name": "Billing",
        "description": "Plan changes and payment outcomes",
        "color": "#64748b",
        "bg": "#f1f5f9",
    },
    "other": {
        "name": "Other",
        "description": "General system events",
        "color": "#6b7280",
        "bg": "#f3f4f6",
    },
}


# --- Helpers ----------------------------------------------------------------


def _membership(db: Session, user_id: uuid_mod.UUID, organization_id: uuid_mod.UUID):
    membership = db.scalar(
        select(Membership).where(
            Membership.organization_id == organization_id,
            Membership.user_id == user_id,
        )
    )
    if membership is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found or access denied",
        )
    if (membership.status or MembershipStatus.ACTIVE.value) != (
        MembershipStatus.ACTIVE.value
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Workspace access is suspended",
        )
    return membership


def require_audit_read(
    db: Session,
    user_id: uuid_mod.UUID,
    organization_id: uuid_mod.UUID,
):
    """Read access to audit records for one organization."""
    membership = _membership(db, user_id, organization_id)
    if not has_permission(membership.role, Permission.AUDIT_READ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to view audit logs",
        )
    return membership


def require_audit_export(
    db: Session,
    user_id: uuid_mod.UUID,
    organization_id: uuid_mod.UUID,
):
    """Export access is restricted to owners and admins."""
    membership = _membership(db, user_id, organization_id)
    if not has_permission(membership.role, Permission.AUDIT_EXPORT):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to export audit logs",
        )
    return membership


def _resolve_timezone(name: str | None) -> ZoneInfo:
    if not name:
        return ZoneInfo("UTC")
    try:
        return ZoneInfo(name)
    except (ZoneInfoNotFoundError, ValueError):
        return ZoneInfo("UTC")


def _day_bounds(day: date, tz: ZoneInfo) -> tuple[datetime, datetime]:
    start = datetime(day.year, day.month, day.day, tzinfo=tz)
    end = start + timedelta(days=1)
    return start.astimezone(timezone.utc), end.astimezone(timezone.utc)


def _parse_iso(value: str | None) -> datetime | None:
    if not value:
        return None
    text = value.strip()
    if text.endswith("Z"):
        text = text[:-1] + "+00:00"
    try:
        parsed = datetime.fromisoformat(text)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed


class AuditFilterParams:
    """Normalized filter set shared by every audit endpoint."""

    def __init__(
        self,
        *,
        search: str | None = None,
        category: str | None = None,
        outcome: str | None = None,
        actor: str | None = None,
        resource_type: str | None = None,
        resource_id: str | None = None,
        date_from: str | None = None,
        date_to: str | None = None,
        date: str | None = None,
        tz: str | None = None,
        has_actor: bool | None = None,
    ) -> None:
        self.search = (search or "").strip() or None
        self.categories = normalize_categories([category] if category else [])
        self.outcome = (outcome or "").strip().lower() or None
        self.actor = (actor or "").strip() or None
        self.resource_type = (resource_type or "").strip() or None
        self.resource_id = (resource_id or "").strip() or None
        self.date_from_raw = date_from
        self.date_to_raw = date_to
        self.date_raw = date
        self.tz_name = tz or settings.audit_display_timezone
        self.tz = _resolve_timezone(self.tz_name)
        self.has_actor = has_actor

        self.start: datetime | None = None
        self.end: datetime | None = None
        self._resolve_range()

    def _resolve_range(self) -> None:
        if self.date_raw:
            try:
                day = date.fromisoformat(self.date_raw.strip())
            except ValueError:
                day = None
            if day is not None:
                self.start, self.end = _day_bounds(day, self.tz)
                return
        self.start = _parse_iso(self.date_from_raw)
        self.end = _parse_iso(self.date_to_raw)

    def as_dict(self) -> dict[str, Any]:
        return {
            "search": self.search,
            "category": self.categories,
            "outcome": self.outcome,
            "actor": self.actor,
            "resource_type": self.resource_type,
            "resource_id": self.resource_id,
            "date_from": self.date_from_raw,
            "date_to": self.date_to_raw,
            "date": self.date_raw,
            "tz": self.tz_name,
        }


def _build_statement(
    organization_id: uuid_mod.UUID,
    filters: AuditFilterParams,
    *,
    ignore_categories: bool = False,
    ignore_non_date: bool = False,
):
    statement = select(SecurityAuditEvent).where(
        SecurityAuditEvent.organization_id == organization_id
    )

    if filters.search:
        pattern = f"%{filters.search}%"
        statement = statement.where(
            or_(
                SecurityAuditEvent.action.ilike(pattern),
                SecurityAuditEvent.event_id.ilike(pattern),
                SecurityAuditEvent.resource_type.ilike(pattern),
                SecurityAuditEvent.resource_name.ilike(pattern),
                SecurityAuditEvent.actor_name.ilike(pattern),
                SecurityAuditEvent.actor_email.ilike(pattern),
                cast(SecurityAuditEvent.resource_id, String).ilike(pattern),
                cast(SecurityAuditEvent.details, String).ilike(pattern),
            )
        )

    if filters.categories and not ignore_categories:
        statement = statement.where(
            SecurityAuditEvent.categories.overlap(filters.categories)
        )

    if filters.outcome and not ignore_non_date:
        statement = statement.where(SecurityAuditEvent.outcome == filters.outcome)

    if filters.actor and not ignore_non_date:
        pattern = f"%{filters.actor}%"
        statement = statement.where(
            or_(
                SecurityAuditEvent.actor_name.ilike(pattern),
                SecurityAuditEvent.actor_email.ilike(pattern),
                cast(SecurityAuditEvent.actor_user_id, String).ilike(pattern),
            )
        )

    if filters.resource_type and not ignore_non_date:
        statement = statement.where(
            SecurityAuditEvent.resource_type == filters.resource_type
        )

    if filters.resource_id and not ignore_non_date:
        try:
            statement = statement.where(
                SecurityAuditEvent.resource_id == uuid_mod.UUID(filters.resource_id)
            )
        except ValueError:
            statement = statement.where(
                cast(SecurityAuditEvent.resource_id, String).ilike(
                    f"%{filters.resource_id}%"
                )
            )

    if filters.has_actor is not None and not ignore_non_date:
        statement = statement.where(
            SecurityAuditEvent.actor_user_id.is_not(None)
            if filters.has_actor
            else SecurityAuditEvent.actor_user_id.is_(None)
        )

    if filters.start is not None:
        statement = statement.where(SecurityAuditEvent.created_at >= filters.start)
    if filters.end is not None:
        statement = statement.where(SecurityAuditEvent.created_at < filters.end)

    return statement


def _resource_exists(
    db: Session,
    organization_id: uuid_mod.UUID,
    resource_type: str,
    resource_id: uuid_mod.UUID | None,
) -> bool:
    """Check whether the audited resource still exists."""
    if resource_id is None:
        return False

    checks: dict[str, tuple[Any, Any]] = {
        "agent": (Agent, Agent.organization_id == organization_id),
        "agent_version": (
            AgentVersion,
            AgentVersion.organization_id == organization_id,
        ),
        "integration": (
            WorkspaceConnection,
            WorkspaceConnection.organization_id == organization_id,
        ),
        "integration_webhook": (
            IntegrationWebhook,
            IntegrationWebhook.organization_id == organization_id,
        ),
        "approval": (
            WorkflowApproval,
            WorkflowApproval.organization_id == organization_id,
        ),
        "knowledge_base": (
            KnowledgeBase,
            KnowledgeBase.organization_id == organization_id,
        ),
        "document": (Document, Document.organization_id == organization_id),
        "member": (Membership, Membership.organization_id == organization_id),
        "workspace": (Organization, Organization.id == organization_id),
        "organization": (Organization, Organization.id == organization_id),
        "subscription": (
            OrganizationSubscription,
            OrganizationSubscription.organization_id == organization_id,
        ),
        "api_key": (
            OrganizationAPIKey,
            OrganizationAPIKey.organization_id == organization_id,
        ),
        "trace": (
            AIRequestTrace,
            AIRequestTrace.organization_id == organization_id,
        ),
    }

    check = checks.get(resource_type)
    if check is None:
        # Resource types without a backing table (for example workflows) are
        # reported as available rather than as a broken link.
        return True

    model, scope = check
    return (
        db.scalar(select(func.count()).select_from(model).where(model.id == resource_id, scope))
        or 0
    ) > 0


def _serialize_event(
    db: Session,
    event: SecurityAuditEvent,
    *,
    organization_id: uuid_mod.UUID,
) -> "AuditEventResponse":
    details = event.details or {}
    categories = list(event.categories or [])
    if not categories:
        categories = [event.category] if event.category else ["other"]
    resource_available = _resource_exists(
        db, organization_id, event.resource_type, event.resource_id
    )
    title = details.get("title") or humanize_action(event.action)
    summary = details.get("summary")

    return AuditEventResponse(
        id=event.id,
        event_id=event.event_id,
        organization_id=event.organization_id,
        actor_user_id=event.actor_user_id,
        actor_type=event.actor_type,
        actor_name=event.actor_name,
        actor_email=event.actor_email,
        action=event.action,
        title=title,
        label=sentence_case_action(event.action),
        summary=summary,
        category=event.category,
        categories=categories,
        outcome=event.outcome,
        resource_type=event.resource_type,
        resource_id=event.resource_id,
        resource_name=event.resource_name,
        resource_available=resource_available,
        source=event.source,
        details=details,
        changes=event.changes,
        created_at=event.created_at,
    )


# --- Schemas ----------------------------------------------------------------


class AuditEventResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid_mod.UUID
    event_id: str | None = None
    organization_id: uuid_mod.UUID
    actor_user_id: uuid_mod.UUID | None = None
    actor_type: str = "user"
    actor_name: str | None = None
    actor_email: str | None = None
    action: str
    title: str = ""
    label: str = ""
    summary: str | None = None
    category: str = "other"
    categories: list[str] = Field(default_factory=list)
    outcome: str = "success"
    resource_type: str
    resource_id: uuid_mod.UUID | None = None
    resource_name: str | None = None
    resource_available: bool = True
    source: str = "web_application"
    details: dict | None = None
    changes: dict | None = None
    created_at: datetime


class AuditEventList(BaseModel):
    items: list[AuditEventResponse]
    total: int
    limit: int
    offset: int
    page: int
    page_size: int
    page_count: int


class AuditStats(BaseModel):
    total_events: int
    security_events: int
    failed_actions: int
    active_actors: int
    period_from: datetime | None = None
    period_to: datetime | None = None
    timezone: str = "UTC"


class AuditActivityPoint(BaseModel):
    date: str
    label: str
    count: int


class AuditActivityResponse(BaseModel):
    timezone: str
    days: int
    points: list[AuditActivityPoint]


class AuditCategoryResponse(BaseModel):
    id: str
    name: str
    description: str
    color: str
    bg: str
    event_count: int


class AuditChangeGroup(BaseModel):
    resource_type: str
    resource_id: uuid_mod.UUID | None = None
    resource_name: str | None = None
    resource_available: bool = True
    events: list[AuditEventResponse]


class AuditChangesResponse(BaseModel):
    total: int
    groups: list[AuditChangeGroup]


class ExportRequest(BaseModel):
    format: str = "csv"
    scope: str = "filtered"
    search: str | None = None
    category: str | None = None
    outcome: str | None = None
    actor: str | None = None
    resource_type: str | None = None
    resource_id: str | None = None
    date_from: str | None = None
    date_to: str | None = None
    date: str | None = None
    tz: str | None = None


class ExportResponse(BaseModel):
    export_id: str
    status: str
    format: str
    scope: str
    record_count: int | None = None
    download_url: str | None = None
    error: str | None = None
    created_at: datetime


# --- Endpoints --------------------------------------------------------------


@router.get("", response_model=AuditEventList)
def list_audit_events(
    organization_id: uuid_mod.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    limit: int = Query(default=DEFAULT_PAGE_SIZE, ge=1, le=MAX_PAGE_SIZE),
    offset: int = Query(default=0, ge=0),
    search: str | None = Query(default=None),
    category: str | None = Query(default=None),
    outcome: str | None = Query(default=None),
    actor: str | None = Query(default=None),
    resource_type: str | None = Query(default=None),
    resource_id: str | None = Query(default=None),
    date_from: str | None = Query(default=None),
    date_to: str | None = Query(default=None),
    date: str | None = Query(default=None),
    tz: str | None = Query(default=None),
    has_actor: bool | None = Query(default=None),
):
    require_audit_read(db, user.id, organization_id)

    filters = AuditFilterParams(
        search=search,
        category=category,
        outcome=outcome,
        actor=actor,
        resource_type=resource_type,
        resource_id=resource_id,
        date_from=date_from,
        date_to=date_to,
        date=date,
        tz=tz,
        has_actor=has_actor,
    )

    statement = _build_statement(organization_id, filters)
    total = db.scalar(select(func.count()).select_from(statement.subquery())) or 0

    rows = db.scalars(
        statement.order_by(
            SecurityAuditEvent.created_at.desc(),
            SecurityAuditEvent.id.desc(),
        )
        .limit(limit)
        .offset(offset)
    ).all()

    items = [
        _serialize_event(db, event, organization_id=organization_id) for event in rows
    ]
    page = offset // limit + 1
    page_count = (total + limit - 1) // limit if total else 0

    return AuditEventList(
        items=items,
        total=total,
        limit=limit,
        offset=offset,
        page=page,
        page_size=limit,
        page_count=page_count,
    )


@router.get("/stats", response_model=AuditStats)
def audit_stats(
    organization_id: uuid_mod.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    search: str | None = Query(default=None),
    category: str | None = Query(default=None),
    outcome: str | None = Query(default=None),
    actor: str | None = Query(default=None),
    resource_type: str | None = Query(default=None),
    resource_id: str | None = Query(default=None),
    date_from: str | None = Query(default=None),
    date_to: str | None = Query(default=None),
    date: str | None = Query(default=None),
    tz: str | None = Query(default=None),
    has_actor: bool | None = Query(default=None),
):
    require_audit_read(db, user.id, organization_id)

    filters = AuditFilterParams(
        search=search,
        category=category,
        outcome=outcome,
        actor=actor,
        resource_type=resource_type,
        resource_id=resource_id,
        date_from=date_from,
        date_to=date_to,
        date=date,
        tz=tz,
        has_actor=has_actor,
    )

    statement = _build_statement(organization_id, filters)

    total = db.scalar(select(func.count()).select_from(statement.subquery())) or 0

    security_stmt = statement.where(
        SecurityAuditEvent.categories.overlap(list(SECURITY_CATEGORY_IDS))
    )
    security = (
        db.scalar(select(func.count()).select_from(security_stmt.subquery())) or 0
    )

    failed_stmt = statement.where(SecurityAuditEvent.outcome.in_(FAILED_OUTCOMES))
    failed = db.scalar(select(func.count()).select_from(failed_stmt.subquery())) or 0

    actor_subquery = (
        statement.where(SecurityAuditEvent.actor_user_id.is_not(None))
        .subquery("audit_actor_events")
    )
    active_actors = (
        db.scalar(
            select(
                func.count(
                    func.distinct(actor_subquery.c.actor_user_id)
                )
            ).select_from(actor_subquery)
        )
        or 0
    )

    return AuditStats(
        total_events=total,
        security_events=security,
        failed_actions=failed,
        active_actors=active_actors,
        period_from=filters.start,
        period_to=filters.end,
        timezone=filters.tz_name,
    )


@router.get("/activity", response_model=AuditActivityResponse)
def audit_activity(
    organization_id: uuid_mod.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    days: int = Query(default=7, ge=1, le=90),
    date_from: str | None = Query(default=None),
    date_to: str | None = Query(default=None),
    tz: str | None = Query(default=None),
):
    require_audit_read(db, user.id, organization_id)

    tz_name = tz or settings.audit_display_timezone
    zone = _resolve_timezone(tz_name)

    end_local = datetime.now(zone).date()
    start_local = end_local - timedelta(days=days - 1)
    start_utc, _ = _day_bounds(start_local, zone)
    _, end_utc = _day_bounds(end_local + timedelta(days=1), zone)

    if date_from:
        parsed = _parse_iso(date_from)
        if parsed:
            start_utc = parsed
    if date_to:
        parsed = _parse_iso(date_to)
        if parsed:
            end_utc = parsed

    day_expr = func.date_trunc(
        "day", func.timezone(literal(tz_name), SecurityAuditEvent.created_at)
    )
    rows = db.execute(
        select(day_expr.label("day"), func.count().label("count"))
        .where(
            SecurityAuditEvent.organization_id == organization_id,
            SecurityAuditEvent.created_at >= start_utc,
            SecurityAuditEvent.created_at < end_utc,
        )
        .group_by(day_expr)
    ).all()

    counts = {row.day.date().isoformat(): int(row.count) for row in rows}

    points: list[AuditActivityPoint] = []
    for offset in range(days):
        current = start_local + timedelta(days=offset)
        key = current.isoformat()
        points.append(
            AuditActivityPoint(
                date=key,
                label=current.strftime("%a"),
                count=counts.get(key, 0),
            )
        )

    return AuditActivityResponse(
        timezone=tz_name,
        days=days,
        points=points,
    )


@router.get("/categories", response_model=list[AuditCategoryResponse])
def audit_categories(
    organization_id: uuid_mod.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    date_from: str | None = Query(default=None),
    date_to: str | None = Query(default=None),
    date: str | None = Query(default=None),
    tz: str | None = Query(default=None),
):
    require_audit_read(db, user.id, organization_id)

    filters = AuditFilterParams(date_from=date_from, date_to=date_to, date=date, tz=tz)
    statement = _build_statement(organization_id, filters)
    events = db.scalars(statement).all()

    counts: dict[str, int] = {}
    for event in events:
        for category in event.categories or [event.category]:
            counts[category] = counts.get(category, 0) + 1

    ordered = [
        *SECURITY_CATEGORY_IDS,
        "agents",
        "workflows",
        "integrations",
        "approvals",
        "knowledge",
        "access",
        "billing",
        "other",
    ]

    result: list[AuditCategoryResponse] = []
    for category in ordered:
        meta = CATEGORY_META.get(
            category, {"name": category.title(), "description": "", "color": "#6b7280", "bg": "#f3f4f6"}
        )
        result.append(
            AuditCategoryResponse(
                id=category,
                name=meta["name"],
                description=meta["description"],
                color=meta["color"],
                bg=meta["bg"],
                event_count=counts.get(category, 0),
            )
        )
    return result


@router.get("/changes", response_model=AuditChangesResponse)
def audit_changes(
    organization_id: uuid_mod.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    limit: int = Query(default=200, ge=1, le=1000),
    search: str | None = Query(default=None),
    category: str | None = Query(default=None),
    outcome: str | None = Query(default=None),
    actor: str | None = Query(default=None),
    resource_type: str | None = Query(default=None),
    resource_id: str | None = Query(default=None),
    date_from: str | None = Query(default=None),
    date_to: str | None = Query(default=None),
    date: str | None = Query(default=None),
    tz: str | None = Query(default=None),
):
    require_audit_read(db, user.id, organization_id)

    filters = AuditFilterParams(
        search=search,
        category=category,
        outcome=outcome,
        actor=actor,
        resource_type=resource_type,
        resource_id=resource_id,
        date_from=date_from,
        date_to=date_to,
        date=date,
        tz=tz,
    )
    statement = _build_statement(organization_id, filters).where(
        SecurityAuditEvent.changes.is_not(None)
    )

    rows = db.scalars(
        statement.order_by(
            SecurityAuditEvent.created_at.desc(),
            SecurityAuditEvent.id.desc(),
        ).limit(limit)
    ).all()

    groups: dict[tuple[str, str | None], list[AuditEventResponse]] = {}
    group_meta: dict[tuple[str, str | None], tuple[str | None, bool]] = {}

    for event in rows:
        serialized = _serialize_event(db, event, organization_id=organization_id)
        key = (event.resource_type, str(event.resource_id) if event.resource_id else None)
        groups.setdefault(key, []).append(serialized)
        group_meta[key] = (
            event.resource_name or serialized.title,
            serialized.resource_available,
        )

    result: list[AuditChangeGroup] = []
    for key, events in groups.items():
        resource_type, resource_id = key
        name, available = group_meta[key]
        result.append(
            AuditChangeGroup(
                resource_type=resource_type,
                resource_id=uuid_mod.UUID(resource_id) if resource_id else None,
                resource_name=name,
                resource_available=available,
                events=events,
            )
        )

    return AuditChangesResponse(total=len(rows), groups=result)


# --- Exports ----------------------------------------------------------------


def _export_rows(
    db: Session,
    organization_id: uuid_mod.UUID,
    filters: AuditFilterParams,
    scope: str,
) -> list[SecurityAuditEvent]:
    statement = _build_statement(
        organization_id,
        filters,
        ignore_categories=scope == "date_range",
        ignore_non_date=scope == "date_range",
    )
    return list(
        db.scalars(
            statement.order_by(
                SecurityAuditEvent.created_at.desc(),
                SecurityAuditEvent.id.desc(),
            )
        ).all()
    )


def _csv_value(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (dict, list)):
        return json.dumps(value, ensure_ascii=False)
    return str(value)


def _build_export_content(
    db: Session,
    organization_id: uuid_mod.UUID,
    events: list[SecurityAuditEvent],
    export_format: str,
    include_metadata: bool,
) -> str:
    rows: list[dict[str, Any]] = []
    for event in events:
        details = redact_secrets(event.details or {})
        changes = redact_secrets(event.changes) if event.changes is not None else None
        row: dict[str, Any] = {
            "event_id": event.event_id,
            "id": str(event.id),
            "created_at": event.created_at.isoformat() if event.created_at else None,
            "actor_name": event.actor_name,
            "actor_email": event.actor_email,
            "actor_type": event.actor_type,
            "action": event.action,
            "category": event.category,
            "categories": ",".join(event.categories or []),
            "outcome": event.outcome,
            "resource_type": event.resource_type,
            "resource_id": str(event.resource_id) if event.resource_id else None,
            "resource_name": event.resource_name,
            "source": event.source,
        }
        if include_metadata:
            row["details"] = details
            row["changes"] = changes
        rows.append(row)

    if export_format == "json":
        return json.dumps(rows, indent=2, ensure_ascii=False, default=str)

    columns = [
        "event_id",
        "id",
        "created_at",
        "actor_name",
        "actor_email",
        "actor_type",
        "action",
        "category",
        "categories",
        "outcome",
        "resource_type",
        "resource_id",
        "resource_name",
        "source",
    ]
    if include_metadata:
        columns += ["details", "changes"]

    buffer = io.StringIO()
    writer = csv.writer(buffer, lineterminator="\r\n")
    writer.writerow(columns)
    for row in rows:
        writer.writerow([_csv_value(row.get(column)) for column in columns])
    return buffer.getvalue()


def _run_export(export_id: uuid_mod.UUID) -> None:
    """Generate the export artifact in the background."""
    from app.db.session import SessionLocal

    db = SessionLocal()
    try:
        export = db.get(AuditExport, export_id)
        if export is None:
            return
        export.status = "processing"
        db.commit()

        payload = export.filters or {}
        filters = AuditFilterParams(
            search=payload.get("search"),
            category=",".join(payload.get("category") or []) or None,
            outcome=payload.get("outcome"),
            actor=payload.get("actor"),
            resource_type=payload.get("resource_type"),
            resource_id=payload.get("resource_id"),
            date_from=payload.get("date_from"),
            date_to=payload.get("date_to"),
            date=payload.get("date"),
            tz=payload.get("tz"),
        )

        events = _export_rows(db, export.organization_id, filters, export.scope)
        if len(events) > MAX_EXPORT_ROWS:
            export.status = "failed"
            export.error = (
                f"Export exceeds the maximum of {MAX_EXPORT_ROWS:,} records. "
                "Narrow the filters or select a shorter date range."
            )
            export.completed_at = datetime.now(timezone.utc)
            db.commit()
            return

        include_metadata = export.scope == "metadata"
        content = _build_export_content(
            db,
            export.organization_id,
            events,
            export.export_format,
            include_metadata,
        )

        storage_root = Path(settings.audit_export_storage_path)
        storage_root.mkdir(parents=True, exist_ok=True)
        extension = "json" if export.export_format == "json" else "csv"
        storage_key = f"{export.organization_id}/{export.id}.{extension}"
        target = storage_root / storage_key
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")

        export.status = "completed"
        export.record_count = len(events)
        export.storage_key = storage_key
        export.error = None
        export.completed_at = datetime.now(timezone.utc)
        db.commit()
    except Exception as exc:  # pragma: no cover - defensive
        db.rollback()
        try:
            export = db.get(AuditExport, export_id)
            if export is not None:
                export.status = "failed"
                export.error = f"Export failed: {exc}"
                export.completed_at = datetime.now(timezone.utc)
                db.commit()
        except Exception:
            pass
    finally:
        db.close()


@router.post("/export", response_model=ExportResponse)
def export_audit_events(
    organization_id: uuid_mod.UUID,
    payload: ExportRequest,
    background_tasks: BackgroundTasks,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_audit_export(db, user.id, organization_id)

    export_format = (payload.format or "csv").strip().lower()
    if export_format not in ("csv", "json"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported export format",
        )

    scope = (payload.scope or "filtered").strip().lower()
    if scope not in ("filtered", "date_range", "metadata"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported export scope",
        )

    export = AuditExport(
        organization_id=organization_id,
        requested_by=user.id,
        export_format=export_format,
        scope=scope,
        status="queued",
        filters={
            "search": payload.search,
            "category": normalize_categories([payload.category] if payload.category else []),
            "outcome": payload.outcome,
            "actor": payload.actor,
            "resource_type": payload.resource_type,
            "resource_id": payload.resource_id,
            "date_from": payload.date_from,
            "date_to": payload.date_to,
            "date": payload.date,
            "tz": payload.tz or settings.audit_display_timezone,
        },
    )
    db.add(export)
    db.commit()
    db.refresh(export)

    background_tasks.add_task(_run_export, export.id)

    return ExportResponse(
        export_id=str(export.id),
        status=export.status,
        format=export_format,
        scope=scope,
        record_count=None,
        download_url=(
            f"/api/v1/organizations/{organization_id}"
            f"/audit-logs/export/{export.id}/download"
        ),
        error=None,
        created_at=export.created_at,
    )


@router.get("/export/{export_id}", response_model=ExportResponse)
def get_audit_export(
    organization_id: uuid_mod.UUID,
    export_id: uuid_mod.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_audit_export(db, user.id, organization_id)

    export = db.scalar(
        select(AuditExport).where(
            AuditExport.id == export_id,
            AuditExport.organization_id == organization_id,
        )
    )
    if export is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Export not found",
        )

    return ExportResponse(
        export_id=str(export.id),
        status=export.status,
        format=export.export_format,
        scope=export.scope,
        record_count=export.record_count,
        download_url=(
            f"/api/v1/organizations/{organization_id}"
            f"/audit-logs/export/{export.id}/download"
            if export.status == "completed"
            else None
        ),
        error=export.error,
        created_at=export.created_at,
    )


@router.get("/export/{export_id}/download")
def download_export(
    organization_id: uuid_mod.UUID,
    export_id: uuid_mod.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_audit_export(db, user.id, organization_id)

    export = db.scalar(
        select(AuditExport).where(
            AuditExport.id == export_id,
            AuditExport.organization_id == organization_id,
        )
    )
    if export is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Export not found",
        )
    if export.status != "completed" or not export.storage_key:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Export is not ready for download",
        )

    target = Path(settings.audit_export_storage_path) / export.storage_key
    if not target.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Export file is no longer available",
        )

    extension = "json" if export.export_format == "json" else "csv"
    media_type = (
        "application/json" if extension == "json" else "text/csv; charset=utf-8"
    )
    return Response(
        content=target.read_bytes(),
        media_type=media_type,
        headers={
            "Content-Disposition": f'attachment; filename="audit-export.{extension}"'
        },
    )


@router.get("/{event_id}", response_model=AuditEventResponse)
def get_audit_event(
    organization_id: uuid_mod.UUID,
    event_id: uuid_mod.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_audit_read(db, user.id, organization_id)

    event = db.scalar(
        select(SecurityAuditEvent).where(
            SecurityAuditEvent.id == event_id,
            SecurityAuditEvent.organization_id == organization_id,
        )
    )
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Audit event not found",
        )

    return _serialize_event(db, event, organization_id=organization_id)
