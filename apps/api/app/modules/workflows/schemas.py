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


class WorkflowInputField(BaseModel):
    name: str
    type: str
    required: bool
    min_length: int | None = None
    max_length: int | None = None


class WorkflowDefinition(BaseModel):
    key: str
    name: str
    description: str
    requires_approval: bool
    inputs: list[WorkflowInputField]


class WorkflowExecutionItem(BaseModel):
    id: UUID
    workflow_key: str
    workflow_name: str
    thread_id: str
    status: Literal["PENDING", "APPROVED", "REJECTED"]
    display_status: Literal[
        "waiting_for_approval",
        "running",
        "completed",
        "rejected",
        "failed",
    ]
    agent_id: UUID
    agent_name: str | None
    arguments: dict
    result: dict | None
    checkpoint_error: str | None
    created_at: str
    completed_at: str | None