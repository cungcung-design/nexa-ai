from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.db.models import User, OrganizationSubscription, Role
from app.db.session import get_db
from app.modules.auth.dependencies import get_current_user
from app.modules.organizations.router import require_membership
from app.modules.billing.schemas import CheckoutRequest, CheckoutResponse
from app.modules.billing.stripe_service import create_checkout_session
from app.modules.billing.usage import get_effective_plan


router = APIRouter(prefix="/api/v1/organizations/{organization_id}/billing", tags=["Billing"])


def require_owner(membership) -> None:
    if membership.role != Role.OWNER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only organization owners can manage billing",
        )


@router.get("/plan")
def get_current_plan(
    organization_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_membership(db, current_user.id, organization_id)

    plan = get_effective_plan(db, organization_id)
    from app.modules.billing.plans import get_plan_limits
    limits = get_plan_limits(plan)

    subscription = db.scalar(
        select(OrganizationSubscription).where(
            OrganizationSubscription.organization_id == organization_id
        )
    )

    return {
        "plan": plan,
        "status": subscription.status if subscription else "ACTIVE",
        "limits": {
            "agents": limits.agents,
            "monthly_requests": limits.monthly_requests,
            "knowledge_bases": limits.knowledge_bases,
        },
    }


@router.post("/checkout", response_model=CheckoutResponse)
def create_checkout(
    organization_id: UUID,
    request: CheckoutRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    membership = require_membership(db, current_user.id, organization_id)
    require_owner(membership)

    subscription = db.scalar(
        select(OrganizationSubscription).where(
            OrganizationSubscription.organization_id == organization_id
        )
    )

    customer_id = subscription.stripe_customer_id if subscription else None

    checkout_url = create_checkout_session(
        organization_id=str(organization_id),
        plan=request.plan,
        customer_id=customer_id,
    )

    return CheckoutResponse(checkout_url=checkout_url)