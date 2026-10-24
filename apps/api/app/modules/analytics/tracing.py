import json
import logging
from contextlib import contextmanager
from contextvars import ContextVar
from dataclasses import dataclass, field
from time import perf_counter
from typing import Any
from uuid import UUID

from app.db.session import SessionLocal
from app.modules.analytics.models import (
    AIRequestTrace,
    AIExecutionSpan,
)

logger = logging.getLogger(__name__)


@dataclass
class TraceContext:
    organization_id: UUID
    agent_id: UUID
    started: float = field(default_factory=perf_counter)
    status: str = "success"
    error_code: str | None = None
    prompt_tokens: int = 0
    completion_tokens: int = 0
    model: str | None = None
    agent_version_id: UUID | None = None
    spans: list[dict] = field(default_factory=list)


class _SpanHandle:
    """A handle for the span that is currently open."""

    def __init__(self, record: dict):
        self._record = record

    def set_detail(self, detail: dict | None) -> None:
        self._record["detail"] = detail


def sanitize_detail(detail: Any) -> dict | None:
    """Keep only span facts that are safe to show.

    Tool arguments, prompts, and credential-like keys are dropped.
    """
    if not isinstance(detail, dict):
        return None
    clean: dict = {}
    model = detail.get("model")
    if isinstance(model, str) and model.strip():
        clean["model"] = model.strip()[:200]
    tool_name = detail.get("tool_name")
    if isinstance(tool_name, str) and tool_name.strip():
        clean["tool_name"] = tool_name.strip()[:80]
    sources = detail.get("sources")
    if isinstance(sources, list):
        clean_sources = []
        for item in sources[:20]:
            if not isinstance(item, dict):
                continue
            filename = item.get("filename")
            if not isinstance(filename, str) or not filename.strip():
                continue
            source = {"filename": filename.strip()[:200]}
            document_id = item.get("document_id")
            if isinstance(document_id, str) and document_id.strip():
                source["document_id"] = document_id.strip()[:80]
            clean_sources.append(source)
        if clean_sources:
            clean["sources"] = clean_sources
    return clean or None


def public_span_detail(raw: str | None) -> dict | None:
    """Read a stored span detail and drop anything that is not allowlisted."""
    if not raw:
        return None
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        return None
    return sanitize_detail(parsed)


# Context variable to store the current trace context
_current_trace: ContextVar[TraceContext | None] = ContextVar('_current_trace', default=None)


@contextmanager
def trace_agent_request(
    organization_id: UUID,
    agent_id: UUID,
):
    """Trace an agent request from start to finish."""
    # Create a new trace context
    context = TraceContext(
        organization_id=organization_id,
        agent_id=agent_id,
    )
    
    # Set the context variable
    token = _current_trace.set(context)
    
    try:
        yield context
    except Exception as e:
        # Mark the trace as having an error
        context.status = "error"
        context.error_code = "AGENT_EXECUTION_FAILED"
        raise
    finally:
        # Calculate latency and save the trace
        latency_ms = int((perf_counter() - context.started) * 1000)
        
        # Save to database in a separate session to avoid interference
        db = SessionLocal()
        try:
            trace = AIRequestTrace(
                organization_id=organization_id,
                agent_id=agent_id,
                status=context.status,
                error_code=context.error_code,
                latency_ms=latency_ms,
                prompt_tokens=context.prompt_tokens,
                completion_tokens=context.completion_tokens,
                model=context.model,
                agent_version_id=context.agent_version_id,
            )
            db.add(trace)
            db.commit()
            db.refresh(trace)

            for span_data in context.spans:
                detail = span_data.get("detail")
                span = AIExecutionSpan(
                    trace_id=trace.id,
                    organization_id=organization_id,
                    name=span_data["name"],
                    duration_ms=span_data["duration_ms"],
                    status=span_data["status"],
                    error_code=span_data.get("error_code"),
                    detail=json.dumps(detail) if detail else None,
                )
                db.add(span)
            db.commit()
        except Exception:
            logger.error("Could not store the agent execution trace")
            db.rollback()
        finally:
            db.close()
        
        # Reset the context variable
        _current_trace.reset(token)


def set_trace_usage(prompt_tokens: int | None, completion_tokens: int | None):
    """Set token usage for the current trace."""
    context = _current_trace.get()
    if context is not None:
        if prompt_tokens is not None:
            context.prompt_tokens = prompt_tokens
        if completion_tokens is not None:
            context.completion_tokens = completion_tokens


def set_trace_metadata(
    model: str | None,
    agent_version_id: UUID | None,
):
    """Record the model and version that actually served the request."""
    context = _current_trace.get()
    if context is None:
        return
    if isinstance(model, str) and model.strip():
        context.model = model.strip()[:200]
    if agent_version_id is not None:
        context.agent_version_id = agent_version_id


@contextmanager
def trace_span(name: str):
    """Trace a specific operation within an agent request."""
    context = _current_trace.get()
    record = {
        "name": name[:50],
        "duration_ms": 0,
        "status": "success",
        "error_code": None,
        "detail": None,
    }
    handle = _SpanHandle(record)
    if context is None:
        yield handle
        return

    start_time = perf_counter()
    try:
        yield handle
    except Exception as exc:
        record["status"] = "error"
        record["error_code"] = type(exc).__name__[:100]
        raise
    finally:
        record["duration_ms"] = int((perf_counter() - start_time) * 1000)
        record["detail"] = sanitize_detail(record["detail"])
        context.spans.append(record)