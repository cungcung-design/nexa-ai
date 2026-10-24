"""Pricing catalog for the workspace plans.

The catalog is the single source of truth for plan entitlements and prices.
Every entitlement enforced by the backend (request quotas, agent limits,
knowledge base limits, seats, storage) is resolved from this module so the
billing screens can never drift from what is actually enforced.

Prices are stored in the smallest currency unit (cents) to avoid floating
point rounding. The Stripe price identifiers are resolved from the
application settings; a plan without a configured Stripe price cannot be
purchased through self serve checkout.
"""

import re
from dataclasses import dataclass, field
from typing import Optional

from app.core.config import settings

#: Billing intervals the catalog supports.
MONTHLY = "monthly"
YEARLY = "yearly"
INTERVALS = (MONTHLY, YEARLY)

#: Currency used by the catalog.
CURRENCY = "usd"

#: Stripe price identifiers accepted by checkout. Placeholders are excluded.
_PRICE_ID = re.compile(r"^price_[A-Za-z0-9_]+$")


def valid_stripe_price_id(value: str | None) -> Optional[str]:
    """Return a usable Stripe price id, or None when the value is not one."""
    if value is None:
        return None
    candidate = str(value).strip()
    if not candidate or "REPLACE" in candidate.upper():
        return None
    if _PRICE_ID.fullmatch(candidate) is None:
        return None
    return candidate


@dataclass(frozen=True)
class PlanLimits:
    """Entitlements granted by a plan."""

    agents: int
    monthly_requests: int
    knowledge_bases: int
    workflow_executions: int = 0
    storage_mb: int = 0
    seats: int = 0

    @property
    def unlimited_workflows(self) -> bool:
        return self.workflow_executions <= 0

    @property
    def unlimited_storage(self) -> bool:
        return self.storage_mb <= 0


@dataclass(frozen=True)
class PlanPrice:
    """A single price point of a plan."""

    amount: int
    currency: str = CURRENCY
    interval: str = MONTHLY

    @property
    def display_amount(self) -> float:
        return self.amount / 100

    @property
    def monthly_equivalent(self) -> int:
        """Amount charged per month when billed yearly."""
        if self.interval == MONTHLY:
            return self.amount
        return round(self.amount / 12)

    @property
    def annual_total(self) -> int:
        """Total charged for a full year when billed yearly."""
        if self.interval == YEARLY:
            return self.amount
        return self.amount * 12


@dataclass(frozen=True)
class Plan:
    """A purchasable plan with its entitlements and prices."""

    key: str
    label: str
    tagline: str
    limits: PlanLimits
    features: tuple[str, ...]
    monthly: Optional[PlanPrice] = None
    yearly: Optional[PlanPrice] = None
    contact_sales: bool = False
    popular: bool = False
    #: Settings attribute holding the Stripe price identifier.
    stripe_price_setting: Optional[str] = None
    #: Settings attribute holding the yearly Stripe price identifier.
    stripe_yearly_price_setting: Optional[str] = None

    def price_for(self, interval: str) -> Optional[PlanPrice]:
        if interval == YEARLY:
            return self.yearly
        return self.monthly

    def stripe_price_id_for(self, interval: str = MONTHLY) -> Optional[str]:
        """The configured Stripe price identifier for ``interval``."""
        attribute = (
            self.stripe_yearly_price_setting
            if interval == YEARLY
            else self.stripe_price_setting
        )
        if not attribute:
            return None
        value = getattr(settings, attribute, "")
        return valid_stripe_price_id(value)

    @property
    def stripe_price_id(self) -> Optional[str]:
        return self.stripe_price_id_for(MONTHLY)

    @property
    def purchasable(self) -> bool:
        """True when a Stripe price is configured for at least one interval."""
        if self.contact_sales:
            return False
        return any(
            self.stripe_price_id_for(interval) is not None
            for interval in INTERVALS
        )


#: Canonical plans in ascending order of privilege.
PLANS: dict[str, Plan] = {
    "FREE": Plan(
        key="FREE",
        label="Free",
        tagline="Explore essential AI automation",
        limits=PlanLimits(
            agents=2,
            monthly_requests=100,
            knowledge_bases=1,
            workflow_executions=100,
            storage_mb=100,
            seats=5,
        ),
        features=(
            "Limited AI requests",
            "Basic agents and workflows",
            "Community-level support",
        ),
        monthly=PlanPrice(amount=0, interval=MONTHLY),
    ),
    "STARTER": Plan(
        key="STARTER",
        label="Starter",
        tagline="For small teams getting started",
        limits=PlanLimits(
            agents=5,
            monthly_requests=1000,
            knowledge_bases=5,
            workflow_executions=1000,
            storage_mb=500,
            seats=10,
        ),
        features=(
            "Higher usage limits",
            "More active agents",
            "Team collaboration",
        ),
        monthly=PlanPrice(amount=1900, interval=MONTHLY),
        yearly=PlanPrice(amount=19000, interval=YEARLY),
        stripe_price_setting="stripe_starter_price_id",
        stripe_yearly_price_setting="stripe_starter_yearly_price_id",
    ),
    "PRO": Plan(
        key="PRO",
        label="Pro",
        tagline="For growing automation teams",
        limits=PlanLimits(
            agents=10,
            monthly_requests=5000,
            knowledge_bases=20,
            workflow_executions=5000,
            storage_mb=2000,
            seats=25,
        ),
        features=(
            "Advanced agent tools",
            "Expanded workflow limits",
            "Usage analytics",
        ),
        monthly=PlanPrice(amount=4900, interval=MONTHLY),
        yearly=PlanPrice(amount=49000, interval=YEARLY),
        popular=True,
        stripe_price_setting="stripe_pro_price_id",
        stripe_yearly_price_setting="stripe_pro_yearly_price_id",
    ),
    "BUSINESS": Plan(
        key="BUSINESS",
        label="Enterprise",
        tagline="For organizations with custom requirements",
        limits=PlanLimits(
            agents=50,
            monthly_requests=25000,
            knowledge_bases=100,
            workflow_executions=25000,
            storage_mb=20000,
            seats=100,
        ),
        features=(
            "Custom quotas",
            "Advanced access controls",
            "Dedicated agreements",
        ),
        contact_sales=True,
    ),
}

#: Plans offered on the pricing screen, in display order.
CATALOG_ORDER: tuple[str, ...] = ("FREE", "STARTER", "PRO", "BUSINESS")

#: Plans a workspace can purchase through self serve checkout.
SELF_SERVE_PLANS: tuple[str, ...] = ("STARTER", "PRO")


def get_plan(plan: str | None) -> Plan:
    """Return the catalog entry for ``plan`` falling back to the free tier."""
    if not plan:
        return PLANS["FREE"]
    return PLANS.get(str(plan).strip().upper(), PLANS["FREE"])


def get_plan_limits(plan: str) -> PlanLimits:
    """Return the entitlements granted by ``plan``."""
    return get_plan(plan).limits


def catalog() -> list[Plan]:
    """Every plan in display order."""
    return [PLANS[key] for key in CATALOG_ORDER]


def price_for(plan: str | None, interval: str = MONTHLY) -> Optional[PlanPrice]:
    """The price of ``plan`` for ``interval``."""
    normalized = YEARLY if str(interval).strip().lower() == YEARLY else MONTHLY
    return get_plan(plan).price_for(normalized)


def plan_for_stripe_price(
    price_id: str | None,
) -> Optional[tuple[str, str]]:
    """Resolve a Stripe price identifier to a catalog plan and interval."""
    if not price_id:
        return None
    for plan in PLANS.values():
        for interval in INTERVALS:
            if plan.stripe_price_id_for(interval) == price_id:
                return plan.key, interval
    return None
