from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import Agent, AgentVersion
from app.db.session import get_db
from app.modules.analytics.models import (
    AIRequestTrace,
    AIExecutionSpan,
)
from app.modules.analytics.tracing import public_span_detail
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
    agent_name: str | None = None
    agent_version_id: UUID | None = None
    version_number: int | None = None
    model: str | None = None
    status: str
    error_code: str | None = None
    latency_ms: int
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int
    created_at: datetime


class SpanResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    trace_id: UUID
    name: str
    duration_ms: int
    status: str
    error_code: str | None = None
    detail: dict | None = None
    created_at: datetime


def _trace_response(
    trace: AIRequestTrace,
    agents: dict[UUID, Agent],
    versions: dict[UUID, AgentVersion],
) -> TraceResponse:
    agent = agents.get(trace.agent_id)
    version = (
        versions.get(trace.agent_version_id) if trace.agent_version_id else None
    )
    return TraceResponse(
        id=trace.id,
        organization_id=trace.organization_id,
        agent_id=trace.agent_id,
        agent_name=agent.name if agent else None,
        agent_version_id=trace.agent_version_id,
        version_number=version.version_number if version else None,
        model=trace.model,
        status=trace.status,
        error_code=trace.error_code,
        latency_ms=trace.latency_ms,
        prompt_tokens=trace.prompt_tokens,
        completion_tokens=trace.completion_tokens,
        total_tokens=trace.prompt_tokens + trace.completion_tokens,
        created_at=trace.created_at,
    )


def _load_names(
    db: Session,
    organization_id: UUID,
    traces: list[AIRequestTrace],
) -> tuple[dict[UUID, Agent], dict[UUID, AgentVersion]]:
    agent_ids = {trace.agent_id for trace in traces}
    version_ids = {
        trace.agent_version_id
        for trace in traces
        if trace.agent_version_id is not None
    }
    agents = {}
    if agent_ids:
        rows = db.scalars(
            select(Agent).where(
                Agent.organization_id == organization_id,
                Agent.id.in_(agent_ids),
            )
        ).all()
        agents = {row.id: row for row in rows}
    versions = {}
    if version_ids:
        rows = db.scalars(
            select(AgentVersion).where(
                AgentVersion.organization_id == organization_id,
                AgentVersion.id.in_(version_ids),
            )
        ).all()
        versions = {row.id: row for row in rows}
    return agents, versions


def _span_response(span: AIExecutionSpan) -> SpanResponse:
    return SpanResponse(
        id=span.id,
        trace_id=span.trace_id,
        name=span.name,
        duration_ms=span.duration_ms,
        status=span.status,
        error_code=span.error_code,
        detail=public_span_detail(span.detail),
        created_at=span.created_at,
    )


def _find_trace(
    db: Session,
    organization_id: UUID,
    trace_id: UUID,
) -> AIRequestTrace:
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
    return trace


@router.get(
    "/traces",
    response_model=list[TraceResponse],
)
def get_traces(
    organization_id: UUID,
    db: Session = Depends(get_db),
    membership=Depends(require_permission(Permission.ANALYTICS_READ)),
    days: int = Query(default=30, ge=0, le=366),
    status_filter: str | None = Query(default=None, alias="status", max_length=20),
    agent_id: UUID | None = None,
):
    """List persisted request traces for one workspace."""
    del membership
    statement = select(AIRequestTrace).where(
        AIRequestTrace.organization_id == organization_id
    )
    if days > 0:
        start = datetime.now(timezone.utc) - timedelta(days=days)
        statement = statement.where(AIRequestTrace.created_at >= start)
    if status_filter:
        statement = statement.where(AIRequestTrace.status == status_filter)
    if agent_id is not None:
        statement = statement.where(AIRequestTrace.agent_id == agent_id)
    traces = db.scalars(
        statement.order_by(AIRequestTrace.created_at.desc()).limit(500)
    ).all()
    agents, versions = _load_names(db, organization_id, list(traces))
    return [_trace_response(trace, agents, versions) for trace in traces]


@router.get(
    "/traces/{trace_id}",
    response_model=TraceResponse,
)
def get_trace(
    organization_id: UUID,
    trace_id: UUID,
    db: Session = Depends(get_db),
    membership=Depends(require_permission(Permission.ANALYTICS_READ)),
):
    """Return one persisted trace when it belongs to this workspace."""
    del membership
    trace = _find_trace(db, organization_id, trace_id)
    agents, versions = _load_names(db, organization_id, [trace])
    return _trace_response(trace, agents, versions)


@router.get(
    "/traces/{trace_id}/spans",
    response_model=list[SpanResponse],
)
def get_trace_spans(
    organization_id: UUID,
    trace_id: UUID,
    db: Session = Depends(get_db),
    membership=Depends(require_permission(Permission.ANALYTICS_READ)),
):
    """Return the spans recorded for one workspace trace."""
    del membership
    _find_trace(db, organization_id, trace_id)
    spans = db.scalars(
        select(AIExecutionSpan)
        .where(
            AIExecutionSpan.trace_id == trace_id,
            AIExecutionSpan.organization_id == organization_id,
        )
        .order_by(AIExecutionSpan.created_at.asc())
    ).all()
    return [_span_response(span) for span in spans]