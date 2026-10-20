from typing import Literal
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict, HttpUrl


ConnectionStatus = Literal[
    "pending", "connected", "needs_reauthorization", "unhealthy", "disabled"
]


class IntegrationProviderBase(BaseModel):
    name: str = Field(min_length=2, max_length=150)
    slug: str = Field(min_length=3, max_length=150)
    description: str = Field(default="", max_length=1000)
    category: str = Field(default="other", max_length=50)
    auth_type: str = Field(default="api_key", max_length=20)
    config_schema: dict = Field(default_factory=dict)
    capabilities: list[str] = Field(default_factory=list)
    is_active: bool = True


class IntegrationProviderCreate(IntegrationProviderBase):
    pass


class IntegrationProviderUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=150)
    description: str | None = Field(default=None, max_length=1000)
    category: str | None = Field(default=None, max_length=50)
    auth_type: str | None = Field(default=None, max_length=20)
    config_schema: dict | None = None
    capabilities: list[str] | None = None
    is_active: bool | None = None


class IntegrationProviderResponse(IntegrationProviderBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    created_at: datetime
    updated_at: datetime


class WorkspaceConnectionBase(BaseModel):
    provider_id: UUID
    name: str = Field(min_length=2, max_length=150)
    config: dict = Field(default_factory=dict)


class WorkspaceConnectionCreate(WorkspaceConnectionBase):
    # Plaintext credentials provided by the client; encrypted at rest.
    credentials: dict | None = Field(default_factory=dict)
    scopes: list[str] = Field(default_factory=list)


class WorkspaceConnectionUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=150)
    config: dict | None = None
    scopes: list[str] | None = None


class WorkspaceConnectionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    organization_id: UUID
    provider_id: UUID
    provider_name: str | None = None
    provider_slug: str | None = None
    provider_auth_type: str | None = None
    provider_capabilities: list[str] | None = None
    name: str
    status: str
    auth_type: str
    scopes: list[str]
    config: dict
    has_credentials: bool
    last_tested_at: datetime | None = None
    last_tested_ok: bool | None = None
    created_at: datetime
    updated_at: datetime


class ConnectionTestRequest(BaseModel):
    pass


class ConnectionTestResponse(BaseModel):
    ok: bool
    status: str
    message: str | None = None


class ConnectionAgentAccessBase(BaseModel):
    agent_id: UUID
    actions: list[str] = Field(default_factory=list)


class ConnectionAgentAccessCreate(ConnectionAgentAccessBase):
    pass


class ConnectionAgentAccessUpdate(BaseModel):
    actions: list[str] = Field(default_factory=list)


class ConnectionAgentAccessResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    connection_id: UUID
    agent_id: UUID
    agent_name: str | None = None
    actions: list[str]
    created_at: datetime


class ConnectionWorkflowAccessBase(BaseModel):
    workflow_id: UUID
    step_key: str = Field(min_length=1, max_length=100)


class ConnectionWorkflowAccessCreate(ConnectionWorkflowAccessBase):
    pass


class ConnectionWorkflowAccessResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    connection_id: UUID
    workflow_id: UUID
    step_key: str
    created_at: datetime


class IntegrationWebhookBase(BaseModel):
    connection_id: UUID
    name: str = Field(min_length=2, max_length=150)
    target_url: HttpUrl
    events: list[str] = Field(default_factory=list)
    is_active: bool = True


class IntegrationWebhookCreate(IntegrationWebhookBase):
    secret: str | None = None


class IntegrationWebhookUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=150)
    target_url: HttpUrl | None = None
    events: list[str] | None = None
    secret: str | None = None
    is_active: bool | None = None


class IntegrationWebhookResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    organization_id: UUID
    connection_id: UUID
    connection_name: str | None = None
    name: str
    target_url: str
    events: list[str]
    has_secret: bool
    is_active: bool
    created_at: datetime
    updated_at: datetime


class IntegrationWebhookDeliveryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    webhook_id: UUID
    event: str
    status: str
    response_status: int | None = None
    attempted_at: datetime
    completed_at: datetime | None = None


class IntegrationActivityResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    organization_id: UUID
    connection_id: UUID | None = None
    webhook_id: UUID | None = None
    action: str
    actor_id: UUID | None = None
    activity_metadata: dict
    created_at: datetime


class ConnectionSummary(BaseModel):
    id: UUID
    name: str
    provider_name: str | None = None
    provider_slug: str | None = None
    status: str
    auth_type: str
    has_credentials: bool
    agent_count: int
    workflow_count: int
    last_tested_at: datetime | None = None
    last_tested_ok: bool | None = None


class IntegrationActivityCreate(BaseModel):
    action: str
    connection_id: UUID | None = None
    webhook_id: UUID | None = None
    actor_id: UUID | None = None
    activity_metadata: dict = Field(default_factory=dict)
