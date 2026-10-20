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
    AgentVersion,
    WorkflowApproval,
    Role,
    utc_now,
)
from app.db.session import get_db
from app.modules.auth.dependencies import get_current_user
from app.modules.billing.usage import (
    check_workflow_quota,
    record_workflow_execution,
)
from app.modules.organizations.router import (
    require_membership,
)
from app.modules.workflows.schemas import (
    DemoActionRequest,
    ApprovalDecision,
    ApprovalResponse,
    ApprovalListItem,
)
from app.modules.security.audit import record_audit_event
from app.modules.settings.service import (
    resolve_effective_config,
    store_run_snapshot,
)

router = APIRouter(
    prefix="/api/v1/organizations/{organization_id}/workflows",
    tags=["Workflows"],
)

#: Stable key of the workflow that is executed. Workflow level configuration
#: overrides are stored against this key.
WORKFLOW_KEY = "demo_create_note"

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


def _resolve_workflow_config(
    db: Session,
    organization_id: UUID,
    agent: Agent,
) -> dict | None:
    """Resolve the configuration a workflow run is executed with."""
    if agent.published_version_id is None:
        return None
    version = db.scalar(
        select(AgentVersion).where(
            AgentVersion.id == agent.published_version_id,
            AgentVersion.agent_id == agent.id,
            AgentVersion.organization_id == organization_id,
        )
    )
    if version is None:
        return None
    resolved = resolve_effective_config(
        db,
        organization_id,
        version,
        workflow_key=WORKFLOW_KEY,
    )
    return {
        "agent_version_id": version.id,
        "resolved": resolved,
    }


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
    check_workflow_quota(db, organization_id)

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

    # The effective configuration is resolved before the workflow runs and
    # frozen as a snapshot, so later settings changes never rewrite what this
    # run used.
    resolved = _resolve_workflow_config(db, organization_id, agent)
    if resolved is not None:
        store_run_snapshot(
            db,
            organization_id=organization_id,
            agent_id=agent.id,
            agent_version_id=resolved["agent_version_id"],
            workflow_key=WORKFLOW_KEY,
            run_id=thread_id,
            resolved=resolved["resolved"],
        )

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

    record_audit_event(
        db,
        organization_id=organization_id,
        actor_user_id=user.id,
        action="approval.created",
        resource_type="approval",
        resource_id=approval.id,
        resource_name=agent.name,
        details={
            "thread_id": thread_id,
            "agent_id": str(payload.agent_id),
            "action": "demo_create_note",
        },
        summary=(
            f"{user.email} requested the protected action "
            f"“demo_create_note” on agent “{agent.name}”."
        ),
    )

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
    record_workflow_execution(db, organization_id)

    record_audit_event(
        db,
        organization_id=organization_id,
        actor_user_id=user.id,
        action="workflow.execution_requested",
        resource_type="approval",
        resource_id=approval.id,
        resource_name=agent.name,
        details={
            "thread_id": thread_id,
            "agent_id": str(payload.agent_id),
            "action": "demo_create_note",
        },
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
    execution_result: dict | None = None
    execution_failed = False
    failure_reason: str | None = None
    try:
        graph_result = approval_graph.invoke(
            Command(resume=payload.approved),
            config=config,
        )
        execution_result = (
            graph_result.get("result") if isinstance(graph_result, dict) else None
        )
    except Exception as exc:
        execution_failed = True
        failure_reason = str(exc)
        record_audit_event(
            db,
            organization_id=organization_id,
            actor_user_id=user.id,
            action="execution.failed",
            resource_type="approval",
            resource_id=approval.id,
            resource_name=approval.action,
            outcome="failed",
            details={
                "thread_id": approval.thread_id,
                "agent_id": str(approval.agent_id),
                "error": failure_reason,
            },
            summary=f"The workflow execution for “{approval.action}” failed.",
        )
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

    # The decision and the execution outcome are recorded as two separate
    # events so that an approval is never shown as proof of execution.
    record_audit_event(
        db,
        organization_id=organization_id,
        actor_user_id=user.id,
        action=(
            "approval.approved" if payload.approved else "approval.rejected"
        ),
        resource_type="approval",
        resource_id=approval.id,
        resource_name=approval.action,
        details={
            "thread_id": approval.thread_id,
            "agent_id": str(approval.agent_id),
            "decision": approval.status,
        },
        summary=(
            f"{user.email} "
            f"{'approved' if payload.approved else 'rejected'} the request "
            f"“{approval.action}”."
        ),
    )

    record_audit_event(
        db,
        organization_id=organization_id,
        actor_user_id=user.id,
        action="execution.failed" if execution_failed else "execution.completed",
        resource_type="approval",
        resource_id=approval.id,
        resource_name=approval.action,
        outcome="failed" if execution_failed else "success",
        details={
            "thread_id": approval.thread_id,
            "agent_id": str(approval.agent_id),
            "result": execution_result,
            "error": failure_reason,
        },
        summary=(
            f"The workflow execution for “{approval.action}” "
            f"{'failed' if execution_failed else 'completed'}."
        ),
    )

    return ApprovalResponse(
        id=approval.id,
        status=approval.status,
        action=approval.action,
        thread_id=approval.thread_id,
    )
