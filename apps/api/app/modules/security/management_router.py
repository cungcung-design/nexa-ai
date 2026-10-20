from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, ConfigDict
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.permissions import Permission
from app.core.tenant_security import require_permission
from app.db.session import get_db
from app.modules.auth.dependencies import get_current_user
from app.modules.security.api_keys import (
    ALLOWED_SCOPES,
    generate_api_key,
)
from app.modules.security.audit import record_audit_event
from app.modules.security.models import OrganizationAPIKey


router = APIRouter(
    prefix="/api/v1/organizations/{organization_id}/api-keys",
    tags=["API Key Management"],
)


class CreateKeyRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    scopes: list[str] = Field(min_length=1)


class KeyResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    key_prefix: str
    scopes: list[str]
    is_active: bool
    created_at: datetime
    revoked_at: datetime | None


class CreatedKeyResponse(KeyResponse):
    api_key: str


@router.post(
    "",
    response_model=CreatedKeyResponse,
    status_code=201,
)
def create_key(
    organization_id: UUID,
    payload: CreateKeyRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
    membership=Depends(
        require_permission(Permission.MEMBER_MANAGE)
    ),
):
    # Validate scopes
    invalid_scopes = set(payload.scopes) - ALLOWED_SCOPES
    if invalid_scopes:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid scopes: {invalid_scopes}",
        )

    # Generate the API key
    plaintext_key, prefix, key_hash = generate_api_key()

    # Create the API key record
    api_key = OrganizationAPIKey(
        organization_id=organization_id,
        name=payload.name,
        key_prefix=prefix,
        key_hash=key_hash,
        scopes=list(payload.scopes),
    )
    db.add(api_key)
    db.commit()
    db.refresh(api_key)

    # Record the security event. Only metadata is stored, never the key.
    record_audit_event(
        db=db,
        organization_id=organization_id,
        actor_user_id=current_user.id,
        action="api_key.created",
        resource_type="api_key",
        resource_id=api_key.id,
        resource_name=api_key.name,
        details={
            "name": payload.name,
            "scopes": list(payload.scopes),
            "key_prefix": prefix,
        },
        changes={
            "before": {},
            "after": {"name": payload.name, "scopes": list(payload.scopes)},
        },
        summary=(
            f"{current_user.email} created the API key “{payload.name}”."
        ),
    )

    # Return the created key with the plaintext (only shown once)
    return CreatedKeyResponse(
        api_key=plaintext_key,
        **api_key.__dict__,
    )


@router.get(
    "",
    response_model=list[KeyResponse],
)
def list_keys(
    organization_id: UUID,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
    membership=Depends(
        require_permission(Permission.MEMBER_MANAGE)
    ),
):
    keys = db.scalars(
        select(OrganizationAPIKey).where(
            OrganizationAPIKey.organization_id == organization_id,
            OrganizationAPIKey.is_active.is_(True),
        )
    ).all()
    return keys


@router.post(
    "/{key_id}/revoke",
    response_model=KeyResponse,
)
def revoke_key(
    organization_id: UUID,
    key_id: UUID,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
    membership=Depends(
        require_permission(Permission.MEMBER_MANAGE)
    ),
):
    api_key = db.scalar(
        select(OrganizationAPIKey).where(
            OrganizationAPIKey.id == key_id,
            OrganizationAPIKey.organization_id == organization_id,
            OrganizationAPIKey.is_active.is_(True),
        )
    )

    if api_key is None:
        raise HTTPException(
            status_code=404,
            detail="API key not found",
        )

    # Revoke the key
    api_key.is_active = False
    api_key.revoked_at = datetime.now(timezone.utc)
    db.add(api_key)
    db.commit()
    db.refresh(api_key)

    # Record the security event
    record_audit_event(
        db=db,
        organization_id=organization_id,
        actor_user_id=current_user.id,
        action="api_key.revoked",
        resource_type="api_key",
        resource_id=api_key.id,
        resource_name=api_key.name,
        details={
            "name": api_key.name,
            "scopes": list(api_key.scopes or []),
            "key_prefix": api_key.key_prefix,
        },
        changes={
            "before": {"active": True},
            "after": {"active": False},
        },
        summary=f"{current_user.email} revoked the API key “{api_key.name}”.",
    )

    return api_key


@router.post(
    "/{key_id}/rotate",
    response_model=CreatedKeyResponse,
)
def rotate_key(
    organization_id: UUID,
    key_id: UUID,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
    membership=Depends(
        require_permission(Permission.MEMBER_MANAGE)
    ),
):
    old_key = db.scalar(
        select(OrganizationAPIKey)
        .where(
            OrganizationAPIKey.id == key_id,
            OrganizationAPIKey.organization_id
            == organization_id,
            OrganizationAPIKey.is_active.is_(True),
        )
        .with_for_update()
    )

    if old_key is None:
        raise HTTPException(
            status_code=404,
            detail="Active API key not found",
        )

    # Generate new key
    plaintext_key, prefix, key_hash = generate_api_key()

    # Create new key record
    new_key = OrganizationAPIKey(
        organization_id=organization_id,
        name=f"{old_key.name} (rotated)",
        key_prefix=prefix,
        key_hash=key_hash,
        scopes=old_key.scopes.copy(),  # Copy the scopes
    )
    db.add(new_key)

    # Revoke old key
    old_key.is_active = False
    old_key.revoked_at = datetime.now(timezone.utc)
    db.add(old_key)
    
    db.commit()
    db.refresh(new_key)

    # Record the security event for key creation
    record_audit_event(
        db=db,
        organization_id=organization_id,
        actor_user_id=current_user.id,
        action="api_key.rotated",
        resource_type="api_key",
        resource_id=new_key.id,
        resource_name=old_key.name,
        details={
            "old_key_id": str(old_key.id),
            "new_key_id": str(new_key.id),
            "name": old_key.name,
            "key_prefix": prefix,
        },
        changes={
            "before": {"key_id": str(old_key.id), "active": True},
            "after": {"key_id": str(new_key.id), "active": True},
        },
        summary=f"{current_user.email} rotated the API key “{old_key.name}”.",
    )

    # Return the new key with the plaintext (only shown once)
    return CreatedKeyResponse(
        api_key=plaintext_key,
        **new_key.__dict__,
    )