from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field


class ConversationCreate(BaseModel):
    agent_id: UUID
    title: str = Field(
        default="New conversation",
        min_length=1,
        max_length=200,
    )


class ConversationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    organization_id: UUID
    agent_id: UUID
    title: str
    created_at: datetime


class MessageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    conversation_id: UUID
    role: str
    content: str
    created_at: datetime


class ConversationChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000)


class ConversationChatResponse(BaseModel):
    conversation_id: UUID
    answer: str
    model: str
    sources: list[dict]
    prompt_tokens: int | None = None
    completion_tokens: int | None = None
