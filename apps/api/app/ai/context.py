from uuid import UUID
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.db.models import ConversationMessage

MAX_HISTORY_MESSAGES = 12
MAX_HISTORY_CHARS = 12000


def load_recent_history(
    db: Session,
    organization_id: UUID,
    conversation_id: UUID,
) -> list[dict[str, str]]:
    rows = db.scalars(
        select(ConversationMessage)
        .where(
            ConversationMessage.organization_id
            == organization_id,
            ConversationMessage.conversation_id
            == conversation_id,
            ConversationMessage.role.in_(
                ["user", "assistant"]
            ),
        )
        .order_by(
            ConversationMessage.created_at.desc(),
            ConversationMessage.id.desc(),
        )
        .limit(MAX_HISTORY_MESSAGES)
    ).all()

    selected = []
    remaining_chars = MAX_HISTORY_CHARS
    for row in rows:
        if len(row.content) > remaining_chars:
            break
        selected.append(
            {
                "role": row.role,
                "content": row.content,
            }
        )
        remaining_chars -= len(row.content)
    selected.reverse()
    return selected
