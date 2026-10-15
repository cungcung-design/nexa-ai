from typing import Annotated
from uuid import UUID
from pydantic import BaseModel, Field, HttpUrl


class DeploymentCreate(BaseModel):
    agent_id: UUID
    name: str = Field(min_length=2, max_length=150)
    allowed_origins: list[HttpUrl] = Field(
        min_length=1,
        max_length=20,
    )


class DeploymentResponse(BaseModel):
    id: UUID
    agent_id: UUID
    public_id: str
    name: str
    allowed_origins: list[str]
    is_active: bool

    model_config = {"from_attributes": True}