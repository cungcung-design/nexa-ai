"""Audit recording service.

Every auditable action in the platform funnels through
:func:`record_audit_event` so that the audit trail keeps a single shape:
organization, unique event reference, timestamp, actor, action, resource,
outcome and any correlation identifiers the caller can supply.
"""

from __future__ import annotations

from typing import Any, Iterable
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.redaction import redact_secrets
from app.db.models import User
from app.modules.security.audit_models import SecurityAuditEvent

# --- Categories -------------------------------------------------------------

#: Security categories exposed by the Security Events screen.
SECURITY_CATEGORY_ACTIONS: dict[str, set[str]] = {
    "authentication": {
        "user.login",
        "user.logout",
        "user.login_failed",
        "user.login_attempt",
        "user.password_changed",
        "user.session_revoked",
        "access.token_refresh",
    },
    "permissions_roles": {
        "member.added",
        "member.removed",
        "member.role_changed",
        "member.invited",
        "member.invitation_revoked",
        "member.invitation_resent",
        "member.invitation_accepted",
        "member.suspended",
        "member.reactivated",
        "permission.granted",
        "permission.revoked",
        "policy.updated",
        "workspace.settings_updated",
    },
    "credentials_api_keys": {
        "api_key.created",
        "api_key.revoked",
        "api_key.rotated",
        "credential.changed",
        "credential.accessed",
    },
    "sensitive_operations": {
        "approval.created",
        "approval.assigned",
        "approval.approved",
        "approval.rejected",
        "approval.expired",
        "decision.recorded",
        "execution.started",
        "execution.completed",
        "execution.failed",
    },
    "integration_security": {
        "integration.connected",
        "integration.disconnected",
        "integration.credential_changed",
        "integration.scope_changed",
        "integration.connection_updated",
        "integration.enabled",
        "integration.disabled",
    },
}

SECURITY_CATEGORY_IDS = tuple(SECURITY_CATEGORY_ACTIONS.keys())

#: Module categories derived from the action prefix.
MODULE_CATEGORY_PREFIXES: dict[str, tuple[str, ...]] = {
    "agents": ("agent.",),
    "workflows": ("workflow.",),
    "integrations": ("integration.",),
    "approvals": ("approval.", "decision.", "execution."),
    "knowledge": ("knowledge.", "document."),
    "access": ("member.", "permission.", "policy.", "workspace."),
    "billing": ("billing.", "subscription.", "payment."),
}

#: Human readable labels for the resource types used across the module.
RESOURCE_LABELS: dict[str, str] = {
    "agent": "AI agent",
    "agent_version": "agent version",
    "workflow": "workflow",
    "workflow_execution": "workflow execution",
    "integration": "integration connection",
    "integration_webhook": "integration webhook",
    "approval": "approval request",
    "knowledge_base": "knowledge source",
    "document": "knowledge document",
    "member": "workspace member",
    "invitation": "workspace invitation",
    "workspace": "workspace",
    "organization": "workspace",
    "subscription": "billing record",
    "api_key": "API key",
    "trace": "trace",
}

#: Verbs used to build a readable summary when the caller does not provide one.
ACTION_VERBS: dict[str, str] = {
    "created": "created",
    "added": "added",
    "updated": "updated",
    "changed": "changed",
    "published": "published",
    "deactivated": "deactivated",
    "archived": "archived",
    "deleted": "deleted",
    "removed": "removed",
    "disconnected": "disconnected",
    "connected": "connected",
    "rotated": "rotated",
    "revoked": "revoked",
    "granted": "granted",
    "approved": "approved",
    "rejected": "rejected",
    "expired": "expired",
    "invited": "invited",
    "failed": "failed",
    "started": "started",
    "completed": "completed",
    "uploaded": "uploaded",
    "executed": "executed",
}


def categorize_action(action: str) -> tuple[str, list[str]]:
    """Return the primary category and every category the action belongs to."""
    security = [
        category
        for category, actions in SECURITY_CATEGORY_ACTIONS.items()
        if action in actions
    ]
    modules = [
        category
        for category, prefixes in MODULE_CATEGORY_PREFIXES.items()
        if any(action.startswith(prefix) for prefix in prefixes)
    ]

    ordered: list[str] = []
    for category in [*modules, *security]:
        if category not in ordered:
            ordered.append(category)

    if not ordered:
        return "other", ["other"]
    return ordered[0], ordered


def humanize_action(action: str) -> str:
    """``agent.published`` -> ``Agent Published``."""
    words: list[str] = []
    for segment in action.split("."):
        words.extend(segment.replace("_", " ").replace("-", " ").split())
    return " ".join(word[:1].upper() + word[1:] for word in words) or action


def sentence_case_action(action: str) -> str:
    """``agent.published`` -> ``Agent published``."""
    title = humanize_action(action)
    if not title:
        return action
    first, *rest = title.split(" ")
    return " ".join([first, *[word.lower() for word in rest]])


def build_summary(
    action: str,
    actor_label: str,
    resource_type: str,
    resource_name: str | None,
) -> str:
    resource_label = RESOURCE_LABELS.get(resource_type, resource_type)
    verb = ACTION_VERBS.get(action.split(".")[-1], action.split(".")[-1])
    target = f"{resource_label} “{resource_name}”" if resource_name else resource_label
    return f"{actor_label} {verb} {target}."


# --- Recording --------------------------------------------------------------


def _actor_snapshot(
    db: Session, actor_user_id: UUID | None
) -> tuple[str | None, str | None]:
    """Return the (name, email) snapshot stored with the event.

    The snapshot keeps the entry readable even after the account is removed.
    """
    if actor_user_id is None:
        return None, None
    user = db.get(User, actor_user_id)
    if user is None:
        return None, None
    return user.email, user.email


def _next_sequence(db: Session, organization_id: UUID) -> int:
    current = db.scalar(
        select(func.coalesce(func.max(SecurityAuditEvent.event_sequence), 0)).where(
            SecurityAuditEvent.organization_id == organization_id
        )
    )
    return int(current or 0) + 1


def record_audit_event(
    db: Session,
    *,
    organization_id: UUID,
    action: str,
    resource_type: str,
    resource_id: UUID | None = None,
    resource_name: str | None = None,
    actor_user_id: UUID | None = None,
    actor_type: str = "user",
    outcome: str = "success",
    source: str = "web_application",
    details: dict | None = None,
    changes: dict | None = None,
    title: str | None = None,
    summary: str | None = None,
    commit: bool = True,
) -> SecurityAuditEvent:
    """Persist one audit event and return it.

    The function never raises on unique-reference conflicts: the per
    organization sequence is re-read and retried instead.
    """
    primary_category, categories = categorize_action(action)
    actor_name, actor_email = _actor_snapshot(db, actor_user_id)
    safe_details = redact_secrets(details or {}) or {}
    safe_changes = redact_secrets(changes) if changes is not None else None

    if summary is None:
        actor_label = actor_name or actor_email or "The system"
        summary = build_summary(action, actor_label, resource_type, resource_name)
    safe_details.setdefault("title", title or humanize_action(action))
    safe_details.setdefault("summary", summary)

    event: SecurityAuditEvent | None = None
    for _attempt in range(5):
        sequence = _next_sequence(db, organization_id)
        candidate = SecurityAuditEvent(
            organization_id=organization_id,
            event_sequence=sequence,
            event_id=f"AUD-{sequence:04d}",
            actor_user_id=actor_user_id,
            actor_type=actor_type,
            actor_name=actor_name or actor_email,
            actor_email=actor_email,
            action=action,
            category=primary_category,
            categories=categories,
            outcome=outcome,
            resource_type=resource_type,
            resource_id=resource_id,
            resource_name=resource_name,
            source=source,
            details=safe_details,
            changes=safe_changes,
        )
        try:
            with db.begin_nested():
                db.add(candidate)
                db.flush()
            event = candidate
            break
        except IntegrityError:
            continue

    if event is None:  # pragma: no cover - only after 5 conflicting writes
        event = SecurityAuditEvent(
            organization_id=organization_id,
            actor_user_id=actor_user_id,
            actor_type=actor_type,
            actor_name=actor_name or actor_email,
            actor_email=actor_email,
            action=action,
            category=primary_category,
            categories=categories,
            outcome=outcome,
            resource_type=resource_type,
            resource_id=resource_id,
            resource_name=resource_name,
            source=source,
            details=safe_details,
            changes=safe_changes,
        )
        db.add(event)

    if commit:
        db.commit()
        db.refresh(event)
    return event


def record_audit_event_safe(
    db: Session, **kwargs: Any
) -> SecurityAuditEvent | None:
    """Record an audit event without ever breaking the caller."""
    try:
        return record_audit_event(db, **kwargs)
    except Exception:
        try:
            db.rollback()
        except Exception:
            pass
        return None


def record_security_event(
    db: Session,
    *,
    organization_id: UUID,
    actor_user_id: UUID,
    action: str,
    resource_type: str,
    resource_id: UUID,
    details: dict | None = None,
) -> SecurityAuditEvent:
    """Backwards compatible wrapper around :func:`record_audit_event`."""
    return record_audit_event(
        db,
        organization_id=organization_id,
        actor_user_id=actor_user_id,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        details=details,
    )


def normalize_categories(values: Iterable[str] | None) -> list[str]:
    """Normalize a user supplied category filter into a clean list."""
    if not values:
        return []
    cleaned: list[str] = []
    for value in values:
        for part in str(value).split(","):
            key = part.strip().lower()
            if key and key not in cleaned and key != "all":
                cleaned.append(key)
    return cleaned
