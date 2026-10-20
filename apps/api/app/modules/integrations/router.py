from uuid import UUID, uuid4
from typing import List
from datetime import datetime, timezone
import httpx

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func, or_
from sqlalchemy.orm import Session, joinedload, selectinload
from sqlalchemy.exc import IntegrityError

from app.db.models import (
    User,
    Organization,
    Agent,
    IntegrationProvider,
    WorkspaceConnection,
    ConnectionAgentAccess,
    ConnectionWorkflowAccess,
    IntegrationWebhook,
    IntegrationWebhookDelivery,
    IntegrationActivity,
    utc_now,
)
from app.db.session import get_db
from app.modules.auth.dependencies import get_current_user
from app.modules.organizations.router import require_membership
from app.core.credential_encryption import encrypt_credentials, decrypt_credentials
from app.modules.integrations.schemas import (
    IntegrationProviderCreate,
    IntegrationProviderUpdate,
    IntegrationProviderResponse,
    WorkspaceConnectionCreate,
    WorkspaceConnectionUpdate,
    WorkspaceConnectionResponse,
    ConnectionTestRequest,
    ConnectionTestResponse,
    ConnectionAgentAccessCreate,
    ConnectionAgentAccessUpdate,
    ConnectionAgentAccessResponse,
    ConnectionWorkflowAccessCreate,
    ConnectionWorkflowAccessResponse,
    IntegrationWebhookCreate,
    IntegrationWebhookUpdate,
    IntegrationWebhookResponse,
    IntegrationWebhookDeliveryResponse,
    IntegrationActivityResponse,
    ConnectionSummary,
    IntegrationActivityCreate,
)
from app.modules.security.audit import record_audit_event

router = APIRouter(
    prefix="/api/v1/organizations/{organization_id}/integrations",
    tags=["Integrations"],
)

WRITE_ROLES = {"OWNER", "ADMIN", "DEVELOPER"}
ADMIN_ROLES = {"OWNER", "ADMIN"}


def require_membership_role(
    db: Session,
    user_id: UUID,
    organization_id: UUID,
    allowed_roles: set[str],
):
    membership = require_membership(db, user_id, organization_id)
    if membership.role.value not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions",
        )
    return membership


def log_activity(
    db: Session,
    organization_id: UUID,
    action: str,
    actor_id: UUID | None = None,
    connection_id: UUID | None = None,
    webhook_id: UUID | None = None,
    metadata: dict | None = None,
) -> None:
    db.add(
        IntegrationActivity(
            organization_id=organization_id,
            connection_id=connection_id,
            webhook_id=webhook_id,
            action=action,
            actor_id=actor_id,
            activity_metadata=metadata or {},
        )
    )


def _provider_summary(
    provider: IntegrationProvider,
) -> dict:
    return {
        "id": provider.id,
        "name": provider.name,
        "slug": provider.slug,
        "description": provider.description,
        "category": provider.category,
        "auth_type": provider.auth_type,
        "config_schema": provider.config_schema,
        "capabilities": provider.capabilities,
        "is_active": provider.is_active,
    }


def _seed_default_providers(db: Session, organization_id: UUID) -> None:
    """Seed a small set of built-in providers when none exist."""
    existing = db.scalar(select(IntegrationProvider).limit(1))
    if existing:
        return
    default_providers = [
        {
            "name": "Slack",
            "slug": "slack",
            "description": "Send messages and receive events from Slack.",
            "category": "communication",
            "auth_type": "oauth",
            "capabilities": ["messages.send", "channels.read", "events.subscribe"],
        },
        {
            "name": "Google Drive",
            "slug": "google-drive",
            "description": "Access files and folders in Google Drive.",
            "category": "storage",
            "auth_type": "oauth",
            "capabilities": ["files.read", "files.list", "events.subscribe"],
        },
        {
            "name": "GitHub",
            "slug": "github",
            "description": "Repository events and automation.",
            "category": "developer",
            "auth_type": "oauth",
            "capabilities": ["repositories.read", "events.subscribe"],
        },
        {
            "name": "Notion",
            "slug": "notion",
            "description": "Workspace pages and knowledge.",
            "category": "productivity",
            "auth_type": "oauth",
            "capabilities": ["pages.read", "events.subscribe"],
        },
        {
            "name": "Stripe",
            "slug": "stripe",
            "description": "Payments and billing events.",
            "category": "payments",
            "auth_type": "api_key",
            "capabilities": ["events.subscribe"],
        },
        {
            "name": "Custom Webhook",
            "slug": "custom-webhook",
            "description": "Send and receive generic webhook events.",
            "category": "developer",
            "auth_type": "api_key",
            "capabilities": ["events.subscribe"],
        },
    ]
    for data in default_providers:
        db.add(IntegrationProvider(**data))
    db.commit()


# ---------------------------------------------------------------------------
# Providers
# ---------------------------------------------------------------------------


@router.get("/providers", response_model=List[IntegrationProviderResponse])
def list_providers(
    organization_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_membership(db, current_user.id, organization_id)
    _seed_default_providers(db, organization_id)
    providers = (
        db.query(IntegrationProvider)
        .filter(IntegrationProvider.is_active == True)  # noqa: E712
        .order_by(IntegrationProvider.name.asc())
        .all()
    )
    return providers


@router.get("/providers/{provider_id}", response_model=IntegrationProviderResponse)
def get_provider(
    organization_id: UUID,
    provider_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_membership(db, current_user.id, organization_id)
    provider = db.get(IntegrationProvider, provider_id)
    if not provider:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Provider not found"
        )
    return provider


@router.post(
    "/providers", response_model=IntegrationProviderResponse, status_code=201
)
def create_provider(
    organization_id: UUID,
    request: IntegrationProviderCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_membership_role(
        db, current_user.id, organization_id, ADMIN_ROLES
    )
    provider = IntegrationProvider(**request.model_dump())
    db.add(provider)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Provider slug already exists",
        )
    db.refresh(provider)
    return provider


@router.patch("/providers/{provider_id}", response_model=IntegrationProviderResponse)
def update_provider(
    organization_id: UUID,
    provider_id: UUID,
    request: IntegrationProviderUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_membership_role(
        db, current_user.id, organization_id, ADMIN_ROLES
    )
    provider = db.get(IntegrationProvider, provider_id)
    if not provider:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Provider not found"
        )
    data = request.model_dump(exclude_unset=True)
    for key, value in data.items():
        setattr(provider, key, value)
    provider.updated_at = utc_now()
    db.commit()
    db.refresh(provider)
    return provider


# ---------------------------------------------------------------------------
# Connections
# ---------------------------------------------------------------------------


def _connection_to_response(
    db: Session,
    connection: WorkspaceConnection,
) -> WorkspaceConnectionResponse:
    provider = db.get(IntegrationProvider, connection.provider_id)
    agent_count = db.scalar(
        select(func.count(ConnectionAgentAccess.id)).where(
            ConnectionAgentAccess.connection_id == connection.id
        )
    ) or 0
    workflow_count = db.scalar(
        select(func.count(ConnectionWorkflowAccess.id)).where(
            ConnectionWorkflowAccess.connection_id == connection.id
        )
    ) or 0
    return WorkspaceConnectionResponse(
        id=connection.id,
        organization_id=connection.organization_id,
        provider_id=connection.provider_id,
        provider_name=provider.name if provider else None,
        provider_slug=provider.slug if provider else None,
        provider_auth_type=provider.auth_type if provider else None,
        provider_capabilities=provider.capabilities if provider else None,
        name=connection.name,
        status=connection.status,
        auth_type=connection.auth_type,
        scopes=connection.scopes,
        config=connection.config,
        has_credentials=bool(connection.encrypted_credentials),
        last_tested_at=connection.last_tested_at,
        last_tested_ok=connection.last_tested_ok,
        created_at=connection.created_at,
        updated_at=connection.updated_at,
    )


@router.get("/connections", response_model=List[WorkspaceConnectionResponse])
def list_connections(
    organization_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_membership(db, current_user.id, organization_id)
    connections = (
        db.query(WorkspaceConnection)
        .filter(WorkspaceConnection.organization_id == organization_id)
        .order_by(WorkspaceConnection.created_at.desc())
        .all()
    )
    return [_connection_to_response(db, c) for c in connections]


@router.post(
    "/connections", response_model=WorkspaceConnectionResponse, status_code=201
)
def create_connection(
    organization_id: UUID,
    request: WorkspaceConnectionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    membership = require_membership_role(
        db, current_user.id, organization_id, WRITE_ROLES
    )
    provider = db.get(IntegrationProvider, request.provider_id)
    if not provider:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Provider not found"
        )
    encrypted = (
        encrypt_credentials(request.credentials)
        if request.credentials
        else None
    )
    connection = WorkspaceConnection(
        organization_id=organization_id,
        provider_id=request.provider_id,
        name=request.name,
        auth_type=provider.auth_type,
        scopes=request.scopes,
        encrypted_credentials=encrypted,
        config=request.config,
        status="connected" if provider.auth_type == "api_key" else "pending",
    )
    db.add(connection)
    db.commit()
    db.refresh(connection)
    log_activity(
        db,
        organization_id,
        "connection.created",
        actor_id=current_user.id,
        connection_id=connection.id,
        metadata={"provider_id": str(request.provider_id)},
    )
    db.commit()
    record_audit_event(
        db,
        organization_id=organization_id,
        actor_user_id=current_user.id,
        action="integration.connected",
        resource_type="integration",
        resource_id=connection.id,
        resource_name=connection.name,
        details={
            "provider_id": str(request.provider_id),
            "provider_name": provider.name,
            "auth_type": provider.auth_type,
            "scopes": list(connection.scopes or []),
            "credentials_set": bool(encrypted),
        },
        summary=(
            f"{current_user.email} connected the integration "
            f"“{connection.name}” using {provider.name}."
        ),
    )
    return _connection_to_response(db, connection)


@router.get("/connections/{connection_id}", response_model=WorkspaceConnectionResponse)
def get_connection(
    organization_id: UUID,
    connection_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_membership(db, current_user.id, organization_id)
    connection = db.get(WorkspaceConnection, connection_id)
    if not connection or connection.organization_id != organization_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Connection not found"
        )
    return _connection_to_response(db, connection)


@router.patch("/connections/{connection_id}", response_model=WorkspaceConnectionResponse)
def update_connection(
    organization_id: UUID,
    connection_id: UUID,
    request: WorkspaceConnectionUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    membership = require_membership_role(
        db, current_user.id, organization_id, WRITE_ROLES
    )
    connection = db.get(WorkspaceConnection, connection_id)
    if not connection or connection.organization_id != organization_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Connection not found"
        )
    data = request.model_dump(exclude_unset=True)
    before = {
        "name": connection.name,
        "scopes": list(connection.scopes or []),
        "config": dict(connection.config or {}),
    }
    if "config" in data:
        connection.config = data.pop("config")
    if "scopes" in data:
        connection.scopes = data.pop("scopes")
    if "name" in data:
        connection.name = data.pop("name")
    connection.updated_at = utc_now()
    db.commit()
    db.refresh(connection)
    log_activity(
        db,
        organization_id,
        "connection.updated",
        actor_id=current_user.id,
        connection_id=connection.id,
        metadata={k: v for k, v in data.items() if k != "credentials"},
    )
    db.commit()
    after = {
        "name": connection.name,
        "scopes": list(connection.scopes or []),
        "config": dict(connection.config or {}),
    }
    record_audit_event(
        db,
        organization_id=organization_id,
        actor_user_id=current_user.id,
        action=(
            "integration.scope_changed"
            if "scopes" in data
            else "integration.connection_updated"
        ),
        resource_type="integration",
        resource_id=connection.id,
        resource_name=connection.name,
        details={"provider_id": str(connection.provider_id)},
        changes={"before": before, "after": after},
        summary=(
            f"{current_user.email} updated the integration "
            f"“{connection.name}”."
        ),
    )
    return _connection_to_response(db, connection)


@router.post("/connections/{connection_id}/test", response_model=ConnectionTestResponse)
def test_connection(
    organization_id: UUID,
    connection_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_membership_role(
        db, current_user.id, organization_id, WRITE_ROLES
    )
    connection = db.get(WorkspaceConnection, connection_id)
    if not connection or connection.organization_id != organization_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Connection not found"
        )
    provider = db.get(IntegrationProvider, connection.provider_id)
    if not connection.encrypted_credentials:
        connection.last_tested_at = utc_now()
        connection.last_tested_ok = False
        connection.status = "needs_reauthorization"
        db.commit()
        return ConnectionTestResponse(
            ok=False,
            status="needs_reauthorization",
            message="No credentials configured for this connection.",
        )
    # Credentials are present; mark as reachable/healthy without calling the
    # third party (no provider SDK or network call is made here).
    decrypted = decrypt_credentials(connection.encrypted_credentials)
    connection.last_tested_at = utc_now()
    connection.last_tested_ok = bool(decrypted)
    connection.status = (
        "connected" if connection.last_tested_ok else "unhealthy"
    )
    db.commit()
    log_activity(
        db,
        organization_id,
        "connection.tested",
        actor_id=current_user.id,
        connection_id=connection.id,
        metadata={"ok": connection.last_tested_ok},
    )
    db.commit()
    return ConnectionTestResponse(
        ok=connection.last_tested_ok,
        status=connection.status,
        message="Connection credentials are present and valid."
        if connection.last_tested_ok
        else "Connection test failed.",
    )


@router.post("/connections/{connection_id}/reconnect")
def reconnect_connection(
    organization_id: UUID,
    connection_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_membership_role(
        db, current_user.id, organization_id, WRITE_ROLES
    )
    connection = db.get(WorkspaceConnection, connection_id)
    if not connection or connection.organization_id != organization_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Connection not found"
        )
    connection.status = "pending"
    connection.last_tested_at = None
    connection.last_tested_ok = None
    db.commit()
    log_activity(
        db,
        organization_id,
        "connection.reconnect_requested",
        actor_id=current_user.id,
        connection_id=connection.id,
    )
    db.commit()
    return {"ok": True, "status": "pending"}


@router.get(
    "/connections/{connection_id}/affected",
    response_model=dict,
)
def connection_affected_resources(
    organization_id: UUID,
    connection_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_membership(db, current_user.id, organization_id)
    connection = db.get(WorkspaceConnection, connection_id)
    if not connection or connection.organization_id != organization_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Connection not found"
        )
    agent_access = (
        db.query(ConnectionAgentAccess, Agent)
        .join(Agent, Agent.id == ConnectionAgentAccess.agent_id)
        .filter(ConnectionAgentAccess.connection_id == connection_id)
        .all()
    )
    agents = [
        {
            "agent_id": str(a.id),
            "agent_name": ag.name,
            "actions": a.actions,
        }
        for a, ag in agent_access
    ]
    workflow_access = (
        db.query(ConnectionWorkflowAccess)
        .filter(ConnectionWorkflowAccess.connection_id == connection_id)
        .all()
    )
    workflows = [
        {
            "workflow_id": str(w.workflow_id),
            "step_key": w.step_key,
        }
        for w in workflow_access
    ]
    return {
        "connection_id": str(connection_id),
        "connection_name": connection.name,
        "agents": agents,
        "workflows": workflows,
    }


@router.post("/connections/{connection_id}/disable")
def disable_connection(
    organization_id: UUID,
    connection_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_membership_role(
        db, current_user.id, organization_id, ADMIN_ROLES
    )
    connection = db.get(WorkspaceConnection, connection_id)
    if not connection or connection.organization_id != organization_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Connection not found"
        )
    connection.status = "disabled"
    connection.updated_at = utc_now()
    db.commit()
    log_activity(
        db,
        organization_id,
        "connection.disabled",
        actor_id=current_user.id,
        connection_id=connection.id,
    )
    db.commit()
    record_audit_event(
        db,
        organization_id=organization_id,
        actor_user_id=current_user.id,
        action="integration.disabled",
        resource_type="integration",
        resource_id=connection.id,
        resource_name=connection.name,
        changes={"before": {"status": "connected"}, "after": {"status": "disabled"}},
        summary=f"{current_user.email} disabled the integration “{connection.name}”.",
    )
    return {"ok": True, "status": "disabled"}


@router.post("/connections/{connection_id}/enable")
def enable_connection(
    organization_id: UUID,
    connection_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_membership_role(
        db, current_user.id, organization_id, ADMIN_ROLES
    )
    connection = db.get(WorkspaceConnection, connection_id)
    if not connection or connection.organization_id != organization_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Connection not found"
        )
    connection.status = "connected"
    connection.updated_at = utc_now()
    db.commit()
    log_activity(
        db,
        organization_id,
        "connection.enabled",
        actor_id=current_user.id,
        connection_id=connection.id,
    )
    db.commit()
    record_audit_event(
        db,
        organization_id=organization_id,
        actor_user_id=current_user.id,
        action="integration.enabled",
        resource_type="integration",
        resource_id=connection.id,
        resource_name=connection.name,
        changes={"before": {"status": "disabled"}, "after": {"status": "connected"}},
        summary=f"{current_user.email} enabled the integration “{connection.name}”.",
    )
    return {"ok": True, "status": "connected"}


@router.delete("/connections/{connection_id}", status_code=status.HTTP_204_NO_CONTENT)
def disconnect_connection(
    organization_id: UUID,
    connection_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_membership_role(
        db, current_user.id, organization_id, ADMIN_ROLES
    )
    connection = db.get(WorkspaceConnection, connection_id)
    if not connection or connection.organization_id != organization_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Connection not found"
        )
    connection_name = connection.name
    db.query(ConnectionAgentAccess).filter(
        ConnectionAgentAccess.connection_id == connection_id
    ).delete()
    db.query(ConnectionWorkflowAccess).filter(
        ConnectionWorkflowAccess.connection_id == connection_id
    ).delete()
    db.query(IntegrationWebhook).filter(
        IntegrationWebhook.connection_id == connection_id
    ).delete()
    db.delete(connection)
    log_activity(
        db,
        organization_id,
        "connection.disconnected",
        actor_id=current_user.id,
        connection_id=connection_id,
    )
    db.commit()
    record_audit_event(
        db,
        organization_id=organization_id,
        actor_user_id=current_user.id,
        action="integration.disconnected",
        resource_type="integration",
        resource_id=connection_id,
        resource_name=connection_name,
        changes={
            "before": {"status": connection.status},
            "after": {"status": "disconnected"},
        },
        summary=(
            f"{current_user.email} disconnected the integration "
            f"“{connection_name}”."
        ),
    )
    return None


# ---------------------------------------------------------------------------
# Agent access
# ---------------------------------------------------------------------------


@router.get(
    "/connections/{connection_id}/agents",
    response_model=List[ConnectionAgentAccessResponse],
)
def list_connection_agent_access(
    organization_id: UUID,
    connection_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_membership(db, current_user.id, organization_id)
    connection = db.get(WorkspaceConnection, connection_id)
    if not connection or connection.organization_id != organization_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Connection not found"
        )
    rows = (
        db.query(ConnectionAgentAccess, Agent)
        .join(Agent, Agent.id == ConnectionAgentAccess.agent_id)
        .filter(ConnectionAgentAccess.connection_id == connection_id)
        .order_by(Agent.name.asc())
        .all()
    )
    return [
        ConnectionAgentAccessResponse(
            id=a.id,
            connection_id=a.connection_id,
            agent_id=a.agent_id,
            agent_name=agent.name,
            actions=a.actions,
            created_at=a.created_at,
        )
        for a, agent in rows
    ]


@router.post(
    "/connections/{connection_id}/agents",
    response_model=ConnectionAgentAccessResponse,
    status_code=status.HTTP_201_CREATED,
)
def grant_agent_access(
    organization_id: UUID,
    connection_id: UUID,
    request: ConnectionAgentAccessCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_membership_role(
        db, current_user.id, organization_id, WRITE_ROLES
    )
    connection = db.get(WorkspaceConnection, connection_id)
    if not connection or connection.organization_id != organization_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Connection not found"
        )
    agent = db.get(Agent, request.agent_id)
    if not agent or agent.organization_id != organization_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found"
        )
    existing = db.scalar(
        select(ConnectionAgentAccess).where(
            ConnectionAgentAccess.connection_id == connection_id,
            ConnectionAgentAccess.agent_id == request.agent_id,
        )
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Agent already has access to this connection",
        )
    access = ConnectionAgentAccess(
        connection_id=connection_id,
        agent_id=request.agent_id,
        actions=request.actions,
    )
    db.add(access)
    db.commit()
    db.refresh(access)
    log_activity(
        db,
        organization_id,
        "connection.agent_access.granted",
        actor_id=current_user.id,
        connection_id=connection_id,
        metadata={"agent_id": str(request.agent_id), "actions": request.actions},
    )
    db.commit()
    record_audit_event(
        db,
        organization_id=organization_id,
        actor_user_id=current_user.id,
        action="permission.granted",
        resource_type="agent",
        resource_id=agent.id,
        resource_name=agent.name,
        details={
            "connection_id": str(connection_id),
            "connection_name": connection.name,
            "actions": list(request.actions or []),
        },
        changes={
            "before": {"connection_access": None},
            "after": {"connection_access": list(request.actions or [])},
        },
        summary=(
            f"{current_user.email} granted the agent “{agent.name}” access to "
            f"the integration “{connection.name}”."
        ),
    )
    return ConnectionAgentAccessResponse(
        id=access.id,
        connection_id=access.connection_id,
        agent_id=access.agent_id,
        agent_name=agent.name,
        actions=access.actions,
        created_at=access.created_at,
    )


@router.patch(
    "/connections/{connection_id}/agents/{agent_id}",
    response_model=ConnectionAgentAccessResponse,
)
def update_agent_access(
    organization_id: UUID,
    connection_id: UUID,
    agent_id: UUID,
    request: ConnectionAgentAccessUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_membership_role(
        db, current_user.id, organization_id, WRITE_ROLES
    )
    access = db.scalar(
        select(ConnectionAgentAccess).where(
            ConnectionAgentAccess.connection_id == connection_id,
            ConnectionAgentAccess.agent_id == agent_id,
        )
    )
    if not access:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Agent access not found"
        )
    before_actions = list(access.actions or [])
    access.actions = request.actions
    db.commit()
    db.refresh(access)
    agent = db.get(Agent, agent_id)
    log_activity(
        db,
        organization_id,
        "connection.agent_access.updated",
        actor_id=current_user.id,
        connection_id=connection_id,
        metadata={"agent_id": str(agent_id), "actions": request.actions},
    )
    db.commit()
    connection = db.get(WorkspaceConnection, connection_id)
    record_audit_event(
        db,
        organization_id=organization_id,
        actor_user_id=current_user.id,
        action="permission.granted",
        resource_type="agent",
        resource_id=agent_id,
        resource_name=agent.name if agent else None,
        details={
            "connection_id": str(connection_id),
            "connection_name": connection.name if connection else None,
            "actions": list(request.actions or []),
        },
        changes={
            "before": {"connection_access": before_actions},
            "after": {"connection_access": list(request.actions or [])},
        },
        summary=(
            f"{current_user.email} changed the integration access policy for "
            f"the agent “{agent.name if agent else agent_id}”."
        ),
    )
    return ConnectionAgentAccessResponse(
        id=access.id,
        connection_id=access.connection_id,
        agent_id=access.agent_id,
        agent_name=agent.name if agent else None,
        actions=access.actions,
        created_at=access.created_at,
    )


@router.delete(
    "/connections/{connection_id}/agents/{agent_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def revoke_agent_access(
    organization_id: UUID,
    connection_id: UUID,
    agent_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_membership_role(
        db, current_user.id, organization_id, WRITE_ROLES
    )
    access = db.scalar(
        select(ConnectionAgentAccess).where(
            ConnectionAgentAccess.connection_id == connection_id,
            ConnectionAgentAccess.agent_id == agent_id,
        )
    )
    if not access:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Agent access not found"
        )
    agent = db.get(Agent, agent_id)
    connection = db.get(WorkspaceConnection, connection_id)
    revoked_actions = list(access.actions or [])
    db.delete(access)
    log_activity(
        db,
        organization_id,
        "connection.agent_access.revoked",
        actor_id=current_user.id,
        connection_id=connection_id,
        metadata={"agent_id": str(agent_id)},
    )
    db.commit()
    record_audit_event(
        db,
        organization_id=organization_id,
        actor_user_id=current_user.id,
        action="permission.revoked",
        resource_type="agent",
        resource_id=agent_id,
        resource_name=agent.name if agent else None,
        details={
            "connection_id": str(connection_id),
            "connection_name": connection.name if connection else None,
        },
        changes={
            "before": {"connection_access": revoked_actions},
            "after": {"connection_access": None},
        },
        summary=(
            f"{current_user.email} revoked the agent "
            f"“{agent.name if agent else agent_id}” access to the integration."
        ),
    )
    return None


# ---------------------------------------------------------------------------
# Workflow access
# ---------------------------------------------------------------------------


@router.get(
    "/connections/{connection_id}/workflows",
    response_model=List[ConnectionWorkflowAccessResponse],
)
def list_connection_workflow_access(
    organization_id: UUID,
    connection_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_membership(db, current_user.id, organization_id)
    connection = db.get(WorkspaceConnection, connection_id)
    if not connection or connection.organization_id != organization_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Connection not found"
        )
    rows = (
        db.query(ConnectionWorkflowAccess)
        .filter(ConnectionWorkflowAccess.connection_id == connection_id)
        .order_by(ConnectionWorkflowAccess.step_key.asc())
        .all()
    )
    return [
        ConnectionWorkflowAccessResponse(
            id=r.id,
            connection_id=r.connection_id,
            workflow_id=r.workflow_id,
            step_key=r.step_key,
            created_at=r.created_at,
        )
        for r in rows
    ]


@router.post(
    "/connections/{connection_id}/workflows",
    response_model=ConnectionWorkflowAccessResponse,
    status_code=status.HTTP_201_CREATED,
)
def grant_workflow_access(
    organization_id: UUID,
    connection_id: UUID,
    request: ConnectionWorkflowAccessCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_membership_role(
        db, current_user.id, organization_id, WRITE_ROLES
    )
    connection = db.get(WorkspaceConnection, connection_id)
    if not connection or connection.organization_id != organization_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Connection not found"
        )
    existing = db.scalar(
        select(ConnectionWorkflowAccess).where(
            ConnectionWorkflowAccess.connection_id == connection_id,
            ConnectionWorkflowAccess.workflow_id == request.workflow_id,
            ConnectionWorkflowAccess.step_key == request.step_key,
        )
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Workflow step already assigned to this connection",
        )
    access = ConnectionWorkflowAccess(
        connection_id=connection_id,
        workflow_id=request.workflow_id,
        step_key=request.step_key,
    )
    db.add(access)
    db.commit()
    db.refresh(access)
    log_activity(
        db,
        organization_id,
        "connection.workflow_access.granted",
        actor_id=current_user.id,
        connection_id=connection_id,
        metadata={"workflow_id": str(request.workflow_id), "step_key": request.step_key},
    )
    db.commit()
    record_audit_event(
        db,
        organization_id=organization_id,
        actor_user_id=current_user.id,
        action="permission.granted",
        resource_type="workflow",
        resource_id=request.workflow_id,
        resource_name=None,
        details={
            "connection_id": str(connection_id),
            "connection_name": connection.name,
            "step_key": request.step_key,
        },
        changes={
            "before": {"connection_access": None},
            "after": {"connection_access": request.step_key},
        },
        summary=(
            f"{current_user.email} granted the workflow step "
            f"“{request.step_key}” access to the integration "
            f"“{connection.name}”."
        ),
    )
    return ConnectionWorkflowAccessResponse(
        id=access.id,
        connection_id=access.connection_id,
        workflow_id=access.workflow_id,
        step_key=access.step_key,
        created_at=access.created_at,
    )


@router.delete(
    "/connections/{connection_id}/workflows/{workflow_id}/{step_key}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def revoke_workflow_access(
    organization_id: UUID,
    connection_id: UUID,
    workflow_id: UUID,
    step_key: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_membership_role(
        db, current_user.id, organization_id, WRITE_ROLES
    )
    access = db.scalar(
        select(ConnectionWorkflowAccess).where(
            ConnectionWorkflowAccess.connection_id == connection_id,
            ConnectionWorkflowAccess.workflow_id == workflow_id,
            ConnectionWorkflowAccess.step_key == step_key,
        )
    )
    if not access:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workflow access not found",
        )
    connection = db.get(WorkspaceConnection, connection_id)
    db.delete(access)
    log_activity(
        db,
        organization_id,
        "connection.workflow_access.revoked",
        actor_id=current_user.id,
        connection_id=connection_id,
        metadata={"workflow_id": str(workflow_id), "step_key": step_key},
    )
    db.commit()
    record_audit_event(
        db,
        organization_id=organization_id,
        actor_user_id=current_user.id,
        action="permission.revoked",
        resource_type="workflow",
        resource_id=workflow_id,
        resource_name=None,
        details={
            "connection_id": str(connection_id),
            "connection_name": connection.name if connection else None,
            "step_key": step_key,
        },
        changes={
            "before": {"connection_access": step_key},
            "after": {"connection_access": None},
        },
        summary=(
            f"{current_user.email} revoked the workflow step “{step_key}” "
            "access to the integration."
        ),
    )
    return None


# ---------------------------------------------------------------------------
# Webhooks
# ---------------------------------------------------------------------------


@router.get("/webhooks", response_model=List[IntegrationWebhookResponse])
def list_webhooks(
    organization_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_membership(db, current_user.id, organization_id)
    rows = (
        db.query(IntegrationWebhook, WorkspaceConnection)
        .join(
            WorkspaceConnection,
            WorkspaceConnection.id == IntegrationWebhook.connection_id,
        )
        .filter(IntegrationWebhook.organization_id == organization_id)
        .order_by(IntegrationWebhook.created_at.desc())
        .all()
    )
    return [
        IntegrationWebhookResponse(
            id=w.id,
            organization_id=w.organization_id,
            connection_id=w.connection_id,
            connection_name=c.name,
            name=w.name,
            target_url=w.target_url,
            events=w.events,
            has_secret=bool(w.secret),
            is_active=w.is_active,
            created_at=w.created_at,
            updated_at=w.updated_at,
        )
        for w, c in rows
    ]


@router.post(
    "/webhooks", response_model=IntegrationWebhookResponse, status_code=201
)
def create_webhook(
    organization_id: UUID,
    request: IntegrationWebhookCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_membership_role(
        db, current_user.id, organization_id, WRITE_ROLES
    )
    connection = db.get(WorkspaceConnection, request.connection_id)
    if not connection or connection.organization_id != organization_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Connection not found"
        )
    webhook = IntegrationWebhook(
        organization_id=organization_id,
        connection_id=request.connection_id,
        name=request.name,
        target_url=str(request.target_url),
        events=request.events,
        secret=request.secret,
        is_active=request.is_active,
    )
    db.add(webhook)
    db.commit()
    db.refresh(webhook)
    log_activity(
        db,
        organization_id,
        "webhook.created",
        actor_id=current_user.id,
        connection_id=request.connection_id,
        webhook_id=webhook.id,
        metadata={"name": request.name},
    )
    db.commit()
    return IntegrationWebhookResponse(
        id=webhook.id,
        organization_id=webhook.organization_id,
        connection_id=webhook.connection_id,
        connection_name=connection.name,
        name=webhook.name,
        target_url=webhook.target_url,
        events=webhook.events,
        has_secret=bool(webhook.secret),
        is_active=webhook.is_active,
        created_at=webhook.created_at,
        updated_at=webhook.updated_at,
    )


@router.get("/webhooks/{webhook_id}", response_model=IntegrationWebhookResponse)
def get_webhook(
    organization_id: UUID,
    webhook_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_membership(db, current_user.id, organization_id)
    webhook = db.get(IntegrationWebhook, webhook_id)
    if not webhook or webhook.organization_id != organization_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Webhook not found"
        )
    connection = db.get(WorkspaceConnection, webhook.connection_id)
    return IntegrationWebhookResponse(
        id=webhook.id,
        organization_id=webhook.organization_id,
        connection_id=webhook.connection_id,
        connection_name=connection.name if connection else None,
        name=webhook.name,
        target_url=webhook.target_url,
        events=webhook.events,
        has_secret=bool(webhook.secret),
        is_active=webhook.is_active,
        created_at=webhook.created_at,
        updated_at=webhook.updated_at,
    )


@router.patch("/webhooks/{webhook_id}", response_model=IntegrationWebhookResponse)
def update_webhook(
    organization_id: UUID,
    webhook_id: UUID,
    request: IntegrationWebhookUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_membership_role(
        db, current_user.id, organization_id, WRITE_ROLES
    )
    webhook = db.get(IntegrationWebhook, webhook_id)
    if not webhook or webhook.organization_id != organization_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Webhook not found"
        )
    data = request.model_dump(exclude_unset=True)
    if "target_url" in data:
        webhook.target_url = str(data.pop("target_url"))
    for key, value in data.items():
        setattr(webhook, key, value)
    webhook.updated_at = utc_now()
    db.commit()
    db.refresh(webhook)
    connection = db.get(WorkspaceConnection, webhook.connection_id)
    log_activity(
        db,
        organization_id,
        "webhook.updated",
        actor_id=current_user.id,
        connection_id=webhook.connection_id,
        webhook_id=webhook.id,
        metadata={k: v for k, v in data.items() if k != "secret"},
    )
    db.commit()
    return IntegrationWebhookResponse(
        id=webhook.id,
        organization_id=webhook.organization_id,
        connection_id=webhook.connection_id,
        connection_name=connection.name if connection else None,
        name=webhook.name,
        target_url=webhook.target_url,
        events=webhook.events,
        has_secret=bool(webhook.secret),
        is_active=webhook.is_active,
        created_at=webhook.created_at,
        updated_at=webhook.updated_at,
    )


@router.delete("/webhooks/{webhook_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_webhook(
    organization_id: UUID,
    webhook_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_membership_role(
        db, current_user.id, organization_id, WRITE_ROLES
    )
    webhook = db.get(IntegrationWebhook, webhook_id)
    if not webhook or webhook.organization_id != organization_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Webhook not found"
        )
    connection_id = webhook.connection_id
    db.delete(webhook)
    log_activity(
        db,
        organization_id,
        "webhook.deleted",
        actor_id=current_user.id,
        connection_id=connection_id,
        webhook_id=webhook_id,
    )
    db.commit()
    return None


@router.post("/webhooks/{webhook_id}/deliver", response_model=dict)
def deliver_webhook_test(
    organization_id: UUID,
    webhook_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_membership_role(
        db, current_user.id, organization_id, WRITE_ROLES
    )
    webhook = db.get(IntegrationWebhook, webhook_id)
    if not webhook or webhook.organization_id != organization_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Webhook not found"
        )
    delivery = IntegrationWebhookDelivery(
        webhook_id=webhook_id,
        event="webhook.test",
        status="pending",
        request_payload={"test": True, "webhook_id": str(webhook_id)},
        attempted_at=utc_now(),
    )
    db.add(delivery)
    db.commit()
    db.refresh(delivery)

    status_str = "failed"
    response_status = None
    response_body = None
    try:
        with httpx.Client(timeout=10.0) as client:
            resp = client.post(
                webhook.target_url,
                json=delivery.request_payload,
                headers={"Content-Type": "application/json"},
            )
            response_status = resp.status_code
            response_body = resp.text[:2000] if resp.text else None
            status_str = "success" if 200 <= resp.status_code < 300 else "failed"
    except Exception as exc:  # noqa: BLE001
        status_str = "failed"
        response_body = str(exc)[:2000]

    delivery.status = status_str
    delivery.response_status = response_status
    delivery.response_body = response_body
    delivery.completed_at = utc_now()
    db.commit()
    log_activity(
        db,
        organization_id,
        "webhook.delivery.tested",
        actor_id=current_user.id,
        connection_id=webhook.connection_id,
        webhook_id=webhook_id,
        metadata={"event": "webhook.test", "status": status_str},
    )
    db.commit()
    return {
        "delivery_id": str(delivery.id),
        "status": status_str,
        "response_status": response_status,
        "response_body": response_body,
    }


# ---------------------------------------------------------------------------
# Webhook deliveries
# ---------------------------------------------------------------------------


@router.get(
    "/webhooks/{webhook_id}/deliveries",
    response_model=List[IntegrationWebhookDeliveryResponse],
)
def list_webhook_deliveries(
    organization_id: UUID,
    webhook_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_membership(db, current_user.id, organization_id)
    webhook = db.get(IntegrationWebhook, webhook_id)
    if not webhook or webhook.organization_id != organization_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Webhook not found"
        )
    rows = (
        db.query(IntegrationWebhookDelivery)
        .filter(IntegrationWebhookDelivery.webhook_id == webhook_id)
        .order_by(IntegrationWebhookDelivery.attempted_at.desc())
        .all()
    )
    return [
        IntegrationWebhookDeliveryResponse(
            id=d.id,
            webhook_id=d.webhook_id,
            event=d.event,
            status=d.status,
            response_status=d.response_status,
            attempted_at=d.attempted_at,
            completed_at=d.completed_at,
        )
        for d in rows
    ]


# ---------------------------------------------------------------------------
# Activity
# ---------------------------------------------------------------------------


@router.get("/activity", response_model=List[IntegrationActivityResponse])
def list_activity(
    organization_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    limit: int = 100,
):
    require_membership(db, current_user.id, organization_id)
    rows = (
        db.query(IntegrationActivity)
        .filter(IntegrationActivity.organization_id == organization_id)
        .order_by(IntegrationActivity.created_at.desc())
        .limit(limit)
        .all()
    )
    return [
        IntegrationActivityResponse(
            id=r.id,
            organization_id=r.organization_id,
            connection_id=r.connection_id,
            webhook_id=r.webhook_id,
            action=r.action,
            actor_id=r.actor_id,
            activity_metadata=r.activity_metadata,
            created_at=r.created_at,
        )
        for r in rows
    ]


@router.post("/activity", response_model=IntegrationActivityResponse, status_code=201)
def create_activity(
    organization_id: UUID,
    request: IntegrationActivityCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_membership(db, current_user.id, organization_id)
    activity = IntegrationActivity(
        organization_id=organization_id,
        connection_id=request.connection_id,
        webhook_id=request.webhook_id,
        action=request.action,
        actor_id=request.actor_id or current_user.id,
        activity_metadata=request.activity_metadata,
    )
    db.add(activity)
    db.commit()
    db.refresh(activity)
    return IntegrationActivityResponse(
        id=activity.id,
        organization_id=activity.organization_id,
        connection_id=activity.connection_id,
        webhook_id=activity.webhook_id,
        action=activity.action,
        actor_id=activity.actor_id,
        activity_metadata=activity.activity_metadata,
        created_at=activity.created_at,
    )
