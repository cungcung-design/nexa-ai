"""Schemas for the Team module."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, field_validator


class TeamMemberResponse(BaseModel):
    """A workspace membership as shown in the members directory."""

    id: UUID
    user_id: UUID
    email: str
    role: str
    role_label: str
    status: str
    created_at: datetime
    permissions: list[str] = Field(default_factory=list)


class TeamMemberListResponse(BaseModel):
    items: list[TeamMemberResponse]
    total: int


class TeamMetricsResponse(BaseModel):
    total_members: int
    active_members: int
    suspended_members: int
    pending_invitations: int
    roles: int


class InvitationCreate(BaseModel):
    email: EmailStr
    role: str = "VIEWER"
    message: str | None = Field(default=None, max_length=2000)

    @field_validator("role", mode="before")
    @classmethod
    def _normalize_role(cls, value: object) -> object:
        if isinstance(value, str):
            return value.strip().upper()
        return value


class InvitationResponse(BaseModel):
    id: UUID
    organization_id: UUID
    organization_name: str
    email: str
    role: str
    role_label: str
    status: str
    message: str | None
    invited_by_email: str | None
    expires_at: datetime
    created_at: datetime
    accepted_at: datetime | None
    revoked_at: datetime | None
    permissions: list[str] = Field(default_factory=list)
    permission_labels: list[str] = Field(default_factory=list)
    #: Raw token, only ever returned by the create and resend endpoints.
    invite_token: str | None = None


class InvitationPreview(BaseModel):
    email: str
    organization_id: UUID
    organization_name: str
    role: str
    role_label: str
    status: str
    message: str | None
    expires_at: datetime
    permissions: list[str] = Field(default_factory=list)
    permission_labels: list[str] = Field(default_factory=list)


class MembershipUpdate(BaseModel):
    role: str | None = None
    status: str | None = None

    @field_validator("role", "status", mode="before")
    @classmethod
    def _normalize(cls, value: object) -> object:
        if isinstance(value, str):
            return value.strip().upper()
        return value


class EffectivePermission(BaseModel):
    permission: str
    label: str
    granted: bool
    source: str
    restriction: str | None = None


class MemberResource(BaseModel):
    id: str
    name: str
    type: str
    href: str | None = None
    can_open: bool = True


class MemberResources(BaseModel):
    agents: list[MemberResource] = Field(default_factory=list)
    knowledge_bases: list[MemberResource] = Field(default_factory=list)
    approvals: list[MemberResource] = Field(default_factory=list)
    agents_count: int = 0
    knowledge_bases_count: int = 0
    approvals_count: int = 0
    workflows_supported: bool = False
    workflows_note: str = ""


class TeamActivityEntry(BaseModel):
    id: str
    action: str
    title: str
    summary: str | None = None
    category: str
    outcome: str
    resource_type: str
    resource_id: str | None = None
    resource_name: str | None = None
    actor_email: str | None = None
    created_at: datetime


class MemberDetailResponse(BaseModel):
    member: TeamMemberResponse
    effective_permissions: list[EffectivePermission] = Field(default_factory=list)
    granted_permissions: list[str] = Field(default_factory=list)
    groups_supported: bool = False
    groups_note: str = ""
    direct_access_supported: bool = False
    direct_access_note: str = ""
    resources: MemberResources
    activity: list[TeamActivityEntry] = Field(default_factory=list)
    can_manage: bool = False


class RoleSummaryResponse(BaseModel):
    role: str
    label: str
    description: str
    permissions: list[str] = Field(default_factory=list)
    permission_labels: list[str] = Field(default_factory=list)
    member_count: int = 0


class MatrixCapabilityResponse(BaseModel):
    capability: str
    permission: str
    grants: dict[str, bool]


class RoleMatrixResponse(BaseModel):
    roles: list[str]
    role_labels: dict[str, str]
    capabilities: list[MatrixCapabilityResponse] = Field(default_factory=list)
