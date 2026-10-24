from uuid import UUID, uuid4
from datetime import datetime, timezone
from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
)
from sqlalchemy import select, func, and_
from sqlalchemy.orm import Session
from app.db.models import (
    User,
    Agent,
    WorkflowApproval,
    Role,
)
from app.db.session import get_db
from app.modules.auth.dependencies import get_current_user
from app.modules.organizations.router import (
    require_membership,
)
from app.modules.approvals.schemas import (
    ApprovalListItem,
    ApprovalDecision,
    ApprovalResponse,
    ApprovalDetail,
    ApprovalPolicyBase,
    ApprovalPolicyCreate,
    ApprovalPolicyUpdate,
    ApprovalAssignmentBase,
    ApprovalAssignmentCreate,
    ApprovalStats,
)
from app.modules.workflows.router import apply_workflow_decision

router = APIRouter(
    prefix="/api/v1/organizations/{organization_id}/approvals",
    tags=["Approvals"],
)

APPROVAL_ROLES = [Role.OWNER, Role.ADMIN]
REVIEW_ROLES = [Role.OWNER, Role.ADMIN, Role.DEVELOPER]


def require_approval_role(
    db: Session,
    user_id: UUID,
    organization_id: UUID,
) -> None:
    membership = require_membership(
        db, user_id, organization_id
    )
    if membership.role not in APPROVAL_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Owners and Admins can manage approvals",
        )


def require_review_role(
    db: Session,
    user_id: UUID,
    organization_id: UUID,
) -> None:
    membership = require_membership(
        db, user_id, organization_id
    )
    if membership.role not in REVIEW_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Owners, Admins and Developers can review approvals",
        )


@router.get("", response_model=list[ApprovalListItem])
def list_approvals(
    organization_id: UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_review_role(db, user.id, organization_id)

    approvals = db.scalars(
        select(WorkflowApproval)
        .where(
            WorkflowApproval.organization_id == organization_id
        )
        .order_by(WorkflowApproval.created_at.desc())
    ).all()

    return [
        ApprovalListItem(
            id=a.id,
            status=a.status,
            action=a.action,
            thread_id=a.thread_id,
            requested_by=a.requested_by,
            created_at=(
                a.created_at.isoformat()
                if a.created_at
                else ""
            ),
        )
        for a in approvals
    ]


@router.get("/stats", response_model=ApprovalStats)
def approval_stats(
    organization_id: UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_review_role(db, user.id, organization_id)

    today = datetime.now(timezone.utc).date()
    today_start = datetime(today.year, today.month, today.day, tzinfo=timezone.utc)

    total = db.scalars(
        select(WorkflowApproval).where(
            WorkflowApproval.organization_id == organization_id
        )
    ).all()

    pending = sum(1 for a in total if a.status == "PENDING")
    approved_today = sum(
        1 for a in total
        if a.status == "APPROVED"
        and a.decided_at
        and a.decided_at >= today_start
    )
    rejected_today = sum(
        1 for a in total
        if a.status == "REJECTED"
        and a.decided_at
        and a.decided_at >= today_start
    )
    expired = sum(1 for a in total if a.status == "EXPIRED")

    return ApprovalStats(
        pending=pending,
        approved_today=approved_today,
        rejected_today=rejected_today,
        expired=expired,
    )


@router.get("/{approval_id}", response_model=ApprovalDetail)
def get_approval(
    organization_id: UUID,
    approval_id: UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_review_role(db, user.id, organization_id)

    approval = db.scalar(
        select(WorkflowApproval).where(
            WorkflowApproval.id == approval_id,
            WorkflowApproval.organization_id == organization_id,
        )
    )
    if not approval:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Approval not found",
        )

    return ApprovalDetail(
        id=approval.id,
        organization_id=approval.organization_id,
        agent_id=approval.agent_id,
        thread_id=approval.thread_id,
        action=approval.action,
        arguments=approval.arguments,
        status=approval.status,
        requested_by=approval.requested_by,
        decided_by=approval.decided_by,
        decided_at=(
            approval.decided_at.isoformat()
            if approval.decided_at
            else None
        ),
        created_at=(
            approval.created_at.isoformat()
            if approval.created_at
            else ""
        ),
        execution_status=None,
        execution_result=None,
        policy_id=None,
        assigned_reviewer=None,
    )


@router.post(
    "/{approval_id}/decision",
    response_model=ApprovalResponse,
)
def decide_approval(
    organization_id: UUID,
    approval_id: UUID,
    payload: ApprovalDecision,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Record a dashboard decision by resuming the checkpointed workflow."""
    return apply_workflow_decision(
        db,
        organization_id=organization_id,
        approval_id=approval_id,
        user=user,
        approved=payload.approved,
    )


@router.get("/history", response_model=list[ApprovalListItem])
def approval_history(
    organization_id: UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_review_role(db, user.id, organization_id)

    approvals = db.scalars(
        select(WorkflowApproval)
        .where(
            WorkflowApproval.organization_id == organization_id,
            WorkflowApproval.status != "PENDING",
        )
        .order_by(WorkflowApproval.created_at.desc())
    ).all()

    return [
        ApprovalListItem(
            id=a.id,
            status=a.status,
            action=a.action,
            thread_id=a.thread_id,
            requested_by=a.requested_by,
            created_at=(
                a.created_at.isoformat()
                if a.created_at
                else ""
            ),
        )
        for a in approvals
    ]


# --- Policies ---

@router.get("/policies", response_model=list[ApprovalPolicyBase])
def list_policies(
    organization_id: UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_review_role(db, user.id, organization_id)

    # Placeholder: policies stored in-memory until ApprovalPolicy model is added
    return []


@router.post("/policies", response_model=ApprovalPolicyBase, status_code=status.HTTP_201_CREATED)
def create_policy(
    organization_id: UUID,
    payload: ApprovalPolicyCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_approval_role(db, user.id, organization_id)

    # Placeholder: policy creation persisted once ApprovalPolicy model exists
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Policy storage not yet implemented",
    )


@router.get("/policies/{policy_id}", response_model=ApprovalPolicyBase)
def get_policy(
    organization_id: UUID,
    policy_id: UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_review_role(db, user.id, organization_id)
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Policy storage not yet implemented",
    )


@router.patch("/policies/{policy_id}", response_model=ApprovalPolicyBase)
def update_policy(
    organization_id: UUID,
    policy_id: UUID,
    payload: ApprovalPolicyUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_approval_role(db, user.id, organization_id)
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Policy storage not yet implemented",
    )


# --- Assignments ---

@router.get("/assignments", response_model=list[ApprovalAssignmentBase])
def list_assignments(
    organization_id: UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_approval_role(db, user.id, organization_id)
    return []


@router.post("/assignments", response_model=ApprovalAssignmentBase, status_code=status.HTTP_201_CREATED)
def create_assignment(
    organization_id: UUID,
    payload: ApprovalAssignmentCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_approval_role(db, user.id, organization_id)
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Assignment storage not yet implemented",
    )


@router.delete("/assignments/{assignment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_assignment(
    organization_id: UUID,
    assignment_id: UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_approval_role(db, user.id, organization_id)
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Assignment storage not yet implemented",
    )
