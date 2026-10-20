from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from app.db.models import (
    User,
    Organization,
    Membership,
    MembershipStatus,
    Role as RoleEnum,
)
from app.db.session import get_db
from app.modules.auth.dependencies import get_current_user
from app.modules.billing.usage import check_seat_quota
from app.modules.organizations.schemas import (
    OrganizationCreate,
    OrganizationResponse,
    MemberResponse,
    AddMemberRequest,
)
from app.modules.security.audit import record_audit_event

router = APIRouter(prefix="/api/v1/organizations", tags=["Organizations"])


def require_membership(
    db: Session,
    user_id: UUID,
    organization_id: UUID,
    allowed_roles: list[RoleEnum] | None = None,
) -> Membership:
    membership = (
        db.query(Membership)
        .filter(
            Membership.user_id == user_id,
            Membership.organization_id == organization_id,
        )
        .first()
    )
    if not membership:
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
    if allowed_roles and membership.role not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions",
        )
    return membership


@router.post(
    "", response_model=OrganizationResponse, status_code=status.HTTP_201_CREATED
)
def create_organization(
    request: OrganizationCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    org = Organization(name=request.name, slug=request.slug.lower())
    db.add(org)

    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Organization slug already exists",
        )

    membership = Membership(
        user_id=current_user.id,
        organization_id=org.id,
        role=RoleEnum.OWNER,
    )
    db.add(membership)

    try:
        db.flush()
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Organization slug already exists",
        )

    db.refresh(org)
    record_audit_event(
        db,
        organization_id=org.id,
        actor_user_id=current_user.id,
        action="workspace.created",
        resource_type="organization",
        resource_id=org.id,
        resource_name=org.name,
        details={"slug": org.slug, "role": RoleEnum.OWNER.value},
        changes={"before": {}, "after": {"name": org.name, "slug": org.slug}},
        summary=f"{current_user.email} created the workspace “{org.name}”.",
    )
    return OrganizationResponse(
        id=org.id, name=org.name, slug=org.slug, role=RoleEnum.OWNER.value
    )


@router.get("", response_model=list[OrganizationResponse])
def list_organizations(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    memberships = (
        db.query(Membership)
        .filter(
            Membership.user_id == current_user.id,
            Membership.status == MembershipStatus.ACTIVE.value,
        )
        .all()
    )
    result = []
    for m in memberships:
        org = m.organization
        result.append(
            OrganizationResponse(
                id=org.id,
                name=org.name,
                slug=org.slug,
                role=m.role.value,
            )
        )
    return result


@router.get("/{organization_id}", response_model=OrganizationResponse)
def get_organization(
    organization_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    membership = require_membership(db, current_user.id, organization_id)
    org = membership.organization
    return OrganizationResponse(
        id=org.id, name=org.name, slug=org.slug, role=membership.role.value
    )


@router.get("/{organization_id}/members", response_model=list[MemberResponse])
def list_members(
    organization_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_membership(db, current_user.id, organization_id)

    memberships = (
        db.query(Membership)
        .filter(Membership.organization_id == organization_id)
        .all()
    )
    result = []
    for m in memberships:
        user = m.user
        result.append(
            MemberResponse(user_id=user.id, email=user.email, role=m.role.value)
        )
    return result


@router.post(
    "/{organization_id}/members",
    response_model=MemberResponse,
    status_code=status.HTTP_201_CREATED,
)
def add_member(
    organization_id: UUID,
    request: AddMemberRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_membership(
        db,
        current_user.id,
        organization_id,
        allowed_roles=[RoleEnum.OWNER, RoleEnum.ADMIN],
    )

    user = db.query(User).filter(User.email == request.email.lower()).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    existing = db.query(Membership).filter(
        Membership.user_id == user.id,
        Membership.organization_id == organization_id,
    ).first()
    if existing is None:
        # A new member consumes a seat, so the plan seat quota applies on
        # this path exactly like it does when an invitation is accepted.
        check_seat_quota(db, organization_id)

    membership = Membership(
        user_id=user.id,
        organization_id=organization_id,
        role=RoleEnum(request.role),
    )
    db.add(membership)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User is already a member of this organization",
        )

    db.refresh(membership)
    record_audit_event(
        db,
        organization_id=organization_id,
        actor_user_id=current_user.id,
        action="member.added",
        resource_type="member",
        resource_id=user.id,
        resource_name=user.email,
        details={"role": membership.role.value, "member_email": user.email},
        changes={
            "before": {"role": None},
            "after": {"role": membership.role.value},
        },
        summary=(
            f"{current_user.email} added {user.email} to the workspace as "
            f"{membership.role.value}."
        ),
    )
    return MemberResponse(
        user_id=user.id, email=user.email, role=membership.role.value
    )