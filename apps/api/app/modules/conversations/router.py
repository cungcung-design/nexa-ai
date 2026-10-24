from uuid import UUID
from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
)
from openai import OpenAIError
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.ai.runtime import ToolApprovalRequired, run_agent
from app.db.models import (
    User,
    Agent,
    Conversation,
    ConversationMessage,
)
from app.db.session import get_db
from app.modules.auth.dependencies import get_current_user
from app.modules.organizations.router import (
    require_membership,
)
from app.modules.conversations.schemas import (
    ConversationCreate,
    ConversationResponse,
    MessageResponse,
    ConversationChatRequest,
    ConversationChatResponse,
)
from app.modules.billing.usage import check_request_quota, record_request_usage
from app.modules.security.rate_limit import enforce_ai_limit

router = APIRouter(
    prefix="/api/v1/organizations/{organization_id}/conversations",
    tags=["Conversations"],
)


def get_owned_conversation(
    db: Session,
    organization_id: UUID,
    conversation_id: UUID,
    user_id: UUID,
    *,
    lock: bool = False,
) -> Conversation:
    statement = select(Conversation).where(
        Conversation.id == conversation_id,
        Conversation.organization_id == organization_id,
        Conversation.created_by == user_id,
    )
    if lock:
        statement = statement.with_for_update()
    conversation = db.scalar(statement)
    if conversation is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found",
        )
    return conversation


@router.post(
    "",
    response_model=ConversationResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_conversation(
    organization_id: UUID,
    payload: ConversationCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_membership(db, user.id, organization_id)

    agent = db.scalar(
        select(Agent).where(
            Agent.id == payload.agent_id,
            Agent.organization_id == organization_id,
            Agent.is_archived.is_(False),
        )
    )
    if agent is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent not found",
        )

    conversation = Conversation(
        organization_id=organization_id,
        agent_id=payload.agent_id,
        title=payload.title,
        created_by=user.id,
    )
    db.add(conversation)
    db.commit()
    db.refresh(conversation)
    return conversation


@router.get(
    "", response_model=list[ConversationResponse]
)
def list_conversations(
    organization_id: UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_membership(db, user.id, organization_id)

    conversations = db.scalars(
        select(Conversation)
        .where(
            Conversation.organization_id
            == organization_id,
            Conversation.created_by == user.id,
        )
        .order_by(Conversation.created_at.desc())
    ).all()
    return conversations


@router.get(
    "/{conversation_id}",
    response_model=ConversationResponse,
)
def get_conversation(
    organization_id: UUID,
    conversation_id: UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_membership(db, user.id, organization_id)
    return get_owned_conversation(
        db,
        organization_id,
        conversation_id,
        user.id,
    )


@router.get(
    "/{conversation_id}/messages",
    response_model=list[MessageResponse],
)
def list_conversation_messages(
    organization_id: UUID,
    conversation_id: UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_membership(db, user.id, organization_id)
    get_owned_conversation(
        db,
        organization_id,
        conversation_id,
        user.id,
    )

    messages = db.scalars(
        select(ConversationMessage)
        .where(
            ConversationMessage.organization_id
            == organization_id,
            ConversationMessage.conversation_id
            == conversation_id,
        )
        .order_by(
            ConversationMessage.created_at.asc(),
            ConversationMessage.id.asc(),
        )
    ).all()
    return messages


@router.post(
    "/{conversation_id}/chat",
    response_model=ConversationChatResponse,
)
def chat_in_conversation(
    organization_id: UUID,
    conversation_id: UUID,
    payload: ConversationChatRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_membership(db, user.id, organization_id)
    enforce_ai_limit(f"user:{user.id}")
    check_request_quota(db, organization_id)

    conversation = get_owned_conversation(
        db,
        organization_id,
        conversation_id,
        user.id,
        lock=True,
    )

    if len(payload.message.strip()) == 0:
        raise HTTPException(
            status_code=422,
            detail="Message cannot be blank",
        )

    try:
        result = run_agent(
            db=db,
            organization_id=organization_id,
            agent_id=conversation.agent_id,
            message=payload.message,
            conversation_id=conversation.id,
        )
    except ValueError:
        raise HTTPException(
            status_code=404,
            detail="Agent unavailable",
        )
    except ToolApprovalRequired as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        )
    except OpenAIError:
        raise HTTPException(
            status_code=502,
            detail="LLM provider request failed",
        )
    except RuntimeError:
        raise HTTPException(
            status_code=502,
            detail="Agent tool execution limit exceeded",
        )

    answer = result.get("answer")
    if not isinstance(answer, str) or not answer.strip():
        raise HTTPException(
            status_code=502,
            detail="LLM provider request failed",
        )
    answer = answer.strip()

    record_request_usage(
        db,
        organization_id,
        prompt_tokens=result.get("prompt_tokens") or 0,
        completion_tokens=result.get("completion_tokens") or 0,
    )

    db.add_all(
        [
            ConversationMessage(
                organization_id=organization_id,
                conversation_id=conversation.id,
                role="user",
                content=payload.message,
            ),
            ConversationMessage(
                organization_id=organization_id,
                conversation_id=conversation.id,
                role="assistant",
                content=answer,
            ),
        ]
    )
    db.commit()

    return ConversationChatResponse(
        conversation_id=conversation.id,
        answer=answer,
        model=result["model"],
        sources=result["sources"],
        prompt_tokens=result["prompt_tokens"],
        completion_tokens=result["completion_tokens"],
    )
