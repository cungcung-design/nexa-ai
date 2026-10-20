from uuid import UUID
from pydantic import BaseModel, Field

from app.modules.settings.schemas import RunOverridePayload


class AgentChatRequest(BaseModel):
    message: str = Field(
        min_length=1,
        max_length=4000,
    )
    #: Optional version of the agent that is executed. The published
    #: version is used when it is not supplied.
    version_id: UUID | None = None
    #: Permitted run overrides. They are validated against the workspace
    #: model policy on the backend.
    overrides: RunOverridePayload | None = None


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
    temperature: float | None = None
    run_id: str | None = None
    resolved_config: dict | None = None
    config_sources: dict | None = None
    prompt_tokens: int | None = None
    completion_tokens: int | None = None
