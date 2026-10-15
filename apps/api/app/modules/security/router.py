from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.ai.runtime import run_agent
from app.db.session import get_db
from app.db.models import Agent
from app.modules.security.dependencies import require_agent_api_key
from app.modules.security.models import OrganizationAPIKey


router = APIRouter(
    prefix="/api/v1/external",
    tags=["External API"],
)


class AgentInvokeRequest(BaseModel):
    message: str = Field(
        min_length=1,
        max_length=4000,
    )


class AgentInvokeResponse(BaseModel):
    answer: str
    agent_id: UUID
    version_id: UUID
    model: str
    prompt_tokens: int | None
    completion_tokens: int | None
    sources: list[dict]


@router.post(
    "/agents/{agent_id}/invoke",
    response_model=AgentInvokeResponse,
)
def invoke_agent(
    agent_id: UUID,
    payload: AgentInvokeRequest,
    db: Session = Depends(get_db),
    api_key_record: OrganizationAPIKey = Depends(require_agent_api_key),
):
    # Verify the agent belongs to the same organization as the API key
    agent = db.scalar(
        select(Agent).where(
            Agent.id == agent_id,
            Agent.organization_id == api_key_record.organization_id,
            Agent.is_archived.is_(False),
        )
    )

    if agent is None:
        raise HTTPException(
            status_code=404,
            detail="Agent not found",
        )

    if agent.published_version_id is None:
        raise HTTPException(
            status_code=400,
            detail="Agent has no published version",
        )

    # Invoke the agent
    result = run_agent(
        db=db,
        organization_id=api_key_record.organization_id,
        agent_id=agent_id,
        message=payload.message,
    )

    return AgentInvokeResponse(
        answer=result["answer"],
        agent_id=result["agent_id"],
        version_id=result["version_id"],
        model=result["model"],
        prompt_tokens=result["prompt_tokens"],
        completion_tokens=result["completion_tokens"],
        sources=result["sources"],
    )