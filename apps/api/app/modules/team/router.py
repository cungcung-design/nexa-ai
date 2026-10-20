"""Team module APIs: members, invitations, roles and workspace activity."""

from __future__ import annotations

import uuid as uuid_mod
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.permissions import Permission, has_permission
from app.db.models import (
    Agent,
    ApprovalAssignment,
    KnowledgeBase,
    Membership,
    MembershipStatus,
    Organization,
    Role,
    User,
    WorkflowApproval,
)
from app.db.session import get_db
from app.modules.auth.dependencies import get_current_user
from app.modules.organizations.router import require_membership
from app.modules.security.audit import record_audit_event
from app.modules.security.audit_models import SecurityAuditEvent
from app.modules.team.models import InvitationStatus, OrganizationInvitation
from app.modules.team.schemas import (
    EffectivePermission,
    InvitationCreate,
    InvitationResponse,
    MatrixCapabilityResponse,
    MemberDetailResponse,
    MemberResource,
    MemberResources,
    MembershipUpdate,
    RoleMatrixResponse,
    RoleSummaryResponse,
    TeamActivityEntry,
    TeamMemberListResponse,
    TeamMemberResponse,
    TeamMetricsResponse,
)
from app.modules.team.service import (
    CANONICAL_ROLES,
    IMPLEMENTED_PERMISSION_SOURCES,
    ROLE_LABELS,
    UNSUPPORTED_PERMISSION_SOURCES,
    count_active_owners,
    effective_permissions,
    generate_invitation_token,
    hash_invitation_token,
    invitation_expiry,
    is_active_membership,
    is_last_active_owner,
    normalize_role,
    permission_labels_for_role,
    permission_matrix,
    permissions_for_role,
    resolve_invitation_status,
    role_label,
    role_rank,
    role_summaries,
)

router = APIRouter(
    prefix="/api/v1/organizations/{organization_id}/team",
    tags=["Team"],
)

#: Team related audit actions surfaced by the activity screens.
TEAM_ACTION_PREFIXES = ("member.", "permission.", "workspace.")


# --- Helpers ----------------------------------------------------------------


def _require_team_manager(
    db: Session, user_id: uuid_mod.UUID, organization_id: uuid_mod.UUID
) -> Membership:
    """Require an active membership that may administer the workspace team."""
    membership = require_membership(db, user_id, organization_id)
    if not has_permission(membership.role, Permission.MEMBER_MANAGE):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to manage team members",
        )
    return membership


def _get_membership(
    db: Session, organization_id: uuid_mod.UUID, membership_id: uuid_mod.UUID
) -> Membership:
    membership = db.scalar(
        select(Membership).where(
            Membership.id == membership_id,
            Membership.organization_id == organization_id,
        )
    )
    if membership is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Member not found",
        )
    return membership


def _member_response(membership: Membership) -> TeamMemberResponse:
    return TeamMemberResponse(
        id=membership.id,
        user_id=membership.user_id,
        email=membership.user.email if membership.user else "",
        role=membership.role.value,
        role_label=role_label(membership.role.value),
        status=membership.status or MembershipStatus.ACTIVE.value,
        created_at=membership.created_at,
        permissions=(
            permissions_for_role(membership.role.value)
            if is_active_membership(membership)
            else []
        ),
    )


def _invitation_response(
    db: Session,
    invitation: OrganizationInvitation,
    organization: Organization,
    token: str | None = None,
) -> InvitationResponse:
    inviter = db.get(User, invitation.invited_by) if invitation.invited_by else None
    return InvitationResponse(
        id=invitation.id,
        organization_id=invitation.organization_id,
        organization_name=organization.name,
        email=invitation.email,
        role=invitation.role,
        role_label=role_label(invitation.role),
        status=resolve_invitation_status(invitation),
        message=invitation.message,
        invited_by_email=inviter.email if inviter else None,
        expires_at=invitation.expires_at,
        created_at=invitation.created_at,
        accepted_at=invitation.accepted_at,
        revoked_at=invitation.revoked_at,
        permissions=permissions_for_role(invitation.role),
        permission_labels=permission_labels_for_role(invitation.role),
        invite_token=token,
    )


def _activity_entry(event: SecurityAuditEvent) -> TeamActivityEntry:
    details = event.details or {}
    title = str(details.get("title") or event.action)
    summary = details.get("summary")
    return TeamActivityEntry(
        id=str(event.id),
        action=event.action,
        title=title,
        summary=str(summary) if summary else None,
        category=event.category,
        outcome=event.outcome,
        resource_type=event.resource_type,
        resource_id=str(event.resource_id) if event.resource_id else None,
        resource_name=event.resource_name,
        actor_email=event.actor_email,
        created_at=event.created_at,
    )


def _team_activity_query(organization_id: uuid_mod.UUID):
    return select(SecurityAuditEvent).where(
        SecurityAuditEvent.organization_id == organization_id,
        or_(
            *[SecurityAuditEvent.action.startswith(prefix) for prefix in TEAM_ACTION_PREFIXES]
        ),
    )


# --- Metrics ----------------------------------------------------------------


@router.get("/metrics", response_model=TeamMetricsResponse)
def team_metrics(
    organization_id: uuid_mod.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_membership(db, current_user.id, organization_id)

    memberships = db.scalars(
        select(Membership).where(Membership.organization_id == organization_id)
    ).all()
    active = sum(1 for m in memberships if is_active_membership(m))

    pending_invitations = db.scalars(
        select(OrganizationInvitation).where(
            OrganizationInvitation.organization_id == organization_id,
            OrganizationInvitation.status == InvitationStatus.PENDING.value,
        )
    ).all()
    # Expired invitations are not pending any more.
    pending_count = sum(
        1
        for invitation in pending_invitations
        if resolve_invitation_status(invitation) == InvitationStatus.PENDING.value
    )

    return TeamMetricsResponse(
        total_members=len(memberships),
        active_members=active,
        suspended_members=len(memberships) - active,
        pending_invitations=pending_count,
        roles=len(CANONICAL_ROLES),
    )


# --- Members ----------------------------------------------------------------


@router.get("/members", response_model=TeamMemberListResponse)
def list_team_members(
    organization_id: uuid_mod.UUID,
    search: Optional[str] = Query(default=None),
    role: Optional[str] = Query(default=None),
    status_filter: Optional[str] = Query(default=None, alias="status"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_membership(db, current_user.id, organization_id)

    query = select(Membership).where(Membership.organization_id == organization_id)
    memberships = db.scalars(query).all()

    canonical_role = normalize_role(role)
    if canonical_role:
        memberships = [m for m in memberships if m.role.value == canonical_role]

    membership_status = (status_filter or "").strip().upper()
    if membership_status in {
        MembershipStatus.ACTIVE.value,
        MembershipStatus.SUSPENDED.value,
    }:
        memberships = [
            m
            for m in memberships
            if (m.status or MembershipStatus.ACTIVE.value) == membership_status
        ]

    term = (search or "").strip().lower()
    if term:
        memberships = [
            m
            for m in memberships
            if term in (m.user.email if m.user else "").lower()
            or term in m.role.value.lower()
            or term in role_label(m.role.value).lower()
        ]

    memberships.sort(key=lambda m: (m.role.value, (m.user.email if m.user else "")))
    items = [_member_response(m) for m in memberships]
    return TeamMemberListResponse(items=items, total=len(items))


@router.get("/members/{membership_id}", response_model=MemberDetailResponse)
def get_team_member(
    organization_id: uuid_mod.UUID,
    membership_id: uuid_mod.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    viewer = require_membership(db, current_user.id, organization_id)
    membership = _get_membership(db, organization_id, membership_id)
    can_manage = has_permission(viewer.role, Permission.MEMBER_MANAGE)

    entries = effective_permissions(membership)
    granted = [entry["permission"] for entry in entries if entry["granted"]]

    resources = _member_resources(
        db, organization_id, membership, viewer, can_manage
    )

    activity_rows = db.scalars(
        _team_activity_query(organization_id)
        .where(
            or_(
                SecurityAuditEvent.actor_user_id == membership.user_id,
                SecurityAuditEvent.resource_id == membership.user_id,
                SecurityAuditEvent.resource_id == membership.id,
            )
        )
        .order_by(SecurityAuditEvent.created_at.desc())
        .limit(50)
    ).all()

    unsupported = dict(UNSUPPORTED_PERMISSION_SOURCES)
    return MemberDetailResponse(
        member=_member_response(membership),
        effective_permissions=[EffectivePermission(**entry) for entry in entries],
        granted_permissions=granted,
        groups_supported=False,
        groups_note=unsupported.get("groups", ""),
        direct_access_supported=False,
        direct_access_note=unsupported.get("direct_access", ""),
        resources=resources,
        activity=[_activity_entry(event) for event in activity_rows],
        can_manage=can_manage,
    )


def _member_resources(
    db: Session,
    organization_id: uuid_mod.UUID,
    membership: Membership,
    viewer: Membership,
    can_manage: bool,
) -> MemberResources:
    """Resolve the resources a member can reach, gated by the viewer's rights."""
    member_can_read_agents = has_permission(
        membership.role, Permission.AGENT_READ
    ) and is_active_membership(membership)
    viewer_can_open_agents = has_permission(viewer.role, Permission.AGENT_READ)

    agents: list[MemberResource] = []
    if member_can_read_agents:
        rows = db.scalars(
            select(Agent)
            .where(
                Agent.organization_id == organization_id,
                Agent.is_archived.is_(False),
            )
            .order_by(Agent.created_at.desc())
            .limit(50)
        ).all()
        agents = [
            MemberResource(
                id=str(agent.id),
                name=agent.name,
                type="AI Agent",
                href=(
                    f"/dashboard/organizations/{organization_id}/agents/{agent.id}"
                    if viewer_can_open_agents
                    else None
                ),
                can_open=viewer_can_open_agents,
            )
            for agent in rows
        ]

    knowledge_bases: list[MemberResource] = []
    if member_can_read_agents:
        rows = db.scalars(
            select(KnowledgeBase)
            .where(KnowledgeBase.organization_id == organization_id)
            .order_by(KnowledgeBase.created_at.desc())
            .limit(50)
        ).all()
        knowledge_bases = [
            MemberResource(
                id=str(kb.id),
                name=kb.name,
                type="Knowledge Base",
                href=(
                    f"/dashboard/organizations/{organization_id}/knowledge/{kb.id}"
                    if viewer_can_open_agents
                    else None
                ),
                can_open=viewer_can_open_agents,
            )
            for kb in rows
        ]

    approvals: list[MemberResource] = []
    assigned_policies = db.scalars(
        select(ApprovalAssignment).where(
            ApprovalAssignment.organization_id == organization_id,
            ApprovalAssignment.user_id == membership.user_id,
        )
    ).all()
    assigned_policy_ids = {a.policy_id for a in assigned_policies if a.policy_id}

    approval_query = select(WorkflowApproval).where(
        WorkflowApproval.organization_id == organization_id,
        or_(
            WorkflowApproval.requested_by == membership.user_id,
            WorkflowApproval.decided_by == membership.user_id,
        ),
    )
    if assigned_policy_ids:
        approval_query = select(WorkflowApproval).where(
            WorkflowApproval.organization_id == organization_id,
            or_(
                WorkflowApproval.requested_by == membership.user_id,
                WorkflowApproval.decided_by == membership.user_id,
                WorkflowApproval.policy_id.in_(assigned_policy_ids),
            ),
        )
    approval_rows = db.scalars(
        approval_query.order_by(WorkflowApproval.created_at.desc()).limit(50)
    ).all()
    approvals = [
        MemberResource(
            id=str(approval.id),
            name=f"{approval.action} request",
            type="Approval Request",
            href=(
                f"/dashboard/organizations/{organization_id}/approvals/{approval.id}"
                if has_permission(viewer.role, Permission.MEMBER_MANAGE)
                or has_permission(viewer.role, Permission.EVALUATION_RUN)
                else None
            ),
            can_open=has_permission(viewer.role, Permission.MEMBER_MANAGE)
            or has_permission(viewer.role, Permission.EVALUATION_RUN),
        )
        for approval in approval_rows
    ]

    return MemberResources(
        agents=agents,
        knowledge_bases=knowledge_bases,
        approvals=approvals,
        agents_count=len(agents),
        knowledge_bases_count=len(knowledge_bases),
        approvals_count=len(approvals),
        workflows_supported=False,
        workflows_note=(
            "Workflows are defined in code and are not assigned to individual "
            "members, so no per-member workflow grants exist."
        ),
    )


@router.patch("/members/{membership_id}", response_model=TeamMemberResponse)
def update_team_member(
    organization_id: uuid_mod.UUID,
    membership_id: uuid_mod.UUID,
    request: MembershipUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    actor = _require_team_manager(db, current_user.id, organization_id)
    membership = _get_membership(db, organization_id, membership_id)

    before_role = membership.role.value
    before_status = membership.status or MembershipStatus.ACTIVE.value
    before: dict[str, str] = {}
    after: dict[str, str] = {}

    new_role: str | None = None
    if request.role is not None:
        new_role = normalize_role(request.role)
        if new_role is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Unknown workspace role",
            )

    new_status: str | None = None
    if request.status is not None:
        new_status = request.status.strip().upper()
        if new_status not in {
            MembershipStatus.ACTIVE.value,
            MembershipStatus.SUSPENDED.value,
        }:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Unknown membership status",
            )

    # Every guard runs before the membership is mutated so a rejected
    # request never leaves a half applied change behind.
    role_changes = new_role is not None and new_role != before_role
    status_changes = new_status is not None and new_status != before_status

    if role_changes:
        _assert_role_change_allowed(db, actor, membership, new_role)
    if status_changes and new_status == MembershipStatus.SUSPENDED.value:
        _assert_can_suspend(db, actor, membership)

    if not role_changes and not status_changes:
        return _member_response(membership)

    if membership.user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot change your own workspace role or status",
        )

    if role_changes:
        membership.role = Role(new_role)
        before["role"] = before_role
        after["role"] = new_role
    if status_changes:
        membership.status = new_status
        before["status"] = before_status
        after["status"] = new_status

    db.commit()
    db.refresh(membership)

    action = "member.role_changed" if "role" in after else "member.suspended"
    if after.get("status") == MembershipStatus.ACTIVE.value:
        action = "member.reactivated"
    record_audit_event(
        db,
        organization_id=organization_id,
        actor_user_id=current_user.id,
        action=action,
        resource_type="member",
        resource_id=membership.user_id,
        resource_name=membership.user.email if membership.user else None,
        details={
            "membership_id": str(membership.id),
            "member_email": membership.user.email if membership.user else None,
        },
        changes={"before": before, "after": after},
        summary=(
            f"{current_user.email} updated the workspace membership of "
            f"{membership.user.email if membership.user else 'a member'}."
        ),
    )
    return _member_response(membership)


def _assert_not_last_owner(db: Session, membership: Membership) -> None:
    """A workspace must always keep at least one active owner."""
    if is_last_active_owner(db, membership):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="The workspace must keep at least one active owner",
        )


def _assert_role_change_allowed(
    db: Session, actor: Membership, membership: Membership, new_role: str
) -> None:
    """Block privilege escalation and owner demotion by non-owners."""
    if new_role != Role.OWNER.value:
        _assert_not_last_owner(db, membership)
    if membership.role == Role.OWNER and actor.role != Role.OWNER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only an owner can change the role of an owner",
        )
    if role_rank(new_role) > role_rank(actor.role.value):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You cannot grant a role above your own",
        )


def _assert_can_suspend(db: Session, actor: Membership, membership: Membership) -> None:
    _assert_not_last_owner(db, membership)
    if membership.role == Role.OWNER and actor.role != Role.OWNER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only an owner can suspend an owner",
        )


@router.delete("/members/{membership_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_team_member(
    organization_id: uuid_mod.UUID,
    membership_id: uuid_mod.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    actor = _require_team_manager(db, current_user.id, organization_id)
    membership = _get_membership(db, organization_id, membership_id)

    _assert_not_last_owner(db, membership)
    if membership.user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot remove your own workspace membership",
        )
    if membership.role == Role.OWNER and actor.role != Role.OWNER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only an owner can remove an owner",
        )

    member_email = membership.user.email if membership.user else None
    member_user_id = membership.user_id
    db.delete(membership)
    db.commit()

    record_audit_event(
        db,
        organization_id=organization_id,
        actor_user_id=current_user.id,
        action="member.removed",
        resource_type="member",
        resource_id=member_user_id,
        resource_name=member_email,
        details={
            "membership_id": str(membership_id),
            "member_email": member_email,
        },
        changes={
            "before": {
                "role": membership.role.value,
                "status": membership.status or MembershipStatus.ACTIVE.value,
            },
            "after": None,
        },
        summary=(
            f"{current_user.email} removed {member_email or 'a member'} from the "
            "workspace."
        ),
    )
    return None


# --- Invitations ------------------------------------------------------------


@router.get("/invitations", response_model=list[InvitationResponse])
def list_invitations(
    organization_id: uuid_mod.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_team_manager(db, current_user.id, organization_id)
    organization = db.get(Organization, organization_id)
    invitations = db.scalars(
        select(OrganizationInvitation)
        .where(OrganizationInvitation.organization_id == organization_id)
        .order_by(OrganizationInvitation.created_at.desc())
    ).all()
    return [
        _invitation_response(db, invitation, organization) for invitation in invitations
    ]


@router.post(
    "/invitations", response_model=InvitationResponse, status_code=status.HTTP_201_CREATED
)
def create_invitation(
    organization_id: uuid_mod.UUID,
    request: InvitationCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    actor = _require_team_manager(db, current_user.id, organization_id)
    organization = db.get(Organization, organization_id)
    if organization is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found"
        )

    email = str(request.email).strip().lower()
    canonical_role = normalize_role(request.role)
    if canonical_role is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Unknown workspace role",
        )
    if canonical_role == Role.OWNER.value and actor.role != Role.OWNER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only an owner can invite another owner",
        )
    if role_rank(canonical_role) > role_rank(actor.role.value):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You cannot grant a role above your own",
        )

    existing_user = db.scalar(select(User).where(User.email == email))
    if existing_user is not None:
        existing_membership = db.scalar(
            select(Membership).where(
                Membership.organization_id == organization_id,
                Membership.user_id == existing_user.id,
            )
        )
        if existing_membership is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This person is already a member of the workspace",
            )

    pending_invitations = db.scalars(
        select(OrganizationInvitation).where(
            OrganizationInvitation.organization_id == organization_id,
            OrganizationInvitation.email == email,
            OrganizationInvitation.status == InvitationStatus.PENDING.value,
        )
    ).all()
    if any(
        resolve_invitation_status(invitation) == InvitationStatus.PENDING.value
        for invitation in pending_invitations
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A pending invitation already exists for this address",
        )

    token = generate_invitation_token()
    invitation = OrganizationInvitation(
        organization_id=organization_id,
        email=email,
        role=canonical_role,
        status=InvitationStatus.PENDING.value,
        token_hash=hash_invitation_token(token),
        message=(request.message or "").strip() or None,
        invited_by=current_user.id,
        expires_at=invitation_expiry(),
    )
    db.add(invitation)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A pending invitation already exists for this address",
        )
    db.refresh(invitation)

    record_audit_event(
        db,
        organization_id=organization_id,
        actor_user_id=current_user.id,
        action="member.invited",
        resource_type="member",
        resource_id=None,
        resource_name=email,
        details={
            "invitation_id": str(invitation.id),
            "member_email": email,
            "role": canonical_role,
            "expires_at": invitation.expires_at.isoformat(),
        },
        changes={
            "before": {"role": None, "status": None},
            "after": {"role": canonical_role, "status": InvitationStatus.PENDING.value},
        },
        summary=f"{current_user.email} invited {email} to the workspace.",
    )
    return _invitation_response(db, invitation, organization, token=token)


@router.post("/invitations/{invitation_id}/resend", response_model=InvitationResponse)
def resend_invitation(
    organization_id: uuid_mod.UUID,
    invitation_id: uuid_mod.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_team_manager(db, current_user.id, organization_id)
    organization = db.get(Organization, organization_id)

    invitation = db.scalar(
        select(OrganizationInvitation).where(
            OrganizationInvitation.id == invitation_id,
            OrganizationInvitation.organization_id == organization_id,
        )
    )
    if invitation is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Invitation not found"
        )
    if invitation.status == InvitationStatus.ACCEPTED.value:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This invitation has already been accepted",
        )
    if invitation.status == InvitationStatus.REVOKED.value:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This invitation has been revoked",
        )

    token = generate_invitation_token()
    previous_status = invitation.status
    invitation.token_hash = hash_invitation_token(token)
    invitation.status = InvitationStatus.PENDING.value
    invitation.expires_at = invitation_expiry()
    db.commit()
    db.refresh(invitation)

    record_audit_event(
        db,
        organization_id=organization_id,
        actor_user_id=current_user.id,
        action="member.invitation_resent",
        resource_type="member",
        resource_id=None,
        resource_name=invitation.email,
        details={
            "invitation_id": str(invitation.id),
            "member_email": invitation.email,
            "role": invitation.role,
        },
        changes={
            "before": {"status": previous_status},
            "after": {"status": InvitationStatus.PENDING.value},
        },
        summary=(
            f"{current_user.email} resent the workspace invitation to "
            f"{invitation.email}."
        ),
    )
    return _invitation_response(db, invitation, organization, token=token)


@router.post("/invitations/{invitation_id}/revoke", response_model=InvitationResponse)
def revoke_invitation(
    organization_id: uuid_mod.UUID,
    invitation_id: uuid_mod.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_team_manager(db, current_user.id, organization_id)
    organization = db.get(Organization, organization_id)

    invitation = db.scalar(
        select(OrganizationInvitation).where(
            OrganizationInvitation.id == invitation_id,
            OrganizationInvitation.organization_id == organization_id,
        )
    )
    if invitation is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Invitation not found"
        )
    if invitation.status == InvitationStatus.ACCEPTED.value:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This invitation has already been accepted",
        )
    if invitation.status == InvitationStatus.REVOKED.value:
        return _invitation_response(db, invitation, organization)

    before_status = invitation.status
    invitation.status = InvitationStatus.REVOKED.value
    invitation.revoked_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(invitation)

    record_audit_event(
        db,
        organization_id=organization_id,
        actor_user_id=current_user.id,
        action="member.invitation_revoked",
        resource_type="member",
        resource_id=None,
        resource_name=invitation.email,
        details={
            "invitation_id": str(invitation.id),
            "member_email": invitation.email,
        },
        changes={
            "before": {"status": before_status},
            "after": {"status": InvitationStatus.REVOKED.value},
        },
        summary=(
            f"{current_user.email} revoked the workspace invitation for "
            f"{invitation.email}."
        ),
    )
    return _invitation_response(db, invitation, organization)


# --- Roles and permissions --------------------------------------------------


@router.get("/roles", response_model=list[RoleSummaryResponse])
def list_roles(
    organization_id: uuid_mod.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_membership(db, current_user.id, organization_id)

    memberships = db.scalars(
        select(Membership).where(Membership.organization_id == organization_id)
    ).all()
    counts: dict[str, int] = {}
    for membership in memberships:
        counts[membership.role.value] = counts.get(membership.role.value, 0) + 1

    summaries = role_summaries()
    for summary in summaries:
        summary["member_count"] = counts.get(summary["role"], 0)
    return summaries


@router.get("/permissions/matrix", response_model=RoleMatrixResponse)
def get_permission_matrix(
    organization_id: uuid_mod.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_membership(db, current_user.id, organization_id)
    return RoleMatrixResponse(
        roles=list(CANONICAL_ROLES),
        role_labels={role: ROLE_LABELS[role] for role in CANONICAL_ROLES},
        capabilities=[
            MatrixCapabilityResponse(**entry) for entry in permission_matrix()
        ],
    )


# --- Activity ---------------------------------------------------------------


@router.get("/activity", response_model=list[TeamActivityEntry])
def team_activity(
    organization_id: uuid_mod.UUID,
    limit: int = Query(default=50, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_membership(db, current_user.id, organization_id)
    events = db.scalars(
        _team_activity_query(organization_id)
        .order_by(SecurityAuditEvent.created_at.desc())
        .limit(limit)
    ).all()
    return [_activity_entry(event) for event in events]
