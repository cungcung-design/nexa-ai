"""Request and response schemas for the settings module."""

from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class NotificationPreferences(BaseModel):
    approvals: bool
    workflow_failures: bool
    agent_alerts: bool
    security_alerts: bool
    billing_updates: bool
    email_channel: bool
    in_app_channel: bool


class PersonalSettingsResponse(BaseModel):
    email: str
    full_name: str
    job_title: str
    language: str
    appearance: str
    timezone: str
    notifications: NotificationPreferences
    mandatory_notifications: list[str]
    supported: dict


class PersonalSettingsUpdate(BaseModel):
    full_name: str | None = Field(default=None, max_length=150)
    job_title: str | None = Field(default=None, max_length=150)
    language: str | None = Field(default=None, max_length=20)
    appearance: str | None = Field(default=None, max_length=20)
    timezone: str | None = Field(default=None, max_length=64)


class NotificationPreferencesUpdate(BaseModel):
    approvals: bool | None = None
    workflow_failures: bool | None = None
    agent_alerts: bool | None = None
    security_alerts: bool | None = None
    billing_updates: bool | None = None
    email_channel: bool | None = None
    in_app_channel: bool | None = None


class PasswordChangeRequest(BaseModel):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=12, max_length=128)


class PasswordChangeResponse(BaseModel):
    ok: bool
    message: str


class WorkspaceGeneralUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=150)
    slug: str | None = Field(default=None, min_length=2, max_length=150)


class WorkspaceSecurityUpdate(BaseModel):
    session_timeout_minutes: int | None = Field(
        default=None, ge=5, le=10080
    )
    require_tool_approval: bool | None = None


class WorkspaceDataUpdate(BaseModel):
    retention_days: int | None = Field(default=None, ge=1, le=3650)
    allow_data_export: bool | None = None


class WorkspaceAiUpdate(BaseModel):
    default_model: str | None = Field(default=None, max_length=100)
    default_temperature: float | None = Field(default=None, ge=0, le=2)
    default_agent_timeout_seconds: int | None = Field(
        default=None, ge=5, le=3600
    )
    default_tool_approval_policy: str | None = Field(
        default=None, max_length=30
    )
    allowed_models: list[str] | None = None
    require_tool_approval: bool | None = None
    capture_mode: str | None = Field(default=None, max_length=20)


class WorkspaceSettingsUpdate(BaseModel):
    general: WorkspaceGeneralUpdate | None = None
    security: WorkspaceSecurityUpdate | None = None
    data: WorkspaceDataUpdate | None = None
    ai: WorkspaceAiUpdate | None = None


class OrganizationSummary(BaseModel):
    id: UUID
    name: str
    slug: str
    role: str


class WorkspaceGeneral(BaseModel):
    name: str
    slug: str


class WorkspaceSecurity(BaseModel):
    session_timeout_minutes: int
    require_tool_approval: bool
    mfa_supported: bool
    sessions_supported: bool
    mfa_note: str
    sessions_note: str


class WorkspaceAi(BaseModel):
    default_model: str | None
    default_temperature: float | None
    default_agent_timeout_seconds: int | None
    default_tool_approval_policy: str | None
    allowed_models: list[str]
    require_tool_approval: bool
    capture_mode: str
    available_models: list[str]
    tool_approval_policies: list[str]
    capture_modes: list[str]
    temperature_range: list[float]
    timeout_range: list[int]


class WorkspaceData(BaseModel):
    retention_days: int
    allow_data_export: bool
    export_scope: str
    retention_enforced: bool
    note: str


class WorkspaceCapabilities(BaseModel):
    mfa: bool
    sessions: bool
    sso: bool
    data_export: bool
    personal_account_deletion: bool
    workspace_deletion: bool
    ownership_transfer: bool
    workflow_overrides: bool
    run_overrides: bool


class WorkspaceSettingsResponse(BaseModel):
    organization: OrganizationSummary
    general: WorkspaceGeneral
    security: WorkspaceSecurity
    ai: WorkspaceAi
    data: WorkspaceData
    capabilities: WorkspaceCapabilities
    role: str
    can_manage: bool
    current_user_email: str = ""


class AgentConfigOverridePayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    model: str | None = Field(default=None, max_length=100)
    temperature: float | None = Field(default=None, ge=0, le=2)
    agent_timeout_seconds: int | None = Field(default=None, ge=5, le=3600)
    tool_approval_policy: str | None = Field(default=None, max_length=30)


class EffectiveSetting(BaseModel):
    value: object | None = None
    source: str
    source_label: str
    inherited: bool
    overridden: bool
    reset_available: bool
    locked_by_policy: bool = False


class EffectiveConfigResponse(BaseModel):
    agent: dict
    settings: dict
    capture_mode: str
    restrictions: dict
    agent_override: AgentConfigOverridePayload | None = None
    workflow_override: AgentConfigOverridePayload | None = None


class AgentSummary(BaseModel):
    id: UUID
    name: str
    published_version_id: UUID | None
    version_number: int | None
    override: AgentConfigOverridePayload | None
    inherited: bool


class AgentConfigListResponse(BaseModel):
    items: list[AgentSummary]


class WorkflowOverrideResponse(BaseModel):
    workflow_key: str
    override: AgentConfigOverridePayload | None


class WorkflowOverrideListResponse(BaseModel):
    items: list[WorkflowOverrideResponse]


class RunSnapshotResponse(BaseModel):
    id: UUID
    agent_id: UUID | None
    agent_version_id: UUID | None
    workflow_key: str | None
    run_id: str | None
    resolved_config: dict
    sources: dict
    created_at: str


class RunSnapshotListResponse(BaseModel):
    items: list[RunSnapshotResponse]


class OwnershipTransferRequest(BaseModel):
    membership_id: UUID


class OwnershipTransferResponse(BaseModel):
    ok: bool
    new_owner: str
    message: str


class WorkspaceDeleteRequest(BaseModel):
    confirm_name: str = Field(min_length=1, max_length=150)


class WorkspaceDeleteResponse(BaseModel):
    ok: bool
    message: str


class RunOverridePayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    model: str | None = Field(default=None, max_length=100)
    temperature: float | None = Field(default=None, ge=0, le=2)
    agent_timeout_seconds: int | None = Field(default=None, ge=5, le=3600)
    tool_approval_policy: str | None = Field(default=None, max_length=30)
