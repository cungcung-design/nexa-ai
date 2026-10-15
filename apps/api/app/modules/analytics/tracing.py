import logging
from contextlib import contextmanager
from contextvars import ContextVar
from dataclasses import dataclass, field
from time import perf_counter
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
    spans: list[dict] = field(default_factory=list)


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
            )
            db.add(trace)
            db.commit()
            db.refresh(trace)
            
            # Save spans
            for span_data in context.spans:
                span = AIExecutionSpan(
                    trace_id=trace.id,
                    organization_id=organization_id,
                    name=span_data["name"],
                    duration_ms=span_data["duration_ms"],
                    status=span_data["status"],
                    error_code=span_data.get("error_code"),
                )
                db.add(span)
            db.commit()
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


@contextmanager
def trace_span(name: str):
    """Trace a specific operation within an agent request."""
    context = _current_trace.get()
    if context is None:
        # If there's no trace context, just yield without tracing
        yield
        return
    
    start_time = perf_counter()
    status = "success"
    error_code = None
    
    try:
        yield
    except Exception as e:
        status = "error"
        error_code = str(e)[:100]  # Limit error code length
        raise
    finally:
        end_time = perf_counter()
        duration_ms = int((end_time - start_time) * 1000)
        
        span_data = {
            "name": name,
            "duration_ms": duration_ms,
            "status": status,
        }
        if error_code is not None:
            span_data["error_code"] = error_code
            
        context.spans.append(span_data)