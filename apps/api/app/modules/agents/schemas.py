from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict


class AgentCreate(BaseModel):
    name: str = Field(min_length=2, max_length=150)
    description: str = Field(default="", max_length=2000)


class AgentUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=150)
    description: str | None = Field(default=None, max_length=2000)


class AgentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    organization_id: UUID
    name: str
    description: str
    is_archived: bool
    published_version_id: UUID | None
    created_at: datetime


class AgentVersionCreate(BaseModel):
    system_prompt: str = Field(min_length=10, max_length=20000)
    model: str = Field(default="gpt-4.1-mini", min_length=2, max_length=100)
    temperature: float = Field(default=0.3, ge=0, le=2)
    max_tokens: int = Field(default=1024, ge=1, le=8192)
    tools_config: dict = Field(default_factory=dict)


class AgentVersionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    agent_id: UUID
    version_number: int
    system_prompt: str
    model: str
    temperature: float
    max_tokens: int
    tools_config: dict
    created_at: datetime