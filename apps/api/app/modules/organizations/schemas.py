from uuid import UUID
from typing import Literal
from pydantic import BaseModel, Field, field_validator

Role = Literal["OWNER", "ADMIN", "DEVELOPER", "VIEWER"]


class OrganizationCreate(BaseModel):
    name: str = Field(min_length=2, max_length=150)
    slug: str = Field(
        min_length=3,
        max_length=150,
        pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$",
    )

    @field_validator("slug", mode="before")
    @classmethod
    def normalize_slug(cls, v: str) -> str:
        return v.lower() if isinstance(v, str) else v


class OrganizationResponse(BaseModel):
    id: UUID
    name: str
    slug: str
    role: Role

    model_config = {"from_attributes": True}


class MemberResponse(BaseModel):
    user_id: UUID
    email: str
    role: Role

    model_config = {"from_attributes": True}


class AddMemberRequest(BaseModel):
    email: str
    role: Role = "VIEWER"