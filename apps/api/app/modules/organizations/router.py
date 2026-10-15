from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from app.db.models import User, Organization, Membership, Role as RoleEnum
from app.db.session import get_db
from app.modules.auth.dependencies import get_current_user
from app.modules.organizations.schemas import (
    OrganizationCreate,
    OrganizationResponse,
    MemberResponse,
    AddMemberRequest,
)

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
    db.flush()

    membership = Membership(
        user_id=current_user.id,
        organization_id=org.id,
        role=RoleEnum.OWNER,
    )
    db.add(membership)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Organization slug already exists",
        )

    db.refresh(org)
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
        .filter(Membership.user_id == current_user.id)
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
    return MemberResponse(
        user_id=user.id, email=user.email, role=membership.role.value
    )