from uuid import UUID
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.ai.llm import get_llm_client
from app.db.models import Agent, AgentVersion


def run_public_agent(
    db: Session,
    organization_id: UUID,
    agent_id: UUID,
    message: str,
) -> dict:
    agent = db.scalar(
        select(Agent).where(
            Agent.id == agent_id,
            Agent.organization_id == organization_id,
            Agent.is_archived.is_(False),
        )
    )
    if agent is None or not agent.published_version_id:
        raise ValueError("Agent unavailable")

    version = db.scalar(
        select(AgentVersion).where(
            AgentVersion.id == agent.published_version_id,
            AgentVersion.agent_id == agent_id,
            AgentVersion.organization_id == organization_id,
        )
    )
    if version is None:
        raise ValueError("Published version not found")

    client = get_llm_client()
    messages = [
        {
            "role": "system",
            "content": version.system_prompt,
        },
        {
            "role": "user",
            "content": message,
        },
    ]

    completion = client.chat.completions.create(
        model=version.model,
        messages=messages,
        temperature=version.temperature,
        max_tokens=version.max_tokens,
    )

    answer = completion.choices[0].message.content or ""
    usage = completion.usage

    return {
        "answer": answer,
        "model": version.model,
        "prompt_tokens": usage.prompt_tokens if usage else None,
        "completion_tokens": usage.completion_tokens if usage else None,
    }