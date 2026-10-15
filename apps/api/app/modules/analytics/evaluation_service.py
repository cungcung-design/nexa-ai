from time import perf_counter
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.analytics.evaluation import evaluate_contains
from app.modules.analytics.models import (
    AIEvaluationCase,
    AIEvaluationResult,
)


class EvaluationNotFound(Exception):
    pass


def evaluate_case(
    db: Session,
    organization_id: UUID,
    case_id: UUID,
    actual_response: str,
    latency_ms: int,
) -> AIEvaluationResult:
    case = db.scalar(
        select(AIEvaluationCase).where(
            AIEvaluationCase.id == case_id,
            AIEvaluationCase.organization_id == organization_id,
        )
    )

    if case is None:
        raise EvaluationNotFound()

    evaluation = evaluate_contains(actual_response, case.expected_substring)

    result = AIEvaluationResult(
        organization_id=organization_id,
        case_id=case_id,
        agent_id=case.agent_id,
        passed=evaluation.passed,
        latency_ms=latency_ms,
    )
    db.add(result)
    db.commit()
    db.refresh(result)
    return result