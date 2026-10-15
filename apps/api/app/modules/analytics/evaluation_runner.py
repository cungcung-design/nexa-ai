from time import perf_counter
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.ai.runtime import run_agent
from app.modules.analytics.evaluation import evaluate_contains
from app.modules.analytics.models import (
    AIEvaluationCase,
    AIEvaluationResult,
)


class EvaluationCaseNotFound(Exception):
    pass


def run_evaluation(
    db: Session,
    organization_id: UUID,
    case_id: UUID,
) -> AIEvaluationResult:
    # 1. Find the case inside the authenticated organization.
    case = db.scalar(
        select(AIEvaluationCase).where(
            AIEvaluationCase.id == case_id,
            AIEvaluationCase.organization_id == organization_id,
        )
    )

    if case is None:
        raise EvaluationCaseNotFound()

    # 2. Run the agent with the case's input to get the actual response
    # Measure latency
    start_time = perf_counter()
    
    try:
        # Run the agent
        agent_result = run_agent(
            db=db,
            organization_id=organization_id,
            agent_id=case.agent_id,
            message=case.input,
        )
        
        actual_response = agent_result.get("answer", "")
        
    except Exception as e:
        # If agent execution fails, we still want to record the attempt
        # but mark it as failed
        actual_response = f"Agent execution failed: {str(e)}"
    
    end_time = perf_counter()
    latency_ms = int((end_time - start_time) * 1000)

    # 3. Evaluate the response
    evaluation = evaluate_contains(actual_response, case.expected_substring)

    # 4. Save the evaluation result
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