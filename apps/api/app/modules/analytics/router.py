from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.modules.auth.dependencies import get_current_user
from app.modules.organizations.router import require_membership
from app.modules.analytics.models import (
    AIRequestTrace,
    AIExecutionSpan,
)
from app.core.permissions import Permission
from app.core.tenant_security import require_permission

router = APIRouter(
    prefix="/api/v1/organizations/{organization_id}/analytics",
    tags=["Analytics"],
)


class TraceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    organization_id: UUID
    agent_id: UUID
    status: str
    error_code: str | None
    latency_ms: int
    prompt_tokens: int
    completion_tokens: int


class SpanResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    trace_id: UUID
    name: str
    duration_ms: int
    status: str


@router.get(
    "/traces",
    response_model=list[TraceResponse],
)
def get_traces(
    organization_id: UUID,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    require_membership(
        db,
        current_user.id,
        organization_id,
        allowed_roles=[
            "OWNER",
            "ADMIN",
            "DEVELOPER",
            "VIEWER",
        ],
    )

    traces = db.scalars(
        select(AIRequestTrace)
        .where(AIRequestTrace.organization_id == organization_id)
        .order_by(AIRequestTrace.created_at.desc())
        .limit(50)
    ).all()

    return traces


@router.get(
    "/traces/{trace_id}/spans",
    response_model=list[SpanResponse],
)
def get_trace_spans(
    organization_id: UUID,
    trace_id: UUID,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
    membership=Depends(
        require_permission(Permission.ANALYTICS_READ)
    ),
):
    # Verify the trace belongs to the organization
    trace = db.scalar(
        select(AIRequestTrace).where(
            AIRequestTrace.id == trace_id,
            AIRequestTrace.organization_id == organization_id,
        )
    )
    if trace is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Trace not found",
        )

    spans = db.scalars(
        select(AIExecutionSpan)
        .where(AIExecutionSpan.trace_id == trace_id)
        .order_by(AIExecutionSpan.created_at.asc())
    ).all()

    return spans