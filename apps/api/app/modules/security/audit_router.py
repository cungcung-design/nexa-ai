from datetime import datetime
from uuid import UUID

from fastapi import Query
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.permissions import Permission
from app.core.tenant_security import require_permission
from app.db.session import get_db
from app.modules.auth.dependencies import get_current_user
from app.modules.security.audit_models import (
    SecurityAuditEvent,
)


router = APIRouter(
    prefix="/api/v1/organizations/{organization_id}/audit-logs",
    tags=["Security Audit Logs"],
)


class AuditEventResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    organization_id: UUID
    actor_user_id: UUID
    action: str
    resource_type: str
    resource_id: UUID
    details: dict
    created_at: datetime


@router.get(
    "",
    response_model=list[AuditEventResponse],
)
def list_audit_events(
    organization_id: UUID,
    limit: int = Query(default=50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
    membership=Depends(
        require_permission(Permission.ANALYTICS_READ)
    ),
):
    statement = (
        select(SecurityAuditEvent)
        .where(
            SecurityAuditEvent.organization_id
            == organization_id
        )
        .order_by(
            SecurityAuditEvent.created_at.desc(),
            SecurityAuditEvent.id.desc(),
        )
        .limit(limit)
    )

    return db.scalars(statement).all()