"""The onboarding flow of a new account.

The module keeps the personal onboarding progress of a user, creates the
workspace of the flow, activates the chosen plan, and creates the first
agent. Every step is protected: the user has to be signed in, the address has
to be confirmed, and the user has to be allowed to act on the workspace.
"""

from uuid import UUID
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from app.core.config import settings
from app.db.models import (
    Agent,
    Membership,
    MembershipStatus,
    OnboardingState,
    Organization,
    OrganizationSubscription,
    Role as RoleEnum,
    User,
)
from app.db.session import get_db
from app.modules.auth.dependencies import get_current_user
from app.modules.billing.plans import (
    CURRENCY,
    MONTHLY,
    catalog,
    get_plan,
    price_for,
)
from app.modules.billing.stripe_service import (
    BillingProviderError,
    BillingProviderUnavailable,
    create_checkout_session,
    provider_configured,
)
from app.modules.onboarding.schemas import (
    FirstAgentRequest,
    FirstAgentResponse,
    OnboardingCompleteResponse,
    OnboardingStateResponse,
    OnboardingWorkspace,
    PlanListResponse,
    PlanOption,
    PlanSelectRequest,
    PlanSelectResponse,
    SlugAvailabilityResponse,
    StepRequest,
    WorkspaceCreateRequest,
    WorkspaceCreateResponse,
)
from app.modules.organizations.router import require_membership
from app.modules.security.audit import record_audit_event

router = APIRouter(prefix="/api/v1/onboarding", tags=["Onboarding"])

#: The order of the onboarding steps.
STEP_ORDER = [
    "welcome",
    "workspace",
    "workspace_information",
    "plan",
    "first_agent",
    "complete",
]

#: The steps that only collect a choice and can be marked as done by the user.
MANUAL_STEPS = ("welcome", "workspace", "preferences")

#: The agent template the flow offers as the first agent.
FIRST_AGENT_TEMPLATE = {    "key": "customer_support",
    "name": "Customer Support Agent",
    "description": (
        "A helpful agent that answers questions using your knowledge base."
    ),
    "system_prompt": (
        "You are a customer support agent. Answer the questions of the "
        "customers of the workspace with the knowledge of the workspace. "
        "Ask for the details you need and keep the answers clear and short."
    ),
}


def _state(db: Session, user_id: UUID) -> OnboardingState:
    """Return the onboarding state of a user and create it when missing.

    Two requests of the same user can reach the helper at the same time, the
    second one then reads the row the first one created.
    """
    state = (
        db.query(OnboardingState)
        .filter(OnboardingState.user_id == user_id)
        .first()
    )
    if state is not None:
        return state
    state = OnboardingState(user_id=user_id, step="welcome", completed_steps=[])
    db.add(state)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        state = (
            db.query(OnboardingState)
            .filter(OnboardingState.user_id == user_id)
            .first()
        )
        if state is None:
            raise
        return state
    db.refresh(state)
    return state


def _require_verified(user: User) -> None:
    if not user.email_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Confirm your email address before continuing.",
        )


def _require_step(state: OnboardingState, step: str) -> None:
    """Make sure the user already finished the earlier steps."""
    index = STEP_ORDER.index(step)
    for previous in STEP_ORDER[:index]:
        if previous not in (state.completed_steps or []):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Complete the {previous.replace('_', ' ')} step first.",
            )


def _mark_completed(state: OnboardingState, step: str) -> None:
    completed = list(state.completed_steps or [])
    if step not in completed:
        completed.append(step)
    state.completed_steps = completed
    if step in STEP_ORDER:
        index = STEP_ORDER.index(step)
        if index + 1 < len(STEP_ORDER):
            state.step = STEP_ORDER[index + 1]


def _membership(
    db: Session, user: User, organization_id: UUID
) -> Membership:
    return require_membership(db, user.id, organization_id)


def _workspace_payload(membership: Membership) -> OnboardingWorkspace:
    organization = membership.organization
    return OnboardingWorkspace(
        id=organization.id,
        name=organization.name,
        slug=organization.slug,
        role=membership.role.value,
    )


@router.get("/state", response_model=OnboardingStateResponse)
def onboarding_state(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return the onboarding progress of the signed in user."""
    state = _state(db, current_user.id)
    memberships = (
        db.query(Membership)
        .filter(
            Membership.user_id == current_user.id,
            Membership.status == MembershipStatus.ACTIVE.value,
        )
        .all()
    )
    workspace = None
    if state.workspace_id is not None:
        for membership in memberships:
            if membership.organization_id == state.workspace_id:
                workspace = _workspace_payload(membership)
                break
    can_create_agent = False
    if workspace is not None:
        membership = _membership(db, current_user, workspace.id)
        can_create_agent = membership.role in (
            RoleEnum.OWNER,
            RoleEnum.ADMIN,
            RoleEnum.DEVELOPER,
        )
    return OnboardingStateResponse(
        email=current_user.email,
        email_verified=bool(current_user.email_verified),
        step=state.step,
        completed_steps=list(state.completed_steps or []),
        workspace=workspace,
        plan=state.plan,
        agent_id=state.agent_id,
        can_create_agent=can_create_agent,
        workspaces=[_workspace_payload(m) for m in memberships],
    )


@router.post("/step", response_model=OnboardingCompleteResponse)
def complete_step(
    request: StepRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Mark a step of the flow that only collects a choice as done.

    The steps that change data, like the workspace, the plan, and the agent,
    are marked by their own endpoints.
    """
    _require_verified(current_user)
    state = _state(db, current_user.id)
    if request.step not in MANUAL_STEPS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This step cannot be marked as done.",
        )
    _mark_completed(state, request.step)
    db.commit()
    return OnboardingCompleteResponse(
        step=state.step,
        completed_steps=list(state.completed_steps or []),
        workspace_id=state.workspace_id,
    )


@router.get("/slug-available", response_model=SlugAvailabilityResponse)
def slug_available(
    slug: str = Query(min_length=3, max_length=150),
    db: Session = Depends(get_db),
):
    """Report whether a workspace slug can still be used."""
    candidate = slug.strip().lower()
    if not candidate:
        return SlugAvailabilityResponse(
            slug=candidate, available=False, reason="The slug is required."
        )
    existing = (
        db.query(Organization).filter(Organization.slug == candidate).first()
    )
    if existing is not None:
        return SlugAvailabilityResponse(
            slug=candidate,
            available=False,
            reason="This slug is already taken.",
        )
    return SlugAvailabilityResponse(slug=candidate, available=True)


@router.post(
    "/workspace",
    response_model=WorkspaceCreateResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_workspace(
    request: WorkspaceCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create the workspace of the onboarding flow."""
    _require_verified(current_user)
    state = _state(db, current_user.id)
    _require_step(state, "workspace_information")

    if request.workspace_id is not None:
        # A retry of the same step reuses the workspace of the first attempt.
        membership = _membership(db, current_user, request.workspace_id)
        organization = membership.organization
        organization.name = request.name
        organization.slug = request.slug.lower()
        state.workspace_id = organization.id
        _mark_completed(state, "workspace_information")
        db.commit()
        return WorkspaceCreateResponse(
            id=organization.id,
            name=organization.name,
            slug=organization.slug,
            role=membership.role.value,
            created=False,
        )

    organization = Organization(name=request.name, slug=request.slug.lower())
    db.add(organization)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This workspace slug is already taken.",
        )

    membership = Membership(
        user_id=current_user.id,
        organization_id=organization.id,
        role=RoleEnum.OWNER,
        status=MembershipStatus.ACTIVE.value,
    )
    db.add(membership)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This workspace slug is already taken.",
        )
    db.refresh(organization)

    state.workspace_id = organization.id
    _mark_completed(state, "workspace_information")
    db.commit()

    record_audit_event(
        db,
        organization_id=organization.id,
        actor_user_id=current_user.id,
        actor_type="user",
        action="workspace.created",
        resource_type="organization",
        resource_id=organization.id,
        resource_name=organization.name,
        details={"slug": organization.slug, "role": RoleEnum.OWNER.value},
        changes={"before": {}, "after": {"name": organization.name}},
        summary=f"{current_user.email} created the workspace “{organization.name}”.",
    )
    return WorkspaceCreateResponse(
        id=organization.id,
        name=organization.name,
        slug=organization.slug,
        role=RoleEnum.OWNER.value,
        created=True,
    )


@router.get("/plans", response_model=PlanListResponse)
def onboarding_plans(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return the plans the user can choose from."""
    state = _state(db, current_user.id)
    current_plan = None
    if state.workspace_id is not None:
        subscription = (
            db.query(OrganizationSubscription)
            .filter(
                OrganizationSubscription.organization_id == state.workspace_id
            )
            .first()
        )
        if subscription is not None:
            current_plan = subscription.plan

    plans = []
    for plan in catalog():
        price = price_for(plan.key, MONTHLY)
        amount = price.amount if price else 0
        currency = price.currency if price else CURRENCY
        if plan.contact_sales:
            display = "Custom"
        elif amount == 0:
            display = "$0"
        else:
            display = f"${amount / 100:g}"
        plans.append(
            PlanOption(
                key=plan.key,
                label=plan.label,
                tagline=plan.tagline,
                price=display,
                amount=amount,
                currency=currency,
                interval=price.interval if price else MONTHLY,
                popular=plan.popular,
                contact_sales=plan.contact_sales,
                purchasable=plan.purchasable,
                current=plan.key == current_plan,
            )
        )
    return PlanListResponse(
        currency=CURRENCY, plans=plans, provider_configured=provider_configured()
    )


@router.post("/plan", response_model=PlanSelectResponse)
def select_plan(
    request: PlanSelectRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Activate the plan the user chose for the workspace."""
    _require_verified(current_user)
    state = _state(db, current_user.id)
    _require_step(state, "plan")

    membership = _membership(db, current_user, request.workspace_id)
    if membership.role not in (RoleEnum.OWNER, RoleEnum.ADMIN):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only an owner or an admin can change the plan.",
        )

    plan = get_plan(request.plan)
    if plan is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This plan is not available.",
        )

    subscription = (
        db.query(OrganizationSubscription)
        .filter(OrganizationSubscription.organization_id == request.workspace_id)
        .first()
    )

    if plan.key == "FREE":
        if subscription is None:
            subscription = OrganizationSubscription(
                organization_id=request.workspace_id,
                plan=plan.key,
                status="ACTIVE",
                interval=MONTHLY,
                price_amount=0,
                currency=CURRENCY,
            )
            db.add(subscription)
        else:
            subscription.plan = plan.key
            subscription.status = "ACTIVE"
            subscription.price_amount = 0
            subscription.currency = CURRENCY
        state.plan = plan.key
        _mark_completed(state, "plan")
        db.commit()
        return PlanSelectResponse(
            plan=plan.key,
            label=plan.label,
            status="ACTIVE",
            confirmed=True,
            message="The free plan is active.",
        )

    if plan.contact_sales:
        # The plan is negotiated by sales, the workspace keeps the request.
        state.plan = plan.key
        _mark_completed(state, "plan")
        db.commit()
        return PlanSelectResponse(
            plan=plan.key,
            label=plan.label,
            status="CONTACT_SALES",
            confirmed=True,
            message=(
                "The enterprise plan is set up with our sales team. "
                "We will contact you to finish the configuration."
            ),
        )

    if not plan.purchasable:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                f"The {plan.label} plan cannot be purchased in this "
                "environment because no billing provider is configured."
            ),
        )

    price = plan.price_for(request.interval)
    billing_profile_email = current_user.email
    try:
        session = create_checkout_session(
            organization_id=str(request.workspace_id),
            plan=plan.key,
            interval=request.interval,
            customer_id=subscription.stripe_customer_id if subscription else None,
            billing_email=billing_profile_email,
            success_url=(
                f"{(settings.frontend_url or '').rstrip('/')}"
                "/onboarding/choose-plan?checkout=success"
                f"&workspace={request.workspace_id}"
            ),
            cancel_url=(
                f"{(settings.frontend_url or '').rstrip('/')}"
                "/onboarding/choose-plan?checkout=canceled"
                f"&workspace={request.workspace_id}"
            ),
        )
    except (BillingProviderUnavailable, BillingProviderError) as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="The billing provider is not available right now.",
        ) from error

    now = datetime.now(timezone.utc)
    if subscription is None:
        subscription = OrganizationSubscription(
            organization_id=request.workspace_id,
            plan=plan.key,
            status="PENDING",
            interval=request.interval,
            price_amount=price.amount if price else 0,
            currency=CURRENCY,
        )
        db.add(subscription)
    subscription.checkout_session_id = session["id"]
    subscription.checkout_created_at = now
    db.commit()

    return PlanSelectResponse(
        plan=plan.key,
        label=plan.label,
        status="PENDING",
        confirmed=False,
        checkout_url=session["url"],
        message="Finish the payment to activate the plan.",
    )


@router.post("/join", response_model=OnboardingCompleteResponse)
def join_workspace(
    request: FirstAgentRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Continue the onboarding in a workspace the user already belongs to."""
    _require_verified(current_user)
    state = _state(db, current_user.id)
    membership = _membership(db, current_user, request.workspace_id)

    state.workspace_id = membership.organization_id
    subscription = (
        db.query(OrganizationSubscription)
        .filter(OrganizationSubscription.organization_id == membership.organization_id)
        .first()
    )
    if subscription is not None:
        state.plan = subscription.plan
    for step in ("welcome", "workspace", "workspace_information", "plan"):
        if step not in (state.completed_steps or []):
            state.completed_steps = list(state.completed_steps or []) + [step]
    state.step = "first_agent"
    db.commit()
    return OnboardingCompleteResponse(
        step=state.step,
        completed_steps=list(state.completed_steps or []),
        workspace_id=state.workspace_id,
    )


@router.post(
    "/agent",
    response_model=FirstAgentResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_first_agent(
    request: FirstAgentRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create the first agent of the onboarding flow."""
    _require_verified(current_user)
    state = _state(db, current_user.id)

    if state.agent_id is not None:
        agent = db.query(Agent).filter(Agent.id == state.agent_id).first()
        if agent is not None:
            return FirstAgentResponse(
                id=agent.id,
                name=agent.name,
                description=agent.description,
                created=False,
            )

    membership = _membership(db, current_user, request.workspace_id)
    if membership.role not in (
        RoleEnum.OWNER,
        RoleEnum.ADMIN,
        RoleEnum.DEVELOPER,
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not allowed to create agents in this workspace.",
        )

    agent = Agent(
        organization_id=request.workspace_id,
        name=FIRST_AGENT_TEMPLATE["name"],
        description=FIRST_AGENT_TEMPLATE["description"],
    )
    db.add(agent)
    db.commit()
    db.refresh(agent)

    state.agent_id = agent.id
    _mark_completed(state, "first_agent")
    db.commit()

    record_audit_event(
        db,
        organization_id=request.workspace_id,
        actor_user_id=current_user.id,
        actor_type="user",
        action="agent.created",
        resource_type="agent",
        resource_id=agent.id,
        resource_name=agent.name,
        details={"template": FIRST_AGENT_TEMPLATE["key"]},
        changes={"before": {}, "after": {"name": agent.name}},
        summary=f"{current_user.email} created the first agent.",
    )
    return FirstAgentResponse(
        id=agent.id,
        name=agent.name,
        description=agent.description,
        created=True,
    )


@router.post("/skip", response_model=OnboardingCompleteResponse)
def skip_onboarding(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Finish the onboarding without creating a first agent."""
    state = _state(db, current_user.id)
    _mark_completed(state, "first_agent")
    state.step = "complete"
    db.commit()
    return OnboardingCompleteResponse(
        step=state.step,
        completed_steps=list(state.completed_steps or []),
        workspace_id=state.workspace_id,
    )
