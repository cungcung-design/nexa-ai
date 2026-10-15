from uuid import UUID

from fastapi import Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.permissions import Permission, has_permission
from app.db.session import get_db
from app.modules.auth.dependencies import get_current_user
from app.db.models import Membership


def require_permission(permission: Permission):
    def dependency(
        organization_id: UUID,
        db: Session = Depends(get_db),
        current_user=Depends(get_current_user),
    ):
        membership = db.scalar(
            select(Membership).where(
                Membership.organization_id == organization_id,
                Membership.user_id == current_user.id,
            )
        )

        if membership is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Organization not found or access denied",
            )

        if not has_permission(membership.role, permission):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions",
            )

        return membership

    return dependency