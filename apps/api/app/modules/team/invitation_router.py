"""Public invitation APIs used by the recipient of a workspace invitation."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db.models import Membership, MembershipStatus, Organization, Role, User
from app.db.session import get_db
from app.modules.auth.dependencies import get_current_user
from app.modules.security.audit import record_audit_event
from app.modules.team.models import InvitationStatus, OrganizationInvitation
from app.modules.team.schemas import InvitationPreview, TeamMemberResponse
from app.modules.billing.usage import check_seat_quota
from app.modules.team.service import (
    hash_invitation_token,
    is_expired,
    permission_labels_for_role,
    permissions_for_role,
    resolve_invitation_status,
    role_label,
)

router = APIRouter(prefix="/api/v1/invitations", tags=["Team Invitations"])


def _find_invitation(
    db: Session, token: str, *, lock: bool = False
) -> OrganizationInvitation:
    statement = select(OrganizationInvitation).where(
        OrganizationInvitation.token_hash == hash_invitation_token(token)
    )
    if lock:
        statement = statement.with_for_update()
    invitation = db.scalar(statement)
    if invitation is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Invitation not found"
        )
    return invitation


@router.get("/{token}", response_model=InvitationPreview)
def preview_invitation(token: str, db: Session = Depends(get_db)):
    """Return the invitation state without exposing the token or any secret."""
    invitation = _find_invitation(db, token)
    organization = db.get(Organization, invitation.organization_id)
    return InvitationPreview(
        email=invitation.email,
        organization_id=invitation.organization_id,
        organization_name=organization.name if organization else "",
        role=invitation.role,
        role_label=role_label(invitation.role),
        status=resolve_invitation_status(invitation),
        message=invitation.message,
        expires_at=invitation.expires_at,
        permissions=permissions_for_role(invitation.role),
        permission_labels=permission_labels_for_role(invitation.role),
    )


@router.post("/{token}/accept", response_model=TeamMemberResponse)
def accept_invitation(
    token: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Accept an invitation and create or activate the membership."""
    invitation = _find_invitation(db, token, lock=True)

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
    if is_expired(invitation):
        if invitation.status == InvitationStatus.PENDING.value:
            invitation.status = InvitationStatus.EXPIRED.value
            db.commit()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This invitation has expired",
        )

    if (current_user.email or "").strip().lower() != invitation.email.strip().lower():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This invitation was issued to a different email address",
        )

    membership = db.scalar(
        select(Membership).where(
            Membership.organization_id == invitation.organization_id,
            Membership.user_id == current_user.id,
        )
    )
    if membership is not None and (
        membership.status or MembershipStatus.ACTIVE.value
    ) == MembershipStatus.ACTIVE.value:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You are already a member of this workspace",
        )

    # A new seat consumes plan capacity, so the seat quota is enforced
    # before the membership is created.
    check_seat_quota(db, invitation.organization_id)

    role = Role(invitation.role)
    before_role = membership.role.value if membership is not None else None
    before_status = (
        (membership.status or MembershipStatus.ACTIVE.value)
        if membership is not None
        else None
    )
    if membership is None:
        membership = Membership(
            user_id=current_user.id,
            organization_id=invitation.organization_id,
            role=role,
            status=MembershipStatus.ACTIVE.value,
        )
        db.add(membership)
    else:
        membership.role = role
        membership.status = MembershipStatus.ACTIVE.value

    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You are already a member of this workspace",
        )

    invitation.status = InvitationStatus.ACCEPTED.value
    invitation.accepted_at = datetime.now(timezone.utc)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="The membership could not be created",
        )
    db.refresh(membership)

    record_audit_event(
        db,
        organization_id=invitation.organization_id,
        actor_user_id=current_user.id,
        action="member.invitation_accepted",
        resource_type="member",
        resource_id=current_user.id,
        resource_name=current_user.email,
        details={
            "invitation_id": str(invitation.id),
            "member_email": current_user.email,
            "role": role.value,
        },
        changes={
            "before": {"role": before_role, "status": before_status},
            "after": {"role": role.value, "status": MembershipStatus.ACTIVE.value},
        },
        summary=(
            f"{current_user.email} accepted the workspace invitation as "
            f"{role.value}."
        ),
    )

    return TeamMemberResponse(
        id=membership.id,
        user_id=membership.user_id,
        email=current_user.email,
        role=membership.role.value,
        role_label=role_label(membership.role.value),
        status=membership.status or MembershipStatus.ACTIVE.value,
        created_at=membership.created_at,
        permissions=permissions_for_role(membership.role.value),
    )
