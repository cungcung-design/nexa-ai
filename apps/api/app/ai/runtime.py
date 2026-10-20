import json
from uuid import UUID, uuid4
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
from app.modules.settings.service import (
    SettingsValidationError,
    enforce_resolution,
    resolve_effective_config,
    store_run_snapshot,
)

MAX_TOOL_ROUNDS = 3


class ToolApprovalRequired(RuntimeError):
    """Raised when a workspace policy requires approval for tool calls."""


def _select_version(
    db: Session,
    organization_id: UUID,
    agent: Agent,
    version_id: UUID | None,
) -> AgentVersion:
    """Return the version that is executed for this run.

    The published version is used by default. A caller may select another
    version of the same agent explicitly, which is what the agent and
    workflow screens do when a specific version is picked.
    """
    if version_id is not None:
        version = db.scalar(
            select(AgentVersion).where(
                AgentVersion.id == version_id,
                AgentVersion.agent_id == agent.id,
                AgentVersion.organization_id == organization_id,
            )
        )
        if version is None:
            raise ValueError("Agent version not found")
        return version

    if agent.published_version_id is None:
        raise ValueError("Agent has no published version")

    version = db.scalar(
        select(AgentVersion).where(
            AgentVersion.id == agent.published_version_id,
            AgentVersion.agent_id == agent.id,
            AgentVersion.organization_id == organization_id,
        )
    )
    if version is None:
        raise ValueError("Published version not found")
    return version


def _run_agent_impl(
    db: Session,
    organization_id: UUID,
    agent_id: UUID,
    message: str,
    conversation_id: UUID | None = None,
    version_id: UUID | None = None,
    workflow_key: str | None = None,
    run_override: dict | None = None,
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

    version = _select_version(db, organization_id, agent, version_id)

    # The effective configuration is resolved on the backend before the run
    # starts. Workspace policies are applied on top of the resolved value
    # and can never be weakened by an override.
    try:
        resolved = resolve_effective_config(
            db,
            organization_id,
            version,
            workflow_key=workflow_key,
            run_override=run_override,
        )
        enforce_resolution(db, organization_id, resolved)
    except SettingsValidationError as exc:
        raise ToolApprovalRequired(str(exc)) from exc

    effective = resolved["settings"]
    model = effective["model"]["value"]
    temperature = effective["temperature"]["value"]
    tool_policy = effective["tool_approval_policy"]["value"]

    run_id = str(uuid4())
    store_run_snapshot(
        db,
        organization_id=organization_id,
        agent_id=agent.id,
        agent_version_id=version.id,
        workflow_key=workflow_key,
        run_id=run_id,
        resolved=resolved,
    )

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
                model=model,
                messages=messages,
                temperature=temperature,
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

        if tool_policy == "require":
            raise ToolApprovalRequired(
                "This workspace requires approval before a tool can run. Use "
                "the approval flow to run this action."
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
        "run_id": run_id,
        "answer": answer,
        "sources": sources,
        "model": model,
        "temperature": temperature,
        "resolved_config": {
            key: value.get("value") for key, value in effective.items()
        },
        "config_sources": {
            key: value.get("source") for key, value in effective.items()
        },
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
    version_id: UUID | None = None,
    workflow_key: str | None = None,
    run_override: dict | None = None,
) -> dict:
    """Run an agent with tracing.

    ``version_id`` selects the agent version that is executed, ``workflow_key``
    and ``run_override`` feed the workflow and run levels of the configuration
    inheritance.
    """
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
            version_id=version_id,
            workflow_key=workflow_key,
            run_override=run_override,
        )

        # Only use token values actually reported
        # by the model provider.
        usage = result.get("usage") or {}

        set_trace_usage(
            prompt_tokens=usage.get("prompt_tokens"),
            completion_tokens=usage.get("completion_tokens"),
        )

        return result
