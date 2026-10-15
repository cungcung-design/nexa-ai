from uuid import UUID
from pydantic import BaseModel, Field


class KnowledgeBaseCreate(BaseModel):
    name: str = Field(min_length=2, max_length=150)


class KnowledgeBaseResponse(BaseModel):
    id: UUID
    organization_id: UUID
    name: str

    model_config = {"from_attributes": True}


class DocumentResponse(BaseModel):
    id: UUID
    filename: str
    status: str

    model_config = {"from_attributes": True}


class SearchRequest(BaseModel):
    query: str = Field(min_length=2, max_length=2000)
    limit: int = Field(default=5, ge=1, le=20)


class SearchResult(BaseModel):
    id: UUID
    document_id: UUID
    filename: str
    content: str
    score: float