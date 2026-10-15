from uuid import UUID
from pydantic import BaseModel, Field


class AgentChatRequest(BaseModel):
    message: str = Field(
        min_length=1,
        max_length=4000,
    )


class SourceReference(BaseModel):
    document_id: UUID
    filename: str
    chunk_index: int
    distance: float


class AgentChatResponse(BaseModel):
    agent_id: UUID
    version_id: UUID
    answer: str
    sources: list[SourceReference]
    model: str
    prompt_tokens: int | None = None
    completion_tokens: int | None = None
