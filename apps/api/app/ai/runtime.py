import json
from uuid import UUID
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.ai.llm import get_llm_client
from app.ai.retrieval import retrieve_context
from app.ai.context import load_recent_history
from app.ai.tools import (
    TOOL_DEFINITIONS,
    execute_tool,
)
from app.db.models import Agent, AgentVersion
from app.modules.analytics.tracing import trace_agent_request, set_trace_usage, trace_span

MAX_TOOL_ROUNDS = 3


def _run_agent_impl(
    db: Session,
    organization_id: UUID,
    agent_id: UUID,
    message: str,
    conversation_id: UUID | None = None,
) -> dict:
    agent = db.scalar(
        select(Agent).where(
            Agent.id == agent_id,
            Agent.organization_id == organization_id,
            Agent.is_archived.is_(False),
        )
    )
    if agent is None:
        raise ValueError("Agent not found")

    if agent.published_version_id is None:
        raise ValueError("Agent has no published version")

    version = db.scalar(
        select(AgentVersion).where(
            AgentVersion.id == agent.published_version_id,
            AgentVersion.agent_id == agent_id,
            AgentVersion.organization_id == organization_id,
        )
    )
    if version is None:
        raise ValueError("Published version not found")

    # Knowledge retrieval with tracing
    with trace_span("knowledge_retrieval"):
        context_chunks = retrieve_context(
            db=db,
            organization_id=organization_id,
            query=message,
            limit=5,
        )

    context_text = "\n\n".join(
        f"[{i + 1}] {chunk['content']} "
        f"(Source: {chunk['filename']})"
        for i, chunk in enumerate(context_chunks)
    )

    system_prompt = version.system_prompt
    if context_text:
        system_prompt += (
            "\n\nUse the following retrieved context to "
            "answer the user's question. Cite the relevant "
            "source as [Source N] where N is the bracketed "
            "number of the context item.\n\n"
            f"Retrieved context:\n{context_text}"
        )

    client = get_llm_client()
    history = []
    if conversation_id is not None:
        history = load_recent_history(
            db=db,
            organization_id=organization_id,
            conversation_id=conversation_id,
        )
    messages = [
        {
            "role": "system",
            "content": system_prompt,
        },
        *history,
        {
            "role": "user",
            "content": message,
        },
    ]

    tool_rounds = 0
    usage = None

    while True:
        # LLM request with tracing
        with trace_span("llm_call"):
            completion = client.chat.completions.create(
                model=version.model,
                messages=messages,
                temperature=version.temperature,
                max_tokens=version.max_tokens,
                tools=TOOL_DEFINITIONS,
            )
        usage = completion.usage
        choice = completion.choices[0]
        assistant_message = choice.message

        if not assistant_message.tool_calls:
            answer = assistant_message.content or ""
            break

        tool_rounds += 1
        if tool_rounds > MAX_TOOL_ROUNDS:
            raise RuntimeError(
                "Tool execution limit exceeded"
            )

        messages.append(
            {
                "role": "assistant",
                "content": assistant_message.content,
                "tool_calls": [
                    {
                        "id": tool_call.id,
                        "type": "function",
                        "function": {
                            "name": (
                                tool_call.function.name
                            ),
                            "arguments": (
                                tool_call.function.arguments
                            ),
                        },
                    }
                    for tool_call in (
                        assistant_message.tool_calls
                    )
                ],
            }
        )

        for tool_call in assistant_message.tool_calls:
            tool_name = tool_call.function.name
            try:
                tool_arguments = json.loads(
                    tool_call.function.arguments
                    or "{}"
                )
            except json.JSONDecodeError:
                tool_arguments = {}
            
            # Tool execution with tracing
            with trace_span("tool_execution"):
                try:
                    tool_result = execute_tool(
                        tool_name, tool_arguments
                    )
                except ValueError as exc:
                    tool_result = {"error": str(exc)}
            
            messages.append(
                {
                    "role": "tool",
                    "tool_call_id": tool_call.id,
                    "content": json.dumps(tool_result),
                }
            )

    sources = [
        {
            "document_id": chunk["document_id"],
            "filename": chunk["filename"],
            "chunk_index": chunk["chunk_index"],
            "distance": chunk["distance"],
        }
        for chunk in context_chunks
    ]

    return {
        "agent_id": agent.id,
        "version_id": version.id,
        "answer": answer,
        "sources": sources,
        "model": version.model,
        "prompt_tokens": (
            usage.prompt_tokens if usage else None
        ),
        "completion_tokens": (
            usage.completion_tokens if usage else None
        ),
    }


def run_agent(
    db: Session,
    organization_id: UUID,
    agent_id: UUID,
    message: str,
    conversation_id: UUID | None = None,
) -> dict:
    """Run an agent with tracing."""
    with trace_agent_request(
        organization_id=organization_id,
        agent_id=agent_id,
    ) as context:
        result = _run_agent_impl(
            db=db,
            organization_id=organization_id,
            agent_id=agent_id,
            message=message,
            conversation_id=conversation_id,
        )

        # Only use token values actually reported
        # by the model provider.
        usage = result.get("usage") or {}

        set_trace_usage(
            prompt_tokens=usage.get("prompt_tokens"),
            completion_tokens=usage.get("completion_tokens"),
        )

        return result
