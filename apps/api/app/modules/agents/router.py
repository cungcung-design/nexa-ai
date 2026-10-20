from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.orm import Session
from app.db.models import Agent, AgentVersion, User
from app.db.session import get_db
from app.modules.auth.dependencies import get_current_user
from app.modules.organizations.router import require_membership
from app.modules.billing.usage import check_agent_quota
from app.modules.agents.schemas import (
    AgentCreate,
    AgentUpdate,
    AgentResponse,
    AgentVersionCreate,
    AgentVersionResponse,
)
from app.modules.security.audit import record_audit_event

router = APIRouter(
    prefix="/api/v1/organizations/{organization_id}/agents",
    tags=["Agents"],
)

EDIT_ROLES = {"OWNER", "ADMIN", "DEVELOPER"}
PUBLISH_ROLES = {"OWNER", "ADMIN"}


def require_edit_role(membership) -> None:
    if membership.role.value not in EDIT_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions",
        )


def require_publish_role(membership) -> None:
    if membership.role.value not in PUBLISH_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions",
        )


def _published_version_label(db: Session, agent: Agent) -> str | None:
    """Human readable label of the currently published agent version."""
    if not agent.published_version_id:
        return None
    version = (
        db.query(AgentVersion)
        .filter(AgentVersion.id == agent.published_version_id)
        .first()
    )
    if version is None:
        return None
    return f"v{version.version_number}"


@router.get("", response_model=list[AgentResponse])
def list_agents(
    organization_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_membership(db, current_user.id, organization_id)
    agents = (
        db.query(Agent)
        .filter(Agent.organization_id == organization_id, Agent.is_archived == False)
        .order_by(Agent.created_at.desc())
        .all()
    )
    return agents


@router.post("", response_model=AgentResponse, status_code=status.HTTP_201_CREATED)
def create_agent(
    organization_id: UUID,
    request: AgentCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    membership = require_membership(db, current_user.id, organization_id)
    require_edit_role(membership)
    check_agent_quota(db, organization_id)

    agent = Agent(
        organization_id=organization_id,
        name=request.name,
        description=request.description,
    )
    db.add(agent)
    db.commit()
    db.refresh(agent)

    record_audit_event(
        db,
        organization_id=organization_id,
        actor_user_id=current_user.id,
        action="agent.created",
        resource_type="agent",
        resource_id=agent.id,
        resource_name=agent.name,
        changes={
            "before": {},
            "after": {"name": agent.name, "description": agent.description},
        },
    )
    return agent


@router.get("/{agent_id}", response_model=AgentResponse)
def get_agent(
    organization_id: UUID,
    agent_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_membership(db, current_user.id, organization_id)
    agent = (
        db.query(Agent)
        .filter(Agent.id == agent_id, Agent.organization_id == organization_id)
        .first()
    )
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent not found",
        )
    return agent


@router.patch("/{agent_id}", response_model=AgentResponse)
def update_agent(
    organization_id: UUID,
    agent_id: UUID,
    request: AgentUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    membership = require_membership(db, current_user.id, organization_id)
    require_edit_role(membership)

    agent = (
        db.query(Agent)
        .filter(Agent.id == agent_id, Agent.organization_id == organization_id)
        .first()
    )
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent not found",
        )

    before = {"name": agent.name, "description": agent.description}

    if request.name is not None:
        agent.name = request.name
    if request.description is not None:
        agent.description = request.description

    db.commit()
    db.refresh(agent)

    record_audit_event(
        db,
        organization_id=organization_id,
        actor_user_id=current_user.id,
        action="agent.updated",
        resource_type="agent",
        resource_id=agent.id,
        resource_name=agent.name,
        changes={
            "before": before,
            "after": {"name": agent.name, "description": agent.description},
        },
    )
    return agent


@router.delete("/{agent_id}", status_code=status.HTTP_204_NO_CONTENT)
def archive_agent(
    organization_id: UUID,
    agent_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    membership = require_membership(db, current_user.id, organization_id)
    if membership.role.value not in {"OWNER", "ADMIN"}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Owner or Admin can archive agents",
        )

    agent = (
        db.query(Agent)
        .filter(Agent.id == agent_id, Agent.organization_id == organization_id)
        .first()
    )
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent not found",
        )

    agent.is_archived = True
    db.commit()

    record_audit_event(
        db,
        organization_id=organization_id,
        actor_user_id=current_user.id,
        action="agent.deactivated",
        resource_type="agent",
        resource_id=agent.id,
        resource_name=agent.name,
        changes={
            "before": {"archived": False},
            "after": {"archived": True},
        },
    )


@router.get("/{agent_id}/versions", response_model=list[AgentVersionResponse])
def list_agent_versions(
    organization_id: UUID,
    agent_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_membership(db, current_user.id, organization_id)

    versions = (
        db.query(AgentVersion)
        .filter(AgentVersion.agent_id == agent_id, AgentVersion.organization_id == organization_id)
        .order_by(AgentVersion.version_number.desc())
        .all()
    )
    return versions


@router.post(
    "/{agent_id}/versions", response_model=AgentVersionResponse, status_code=status.HTTP_201_CREATED
)
def create_agent_version(
    organization_id: UUID,
    agent_id: UUID,
    request: AgentVersionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    membership = require_membership(db, current_user.id, organization_id)
    require_edit_role(membership)

    agent = (
        db.query(Agent)
        .filter(Agent.id == agent_id, Agent.organization_id == organization_id)
        .with_for_update()
        .first()
    )
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent not found",
        )

    max_version = (
        db.query(func.max(AgentVersion.version_number))
        .filter(AgentVersion.agent_id == agent_id)
        .scalar()
    ) or 0

    published_label = _published_version_label(db, agent)

    version = AgentVersion(
        organization_id=organization_id,
        agent_id=agent_id,
        version_number=max_version + 1,
        system_prompt=request.system_prompt,
        model=request.model,
        temperature=request.temperature,
        max_tokens=request.max_tokens,
        tools_config=request.tools_config,
    )
    db.add(version)
    db.commit()
    db.refresh(version)

    record_audit_event(
        db,
        organization_id=organization_id,
        actor_user_id=current_user.id,
        action="agent.version_created",
        resource_type="agent_version",
        resource_id=version.id,
        resource_name=f"{agent.name} v{version.version_number}",
        details={"agent_id": str(agent.id)},
        changes={
            "before": {"published_version": published_label},
            "after": {"published_version": published_label},
        },
    )
    return version


@router.post("/{agent_id}/publish/{version_id}", response_model=AgentResponse)
def publish_agent_version(
    organization_id: UUID,
    agent_id: UUID,
    version_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    membership = require_membership(db, current_user.id, organization_id)
    require_publish_role(membership)

    agent = (
        db.query(Agent)
        .filter(Agent.id == agent_id, Agent.organization_id == organization_id)
        .first()
    )
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent not found",
        )

    version = (
        db.query(AgentVersion)
        .filter(
            AgentVersion.id == version_id,
            AgentVersion.agent_id == agent_id,
            AgentVersion.organization_id == organization_id,
        )
        .first()
    )
    if not version:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Version not found",
        )

    before_label = _published_version_label(db, agent)

    agent.published_version_id = version_id
    db.commit()
    db.refresh(agent)

    record_audit_event(
        db,
        organization_id=organization_id,
        actor_user_id=current_user.id,
        action="agent.published",
        resource_type="agent_version",
        resource_id=version.id,
        resource_name=f"{agent.name} v{version.version_number}",
        details={"agent_id": str(agent.id)},
        changes={
            "before": {"published_version": before_label},
            "after": {"published_version": f"v{version.version_number}"},
        },
    )
    return agent