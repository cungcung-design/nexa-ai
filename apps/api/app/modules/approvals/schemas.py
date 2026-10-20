from typing import Literal, Optional
from uuid import UUID
from pydantic import BaseModel, Field


class ApprovalBase(BaseModel):
    id: UUID
    organization_id: UUID
    agent_id: UUID
    thread_id: str
    action: str
    arguments: dict
    status: Literal["PENDING", "APPROVED", "REJECTED", "EXPIRED"]
    requested_by: Optional[UUID] = None
    decided_by: Optional[UUID] = None
    decided_at: Optional[str] = None
    created_at: str


class ApprovalListItem(BaseModel):
    id: UUID
    status: Literal["PENDING", "APPROVED", "REJECTED", "EXPIRED"]
    action: str
    thread_id: str
    requested_by: Optional[UUID] = None
    created_at: str


class ApprovalDecision(BaseModel):
    approved: bool
    reason: Optional[str] = Field(default=None, max_length=1000)


class ApprovalResponse(BaseModel):
    id: UUID
    status: Literal["PENDING", "APPROVED", "REJECTED", "EXPIRED"]
    action: str
    thread_id: str


class ApprovalDetail(ApprovalBase):
    execution_status: Optional[str] = None
    execution_result: Optional[dict] = None
    policy_id: Optional[UUID] = None
    assigned_reviewer: Optional[UUID] = None


class ApprovalPolicyBase(BaseModel):
    id: UUID
    organization_id: UUID
    name: str
    description: Optional[str] = None
    action_pattern: str
    risk_level: Literal["low", "medium", "high", "critical"]
    is_enabled: bool
    created_at: str
    updated_at: str


class ApprovalPolicyCreate(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    description: Optional[str] = None
    action_pattern: str = Field(min_length=1, max_length=100)
    risk_level: Literal["low", "medium", "high", "critical"] = "medium"
    is_enabled: bool = True


class ApprovalPolicyUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=150)
    description: Optional[str] = None
    action_pattern: Optional[str] = Field(default=None, min_length=1, max_length=100)
    risk_level: Optional[Literal["low", "medium", "high", "critical"]] = None
    is_enabled: Optional[bool] = None


class ApprovalAssignmentBase(BaseModel):
    id: UUID
    organization_id: UUID
    policy_id: Optional[UUID] = None
    user_id: UUID
    user_email: str
    is_primary: bool
    created_at: str


class ApprovalAssignmentCreate(BaseModel):
    policy_id: Optional[UUID] = None
    user_id: UUID
    is_primary: bool = False


class ApprovalStats(BaseModel):
    pending: int
    approved_today: int
    rejected_today: int
    expired: int
