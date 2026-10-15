from pydantic import BaseModel, Field


class PublicChatRequest(BaseModel):
    message: str = Field(
        min_length=1,
        max_length=2000,
    )


class PublicChatResponse(BaseModel):
    answer: str
    model: str