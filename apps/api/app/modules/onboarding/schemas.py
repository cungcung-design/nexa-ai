from uuid import UUID
from typing import Literal
from pydantic import BaseModel, Field, field_validator


class OnboardingWorkspace(BaseModel):
    id: UUID
    name: str
    slug: str
    role: str


class OnboardingStateResponse(BaseModel):
    email: str
    email_verified: bool
    step: str
    completed_steps: list[str] = Field(default_factory=list)
    workspace: OnboardingWorkspace | None = None
    plan: str | None = None
    agent_id: UUID | None = None
    can_create_agent: bool = False
    workspaces: list[OnboardingWorkspace] = Field(default_factory=list)


class SlugAvailabilityResponse(BaseModel):
    slug: str
    available: bool
    reason: str | None = None


class WorkspaceCreateRequest(BaseModel):
    name: str = Field(min_length=2, max_length=150)
    slug: str = Field(
        min_length=3,
        max_length=150,
        pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$",
    )
    description: str = Field(default="", max_length=1000)
    workspace_id: UUID | None = None

    @field_validator("slug", mode="before")
    @classmethod
    def normalize_slug(cls, value):
        return value.lower() if isinstance(value, str) else value


class WorkspaceCreateResponse(BaseModel):
    id: UUID
    name: str
    slug: str
    role: str
    created: bool


class PlanOption(BaseModel):
    key: str
    label: str
    tagline: str
    price: str
    amount: int
    currency: str
    interval: str
    popular: bool
    contact_sales: bool
    purchasable: bool
    current: bool


class PlanListResponse(BaseModel):
    currency: str
    plans: list[PlanOption] = Field(default_factory=list)
    provider_configured: bool = False


class PlanSelectRequest(BaseModel):
    workspace_id: UUID
    plan: str
    interval: Literal["monthly", "yearly"] = "monthly"


class PlanSelectResponse(BaseModel):
    plan: str
    label: str
    status: str
    confirmed: bool
    checkout_url: str | None = None
    message: str | None = None


class FirstAgentRequest(BaseModel):
    workspace_id: UUID


class FirstAgentResponse(BaseModel):
    id: UUID
    name: str
    description: str
    created: bool


class OnboardingCompleteResponse(BaseModel):
    step: str
    completed_steps: list[str] = Field(default_factory=list)
    workspace_id: UUID | None = None


class StepRequest(BaseModel):
    step: str

    @field_validator("step", mode="before")
    @classmethod
    def normalize_step(cls, value):
        return value.strip().lower().replace(" ", "_") if isinstance(value, str) else value
