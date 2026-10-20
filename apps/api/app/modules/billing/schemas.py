"""Schemas for the billing module."""

from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, field_validator


class CheckoutRequest(BaseModel):
    plan: str
    interval: Literal["monthly", "yearly"] = "monthly"

    @field_validator("plan", mode="before")
    @classmethod
    def _normalize_plan(cls, value: object) -> object:
        if isinstance(value, str):
            return value.strip().upper()
        return value


class CheckoutResponse(BaseModel):
    checkout_url: str
    session_id: Optional[str] = None


class PlanPriceResponse(BaseModel):
    amount: int
    currency: str
    interval: str
    monthly_equivalent: int
    annual_total: int


class PlanLimitsResponse(BaseModel):
    agents: int
    monthly_requests: int
    knowledge_bases: int
    workflow_executions: int
    storage_mb: int
    seats: int


class CatalogPlanResponse(BaseModel):
    key: str
    label: str
    tagline: str
    features: list[str] = Field(default_factory=list)
    limits: PlanLimitsResponse
    monthly: Optional[PlanPriceResponse] = None
    yearly: Optional[PlanPriceResponse] = None
    contact_sales: bool = False
    popular: bool = False
    purchasable: bool = False
    current: bool = False


class CatalogResponse(BaseModel):
    currency: str
    plans: list[CatalogPlanResponse] = Field(default_factory=list)
    provider_configured: bool = False


class SubscriptionResponse(BaseModel):
    plan: str
    plan_label: str
    status: str
    interval: str
    price_amount: int
    currency: str
    current_period_start: Optional[datetime] = None
    current_period_end: Optional[datetime] = None
    cancel_at_period_end: bool = False
    canceled_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    has_provider_subscription: bool = False
    provider_configured: bool = False
    limits: PlanLimitsResponse
    price: Optional[PlanPriceResponse] = None


class UsageQuotaResponse(BaseModel):
    key: str
    label: str
    unit: str
    used: float
    limit: Optional[float] = None
    unlimited: bool = False
    #: False when the backend does not meter this resource yet.
    tracked: bool = True


class UsagePointResponse(BaseModel):
    day: str
    value: int


class UsageResponse(BaseModel):
    period: str
    period_start: str
    period_end: str
    interval: str
    quotas: list[UsageQuotaResponse] = Field(default_factory=list)
    request_count: int = 0
    prompt_tokens: int = 0
    completion_tokens: int = 0
    estimated_cost_cents: int = 0
    seats_used: int = 0
    trend: list[UsagePointResponse] = Field(default_factory=list)


class InvoiceResponse(BaseModel):
    id: UUID
    number: str
    status: str
    currency: str
    amount_due: int
    amount_paid: int
    tax_amount: int = 0
    period_start: Optional[datetime] = None
    period_end: Optional[datetime] = None
    hosted_invoice_url: Optional[str] = None
    invoice_pdf: Optional[str] = None
    created_at: datetime


class InvoiceListResponse(BaseModel):
    items: list[InvoiceResponse] = Field(default_factory=list)
    total: int = 0


class PaymentMethodResponse(BaseModel):
    id: UUID
    brand: str
    last4: str
    exp_month: Optional[int] = None
    exp_year: Optional[int] = None
    holder_name: Optional[str] = None
    is_default: bool = False
    #: True when the card is attached to the active subscription.
    in_use: bool = False


class PaymentMethodListResponse(BaseModel):
    items: list[PaymentMethodResponse] = Field(default_factory=list)
    provider_configured: bool = False


class PortalSessionResponse(BaseModel):
    url: str


class BillingSettingsResponse(BaseModel):
    company_name: str = ""
    billing_email: Optional[str] = None
    address: Optional[str] = None
    tax_id: Optional[str] = None


class BillingSettingsUpdate(BaseModel):
    company_name: str = ""
    billing_email: Optional[EmailStr] = None
    address: Optional[str] = None
    tax_id: Optional[str] = None


class CancelRequest(BaseModel):
    cancel_at_period_end: bool = True


class MessageResponse(BaseModel):
    message: str
