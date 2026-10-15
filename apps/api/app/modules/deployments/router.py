import secrets
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.db.models import Agent, AgentDeployment, Role, User
from app.db.session import get_db
from app.modules.auth.dependencies import get_current_user
from app.modules.organizations.router import require_membership
from app.modules.deployments.schemas import DeploymentCreate, DeploymentResponse

router = APIRouter(
    prefix="/api/v1/organizations/{organization_id}/deployments",
    tags=["Agent Deployments"],
)


@router.post(
    "", response_model=DeploymentResponse, status_code=201
)
def create_deployment(
    organization_id: UUID,
    payload: DeploymentCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_membership(
        db,
        current_user.id,
        organization_id,
        allowed_roles=[Role.OWNER, Role.ADMIN],
    )

    agent = db.scalar(
        select(Agent).where(
            Agent.id == payload.agent_id,
            Agent.organization_id == organization_id,
            Agent.is_archived.is_(False),
        )
    )
    if agent is None:
        raise HTTPException(
            status_code=404, detail="Agent not found or archived"
        )
    if not agent.published_version_id:
        raise HTTPException(
            status_code=400, detail="Agent has no published version"
        )

    public_id = "nexa_" + secrets.token_urlsafe(32)

    deployment = AgentDeployment(
        organization_id=organization_id,
        agent_id=payload.agent_id,
        public_id=public_id,
        name=payload.name,
        allowed_origins=[str(url) for url in payload.allowed_origins],
    )
    db.add(deployment)
    db.commit()
    db.refresh(deployment)

    return DeploymentResponse(
        id=deployment.id,
        agent_id=deployment.agent_id,
        public_id=deployment.public_id,
        name=deployment.name,
        allowed_origins=deployment.allowed_origins,
        is_active=deployment.is_active,
    )


@router.get(
    "", response_model=list[DeploymentResponse]
)
def list_deployments(
    organization_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_membership(db, current_user.id, organization_id)
    deployments = db.scalars(
        select(AgentDeployment)
        .where(AgentDeployment.organization_id == organization_id)
        .order_by(AgentDeployment.created_at.desc())
    ).all()
    return [
        DeploymentResponse(
            id=d.id,
            agent_id=d.agent_id,
            public_id=d.public_id,
            name=d.name,
            allowed_origins=d.allowed_origins,
            is_active=d.is_active,
        )
        for d in deployments
    ]