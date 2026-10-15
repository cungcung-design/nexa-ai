from typing import Literal
from uuid import UUID
from pydantic import BaseModel, Field


class DemoActionRequest(BaseModel):
    agent_id: UUID
    note: str = Field(min_length=1, max_length=500)


class ApprovalDecision(BaseModel):
    approved: bool


class ApprovalResponse(BaseModel):
    id: UUID
    status: Literal["PENDING", "APPROVED", "REJECTED"]
    action: str
    thread_id: str


class ApprovalListItem(BaseModel):
    id: UUID
    status: Literal["PENDING", "APPROVED", "REJECTED"]
    action: str
    thread_id: str
    requested_by: UUID | None = None
    created_at: str