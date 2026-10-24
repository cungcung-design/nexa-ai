from uuid import UUID
from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
)
from sqlalchemy.orm import Session
from openai import OpenAIError
from app.ai.runtime import run_agent, ToolApprovalRequired
from app.db.models import User
from app.db.session import get_db
from app.modules.auth.dependencies import (
    get_current_user,
)
from app.modules.organizations.router import (
    require_membership,
)
from app.modules.agents.chat_schemas import (
    AgentChatRequest,
    AgentChatResponse,
)
from app.modules.billing.usage import check_request_quota, record_request_usage
from app.modules.security.rate_limit import enforce_ai_limit

router = APIRouter(
    prefix="/api/v1/organizations/{organization_id}/agents",
    tags=["Agent Chat"],
)


@router.post(
    "/{agent_id}/chat",
    response_model=AgentChatResponse,
)
def chat_with_agent(
    organization_id: UUID,
    agent_id: UUID,
    payload: AgentChatRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_membership(db, user.id, organization_id)
    enforce_ai_limit(f"user:{user.id}")
    check_request_quota(db, organization_id)

    try:
        result = run_agent(
            db=db,
            organization_id=organization_id,
            agent_id=agent_id,
            message=payload.message,
            version_id=payload.version_id,
            run_override=(
                payload.overrides.model_dump(exclude_none=True)
                if payload.overrides
                else None
            ),
        )
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent not found or has no published version",
        )
    except ToolApprovalRequired as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        )
    except OpenAIError:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="LLM provider request failed",
        )
    except RuntimeError:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Agent tool execution limit exceeded",
        )

    if not isinstance(result.get("answer"), str) or not result["answer"].strip():
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="LLM provider request failed",
        )
    result["answer"] = result["answer"].strip()

    record_request_usage(
        db,
        organization_id,
        prompt_tokens=result.get("prompt_tokens") or 0,
        completion_tokens=result.get("completion_tokens") or 0,
    )
    return AgentChatResponse(**result)
