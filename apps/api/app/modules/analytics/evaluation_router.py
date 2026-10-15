from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.modules.auth.dependencies import get_current_user
from app.modules.analytics.evaluation_runner import (
    run_evaluation,
    EvaluationCaseNotFound,
)
from app.core.permissions import Permission
from app.core.tenant_security import require_permission
from app.modules.analytics.models import AIEvaluationResult
from app.modules.organizations.router import require_membership
from sqlalchemy import select


router = APIRouter(
    prefix="/api/v1/organizations/{organization_id}/evaluations",
    tags=["AI Evaluations"],
)


class EvaluationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    organization_id: UUID
    case_id: UUID
    agent_id: UUID
    passed: bool
    latency_ms: int
    # score and reason omitted as per existing model


@router.post(
    "/cases/{case_id}/run",
    response_model=EvaluationResponse,
)
def execute_evaluation(
    organization_id: UUID,
    case_id: UUID,
    db: Session = Depends(get_db),
    membership=Depends(
        require_permission(Permission.EVALUATION_RUN)
    ),
):
    try:
        return run_evaluation(
            db=db,
            organization_id=organization_id,
            case_id=case_id,
        )

    except EvaluationCaseNotFound:
        raise HTTPException(
            status_code=404,
            detail="Evaluation case not found",
        )


@router.get("/results", response_model=list[EvaluationResponse])
def list_evaluation_results(
    organization_id: UUID,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    require_membership(
        db,
        current_user.id,
        organization_id,
        allowed_roles=[
            "OWNER",
            "ADMIN",
            "DEVELOPER",
            "VIEWER",
        ],
    )

    statement = (
        select(AIEvaluationResult)
        .where(
            AIEvaluationResult.organization_id
            == organization_id
        )
        .order_by(
            AIEvaluationResult.created_at.desc()
        )
        .limit(50)
    )

    results = db.scalars(statement).all()
    return results