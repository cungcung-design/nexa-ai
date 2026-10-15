from uuid import UUID, uuid4
from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
)
from sqlalchemy import select
from sqlalchemy.orm import Session
from langgraph.types import Command
from app.ai.workflows.approval import approval_graph
from app.db.models import (
    User,
    Agent,
    WorkflowApproval,
    Role,
    utc_now,
)
from app.db.session import get_db
from app.modules.auth.dependencies import get_current_user
from app.modules.organizations.router import (
    require_membership,
)
from app.modules.workflows.schemas import (
    DemoActionRequest,
    ApprovalDecision,
    ApprovalResponse,
    ApprovalListItem,
)

router = APIRouter(
    prefix="/api/v1/organizations/{organization_id}/workflows",
    tags=["Workflows"],
)

APPROVAL_ROLES = [Role.OWNER, Role.ADMIN]
ACTION_ROLES = [Role.OWNER, Role.ADMIN, Role.DEVELOPER]


def require_owner_or_admin(
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


def require_action_role(
    db: Session,
    user_id: UUID,
    organization_id: UUID,
) -> None:
    membership = require_membership(
        db, user_id, organization_id
    )
    if membership.role not in ACTION_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Owners, Admins and Developers can request actions",
        )


@router.post(
    "/demo-action", response_model=ApprovalResponse
)
def request_demo_action(
    organization_id: UUID,
    payload: DemoActionRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_action_role(db, user.id, organization_id)

    agent = db.scalar(
        select(Agent).where(
            Agent.id == payload.agent_id,
            Agent.organization_id == organization_id,
            Agent.is_archived.is_(False),
        )
    )
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent not found",
        )

    thread_id = str(uuid4())
    approval = WorkflowApproval(
        organization_id=organization_id,
        agent_id=payload.agent_id,
        thread_id=thread_id,
        action="demo_create_note",
        arguments={"note": payload.note},
        requested_by=user.id,
        status="PENDING",
    )
    db.add(approval)
    db.commit()
    db.refresh(approval)

    config = {"configurable": {"thread_id": thread_id}}
    approval_graph.invoke(
        {
            "organization_id": str(organization_id),
            "agent_id": str(payload.agent_id),
            "action": "demo_create_note",
            "arguments": {"note": payload.note},
        },
        config=config,
    )

    return ApprovalResponse(
        id=approval.id,
        status=approval.status,
        action=approval.action,
        thread_id=approval.thread_id,
    )


@router.get(
    "/approvals", response_model=list[ApprovalListItem]
)
def list_approvals(
    organization_id: UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_owner_or_admin(db, user.id, organization_id)

    approvals = db.scalars(
        select(WorkflowApproval)
        .where(
            WorkflowApproval.organization_id
            == organization_id
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


@router.post(
    "/approvals/{approval_id}/decision",
    response_model=ApprovalResponse,
)
def decide_approval(
    organization_id: UUID,
    approval_id: UUID,
    payload: ApprovalDecision,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_owner_or_admin(db, user.id, organization_id)

    approval = db.scalar(
        select(WorkflowApproval).where(
            WorkflowApproval.id == approval_id,
            WorkflowApproval.organization_id
            == organization_id,
        )
    )
    if not approval:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Approval not found",
        )

    if approval.status != "PENDING":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Approval already decided",
        )

    config = {"configurable": {"thread_id": approval.thread_id}}
    try:
        approval_graph.invoke(
            Command(resume=payload.approved),
            config=config,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Workflow execution failed: {exc}",
        )

    approval.status = (
        "APPROVED" if payload.approved else "REJECTED"
    )
    approval.decided_by = user.id
    approval.decided_at = utc_now()
    db.commit()
    db.refresh(approval)

    return ApprovalResponse(
        id=approval.id,
        status=approval.status,
        action=approval.action,
        thread_id=approval.thread_id,
    )
