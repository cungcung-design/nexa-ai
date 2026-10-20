"""Team service helpers.

Everything the Team screens show is derived from authoritative sources:

* the persisted workspace role on ``memberships``;
* the role → permission grants in :mod:`app.core.permissions`;
* the membership status, which restricts every grant while suspended.

Groups and member level direct grants are **not** implemented in this data
model. The helpers below report that limitation explicitly instead of
inventing grants.
"""

from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.permissions import ROLE_PERMISSIONS, Permission, Role
from app.db.models import Membership, MembershipStatus
from app.db.models import Role as DbRole
from app.modules.team.models import InvitationStatus, OrganizationInvitation

#: Canonical roles in descending privilege order.
CANONICAL_ROLES: tuple[str, ...] = ("OWNER", "ADMIN", "DEVELOPER", "VIEWER")

#: Display labels. The workspace role is persisted as ``DEVELOPER`` but the
#: product language calls it ``Editor``.
ROLE_LABELS: dict[str, str] = {
    "OWNER": "Owner",
    "ADMIN": "Admin",
    "DEVELOPER": "Editor",
    "VIEWER": "Viewer",
}

#: Accepted aliases for the canonical role names.
ROLE_ALIASES: dict[str, str] = {
    "EDITOR": "DEVELOPER",
    "DEVELOPER": "DEVELOPER",
    "OWNER": "OWNER",
    "ADMIN": "ADMIN",
    "VIEWER": "VIEWER",
}

#: Privilege ranking used for escalation checks.
ROLE_RANK: dict[str, int] = {
    "OWNER": 3,
    "ADMIN": 2,
    "DEVELOPER": 1,
    "VIEWER": 0,
}

#: Human readable permission labels used by the permission preview and the
#: effective permission list.
PERMISSION_LABELS: dict[str, str] = {
    Permission.AGENT_READ.value: "View agents",
    Permission.AGENT_WRITE.value: "Edit agents",
    Permission.AGENT_PUBLISH.value: "Publish agents",
    Permission.EVALUATION_RUN.value: "Run evaluations",
    Permission.ANALYTICS_READ.value: "View analytics",
    Permission.MEMBER_MANAGE.value: "Manage team members",
    Permission.BILLING_MANAGE.value: "Manage billing",
    Permission.AUDIT_READ.value: "View audit logs",
    Permission.AUDIT_EXPORT.value: "Export audit logs",
}

#: Capabilities rendered by the role permission matrix. The mapping points at
#: real backend permissions so the matrix can never drift from enforcement.
MATRIX_CAPABILITIES: tuple[tuple[str, str], ...] = (
    ("View Agents", Permission.AGENT_READ.value),
    ("Edit Agents", Permission.AGENT_WRITE.value),
    ("Publish Agents", Permission.AGENT_PUBLISH.value),
    ("Manage Team", Permission.MEMBER_MANAGE.value),
    ("Manage Billing", Permission.BILLING_MANAGE.value),
    ("View Audit Logs", Permission.AUDIT_READ.value),
    ("Edit Permissions", Permission.MEMBER_MANAGE.value),
)

#: Permission sources that exist in the current data model.
IMPLEMENTED_PERMISSION_SOURCES: tuple[str, ...] = ("workspace_role",)

#: Permission sources the product exposes but the backend does not implement.
UNSUPPORTED_PERMISSION_SOURCES: tuple[tuple[str, str], ...] = (
    (
        "groups",
        "Workspace groups are not implemented, so no inherited group grants "
        "exist for this member.",
    ),
    (
        "direct_access",
        "Member level direct resource grants are not implemented, so no "
        "resource specific grants exist for this member.",
    ),
)

#: How long a new invitation stays valid.
INVITATION_TTL = timedelta(days=7)


def normalize_role(value: str | None) -> str | None:
    """Return the canonical role name for ``value`` or ``None`` when unknown."""
    if value is None:
        return None
    key = str(value).strip().upper()
    return ROLE_ALIASES.get(key)


def role_label(role: str | None) -> str:
    canonical = normalize_role(role) or "VIEWER"
    return ROLE_LABELS[canonical]


def role_rank(role: str | None) -> int:
    canonical = normalize_role(role)
    if canonical is None:
        return -1
    return ROLE_RANK[canonical]


def permissions_for_role(role: str | None) -> list[str]:
    """Return the permission values granted by ``role``."""
    canonical = normalize_role(role)
    if canonical is None:
        return []
    grants = ROLE_PERMISSIONS.get(Role(canonical), set())
    return sorted(permission.value for permission in grants)


def permission_labels_for_role(role: str | None) -> list[str]:
    """Return the human readable labels of the permissions a role grants."""
    return [
        PERMISSION_LABELS.get(permission, permission)
        for permission in permissions_for_role(role)
    ]


def is_active_membership(membership: Membership) -> bool:
    return (membership.status or MembershipStatus.ACTIVE.value) == (
        MembershipStatus.ACTIVE.value
    )


def effective_permissions(membership: Membership) -> list[dict]:
    """Resolve the permissions a member actually holds.

    Only implemented sources contribute. A suspended membership holds no
    permissions at all, which is the restriction applied on top of the
    workspace role.
    """
    granted = set(permissions_for_role(membership.role.value))
    if not is_active_membership(membership):
        granted = set()

    entries: list[dict] = []
    for permission in sorted(Permission):
        entries.append(
            {
                "permission": permission.value,
                "label": PERMISSION_LABELS.get(permission.value, permission.value),
                "granted": permission.value in granted,
                "source": "workspace_role",
                "restriction": (
                    None
                    if is_active_membership(membership)
                    else "Membership is suspended"
                ),
            }
        )
    return entries


def permission_matrix() -> list[dict]:
    """Return the capability matrix computed from the authoritative grants."""
    matrix: list[dict] = []
    for capability, permission in MATRIX_CAPABILITIES:
        grants = {
            role: permission in permissions_for_role(role)
            for role in CANONICAL_ROLES
        }
        matrix.append(
            {
                "capability": capability,
                "permission": permission,
                "grants": grants,
            }
        )
    return matrix


def role_summaries() -> list[dict]:
    """Return every workspace role with the permissions it grants."""
    summaries: list[dict] = []
    for role in CANONICAL_ROLES:
        permissions = permissions_for_role(role)
        summaries.append(
            {
                "role": role,
                "label": ROLE_LABELS[role],
                "description": ROLE_DESCRIPTIONS[role],
                "permissions": permissions,
                "permission_labels": [
                    PERMISSION_LABELS.get(permission, permission)
                    for permission in permissions
                ],
                "member_count": 0,
            }
        )
    return summaries


ROLE_DESCRIPTIONS: dict[str, str] = {
    "OWNER": "Full workspace control, including billing and ownership.",
    "ADMIN": "Manages members, agents and workspace settings.",
    "DEVELOPER": "Builds and edits agents, workflows and knowledge sources.",
    "VIEWER": "Read-only access to workspace content.",
}


def count_active_owners(db: Session, organization_id: UUID) -> int:
    """Number of active owner memberships in the workspace."""
    return int(
        db.scalar(
            select(func.count())
            .select_from(Membership)
            .where(
                Membership.organization_id == organization_id,
                Membership.role == DbRole.OWNER,
                Membership.status == MembershipStatus.ACTIVE.value,
            )
        )
        or 0
    )


def is_last_active_owner(db: Session, membership: Membership) -> bool:
    """True when ``membership`` is the only active owner of the workspace."""
    if membership.role != DbRole.OWNER:
        return False
    if not is_active_membership(membership):
        return False
    return count_active_owners(db, membership.organization_id) <= 1


# --- Invitation tokens ------------------------------------------------------


def generate_invitation_token() -> str:
    return secrets.token_urlsafe(32)


def hash_invitation_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def invitation_expiry(now: datetime | None = None) -> datetime:
    moment = now or datetime.now(timezone.utc)
    return moment + INVITATION_TTL


def is_expired(invitation: OrganizationInvitation, now: datetime | None = None) -> bool:
    moment = now or datetime.now(timezone.utc)
    expires_at = invitation.expires_at
    if expires_at is None:
        return False
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    return expires_at <= moment


def resolve_invitation_status(
    invitation: OrganizationInvitation, now: datetime | None = None
) -> str:
    """Return the effective status, folding elapsed expiry into ``EXPIRED``."""
    status = invitation.status or InvitationStatus.PENDING.value
    if status == InvitationStatus.PENDING.value and is_expired(invitation, now):
        return InvitationStatus.EXPIRED.value
    return status
