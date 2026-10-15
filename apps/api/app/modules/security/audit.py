from uuid import UUID

from sqlalchemy.orm import Session

from app.modules.security.audit_models import (
    SecurityAuditEvent,
)


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
    event = SecurityAuditEvent(
        organization_id=organization_id,
        actor_user_id=actor_user_id,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        details=details or {},
    )

    db.add(event)
    db.commit()
    db.refresh(event)
    return event