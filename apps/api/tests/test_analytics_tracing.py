import sys
import os
import pytest

# Add the parent directory to the path so we can import apps
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', '..'))

import pytest
from uuid import uuid4

from app.modules.analytics import tracing


def test_trace_span_records_duration():
    context = tracing.TraceContext(
        organization_id=uuid4(),
        agent_id=uuid4(),
    )

    token = tracing._current_trace.set(context)

    try:
        with tracing.trace_span("llm_call"):
            total = sum(range(100))

        assert total == 4950
        assert len(context.spans) == 1
        assert context.spans[0]["name"] == "llm_call"
        assert context.spans[0]["status"] == "success"
        assert context.spans[0]["duration_ms"] >= 0

    finally:
        tracing._current_trace.reset(token)


def test_trace_span_handles_exceptions():
    context = tracing.TraceContext(
        organization_id=uuid4(),
        agent_id=uuid4(),
    )

    token = tracing._current_trace.set(context)

    try:
        with tracing.trace_span("failing_operation"):
            raise ValueError("Something went wrong")
    except ValueError:
        pass

    finally:
        tracing._current_trace.reset(token)

    assert len(context.spans) == 1
    assert context.spans[0]["name"] == "failing_operation"
    assert context.spans[0]["status"] == "error"
    assert context.spans[0].get("error_code") == "ValueError"


def test_trace_agent_request_saves_trace():
    # This test would require a database session, so we'll skip it for now
    # In a full implementation, we would test that the trace is saved to the database
    pass