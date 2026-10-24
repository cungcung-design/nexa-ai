"""Public pricing catalog.

The marketing site reads the same plan records the workspace billing
enforces. The route does not require a session and it does not reveal
payment-provider identifiers.
"""

from fastapi import APIRouter

from app.modules.billing.plans import CURRENCY, MONTHLY, YEARLY, catalog
from app.modules.billing.stripe_service import provider_configured
from app.modules.billing.schemas import (
    CatalogPlanResponse,
    CatalogResponse,
    PlanLimitsResponse,
    PlanPriceResponse,
)

router = APIRouter(prefix="/api/v1/public", tags=["Public Pricing"])


def _price(plan_key: str, interval: str) -> PlanPriceResponse | None:
    plan = next(item for item in catalog() if item.key == plan_key)
    price = plan.price_for(interval)
    if price is None:
        return None
    return PlanPriceResponse(
        amount=price.amount,
        currency=price.currency,
        interval=price.interval,
        monthly_equivalent=price.monthly_equivalent,
        annual_total=price.annual_total,
    )


@router.get("/plans", response_model=CatalogResponse)
def public_plans() -> CatalogResponse:
    """Return the configured plans, prices, and limits."""
    plans = []
    for plan in catalog():
        limits = plan.limits
        plans.append(
            CatalogPlanResponse(
                key=plan.key,
                label=plan.label,
                tagline=plan.tagline,
                features=list(plan.features),
                limits=PlanLimitsResponse(
                    agents=limits.agents,
                    monthly_requests=limits.monthly_requests,
                    knowledge_bases=limits.knowledge_bases,
                    workflow_executions=limits.workflow_executions,
                    storage_mb=limits.storage_mb,
                    seats=limits.seats,
                ),
                monthly=_price(plan.key, MONTHLY),
                yearly=_price(plan.key, YEARLY),
                contact_sales=plan.contact_sales,
                popular=plan.popular,
                purchasable=plan.purchasable,
                current=False,
            )
        )
    return CatalogResponse(
        currency=CURRENCY,
        plans=plans,
        provider_configured=provider_configured(),
    )
