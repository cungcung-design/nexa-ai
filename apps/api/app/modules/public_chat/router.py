from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.ai.public_runtime import run_public_agent
from app.db.models import AgentDeployment
from app.db.session import get_db
from app.modules.public_chat.schemas import PublicChatRequest, PublicChatResponse

router = APIRouter(
    prefix="/api/v1/public",
    tags=["Public Chat"],
)


class DeploymentConfigResponse(BaseModel):
    name: str
    allowed_origins: list[str]


def validate_origin(origin: str, allowed_origins: list[str]) -> bool:
    if not origin:
        return False
    return origin in allowed_origins


@router.get(
    "/deployments/{public_id}/config",
    response_model=DeploymentConfigResponse,
)
def get_deployment_config(
    public_id: str,
    db: Session = Depends(get_db),
):
    deployment = db.scalar(
        select(AgentDeployment).where(
            AgentDeployment.public_id == public_id,
            AgentDeployment.is_active.is_(True),
        )
    )
    if deployment is None:
        raise HTTPException(status_code=404, detail="Deployment not found")

    return DeploymentConfigResponse(
        name=deployment.name,
        allowed_origins=deployment.allowed_origins,
    )


@router.post(
    "/deployments/{public_id}/chat",
    response_model=PublicChatResponse,
)
def public_chat(
    public_id: str,
    payload: PublicChatRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    deployment = db.scalar(
        select(AgentDeployment).where(
            AgentDeployment.public_id == public_id,
            AgentDeployment.is_active.is_(True),
        )
    )
    if deployment is None:
        raise HTTPException(status_code=404, detail="Deployment not found")

    origin = request.headers.get("origin", "")
    if not validate_origin(origin, deployment.allowed_origins):
        raise HTTPException(status_code=403, detail="Origin not allowed")

    try:
        result = run_public_agent(
            db=db,
            organization_id=deployment.organization_id,
            agent_id=deployment.agent_id,
            message=payload.message,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    return PublicChatResponse(
        answer=result["answer"],
        model=result["model"],
    )