from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, ConfigDict, field_validator
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
    expires_at: datetime | None = None

    @field_validator("expires_at")
    @classmethod
    def expiration_is_supported(cls, value: datetime | None) -> datetime | None:
        if value is None:
            return None
        if value.tzinfo is None:
            raise ValueError("Expiration must include a timezone")
        now = datetime.now(timezone.utc)
        if value <= now:
            raise ValueError("Expiration must be in the future")
        if value > now + timedelta(days=366):
            raise ValueError("Expiration cannot be more than 366 days away")
        return value


class KeyResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    key_prefix: str
    scopes: list[str]
    is_active: bool
    created_at: datetime
    expires_at: datetime | None = None
    revoked_at: datetime | None


class CreatedKeyResponse(KeyResponse):
    api_key: str


def _public_key(record: OrganizationAPIKey, plaintext: str | None = None):
    payload = KeyResponse.model_validate(record).model_dump()
    if plaintext is None:
        return KeyResponse.model_validate(payload)
    return CreatedKeyResponse(api_key=plaintext, **payload)


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
    invalid_scopes = sorted(set(payload.scopes) - ALLOWED_SCOPES)
    if invalid_scopes:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid scopes: {', '.join(invalid_scopes)}",
        )

    plaintext_key, prefix, key_hash = generate_api_key()

    api_key = OrganizationAPIKey(
        organization_id=organization_id,
        name=payload.name,
        key_prefix=prefix,
        key_hash=key_hash,
        scopes=list(payload.scopes),
        expires_at=payload.expires_at,
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

    return _public_key(api_key, plaintext_key)


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
        select(OrganizationAPIKey)
        .where(OrganizationAPIKey.organization_id == organization_id)
        .order_by(OrganizationAPIKey.created_at.desc())
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

    if old_key.expires_at is not None and old_key.expires_at <= datetime.now(
        timezone.utc
    ):
        raise HTTPException(
            status_code=400,
            detail="Expired keys cannot be rotated",
        )

    plaintext_key, prefix, key_hash = generate_api_key()

    # Create new key record
    new_key = OrganizationAPIKey(
        organization_id=organization_id,
        name=f"{old_key.name} (rotated)",
        key_prefix=prefix,
        key_hash=key_hash,
        scopes=list(old_key.scopes or []),
        expires_at=old_key.expires_at,
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

    return _public_key(new_key, plaintext_key)