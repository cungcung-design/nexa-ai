"""Persisted execution traces stay inside one workspace."""

import json
import uuid
from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.modules.analytics.models import AIExecutionSpan, AIRequestTrace
from app.modules.analytics.tracing import sanitize_detail

PASSWORD = "Analytics-Trace-Pass"


def _register(client: TestClient, email: str) -> str:
    created = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": PASSWORD},
    )
    assert created.status_code == 201, created.text
    return created.json()["access_token"]


def _workspace(client: TestClient, email: str) -> tuple[str, str, str]:
    token = _register(client, email)
    suffix = uuid.uuid4().hex[:8]
    created = client.post(
        "/api/v1/organizations",
        headers={"Authorization": f"Bearer {token}"},
        json={"name": "Analytics Workspace", "slug": f"analytics-{suffix}"},
    )
    assert created.status_code == 201, created.text
    organization_id = created.json()["id"]
    agent = client.post(
        f"/api/v1/organizations/{organization_id}/agents",
        headers={"Authorization": f"Bearer {token}"},
        json={"name": "Trace Agent", "description": "Records requests."},
    )
    assert agent.status_code == 201, agent.text
    return token, organization_id, agent.json()["id"]


def test_span_detail_drops_credentials():
    cleaned = sanitize_detail(
        {
            "model": "qwen3:4b",
            "tool_name": "create_note",
            "api_key": "secret-value",
            "sources": [{"filename": "guide.txt", "document_id": "doc-1", "content": "private"}],
        }
    )
    assert cleaned == {
        "model": "qwen3:4b",
        "tool_name": "create_note",
        "sources": [{"filename": "guide.txt", "document_id": "doc-1"}],
    }
    assert "secret-value" not in json.dumps(cleaned)


def test_trace_list_detail_and_isolation(
    client: TestClient,
    db_session: Session,
):
    suffix = uuid.uuid4().hex[:8]
    token, organization_id, agent_id = _workspace(
        client, f"analytics-owner-{suffix}@example.com"
    )
    other_token, other_organization_id, _other_agent = _workspace(
        client, f"analytics-other-{suffix}@example.com"
    )
    now = datetime.now(timezone.utc)
    recent = AIRequestTrace(
        organization_id=organization_id,
        agent_id=agent_id,
        status="success",
        latency_ms=1200,
        prompt_tokens=11,
        completion_tokens=7,
        model="qwen3:4b",
        created_at=now,
    )
    old = AIRequestTrace(
        organization_id=organization_id,
        agent_id=agent_id,
        status="error",
        error_code="AGENT_EXECUTION_FAILED",
        latency_ms=400,
        prompt_tokens=3,
        completion_tokens=0,
        created_at=now - timedelta(days=40),
    )
    db_session.add_all([recent, old])
    db_session.flush()
    db_session.add(
        AIExecutionSpan(
            trace_id=recent.id,
            organization_id=organization_id,
            name="llm_call",
            duration_ms=900,
            status="success",
            detail=json.dumps(
                {
                    "model": "qwen3:4b",
                    "api_key": "do-not-return",
                }
            ),
            created_at=now,
        )
    )
    db_session.commit()

    headers = {"Authorization": f"Bearer {token}"}
    listed = client.get(
        f"/api/v1/organizations/{organization_id}/analytics/traces?days=7",
        headers=headers,
    )
    assert listed.status_code == 200, listed.text
    body = listed.json()
    assert [item["id"] for item in body] == [str(recent.id)]
    assert body[0]["agent_name"] == "Trace Agent"
    assert body[0]["model"] == "qwen3:4b"
    assert body[0]["prompt_tokens"] == 11
    assert body[0]["completion_tokens"] == 7
    assert body[0]["total_tokens"] == 18
    assert "do-not-return" not in listed.text

    detail = client.get(
        f"/api/v1/organizations/{organization_id}/analytics/traces/{recent.id}",
        headers=headers,
    )
    assert detail.status_code == 200, detail.text
    assert detail.json()["status"] == "success"

    spans = client.get(
        f"/api/v1/organizations/{organization_id}/analytics/traces/{recent.id}/spans",
        headers=headers,
    )
    assert spans.status_code == 200, spans.text
    assert spans.json()[0]["name"] == "llm_call"
    assert spans.json()[0]["detail"] == {"model": "qwen3:4b"}
    assert "do-not-return" not in spans.text

    missing = client.get(
        f"/api/v1/organizations/{organization_id}/analytics/traces/{uuid.uuid4()}",
        headers=headers,
    )
    assert missing.status_code == 404

    invalid = client.get(
        f"/api/v1/organizations/{organization_id}/analytics/traces/not-a-trace",
        headers=headers,
    )
    assert invalid.status_code == 422

    outsider = client.get(
        f"/api/v1/organizations/{organization_id}/analytics/traces/{recent.id}",
        headers={"Authorization": f"Bearer {other_token}"},
    )
    assert outsider.status_code == 404
    outsider_list = client.get(
        f"/api/v1/organizations/{other_organization_id}/analytics/traces",
        headers={"Authorization": f"Bearer {other_token}"},
    )
    assert outsider_list.status_code == 200
    assert outsider_list.json() == []


def test_date_filter_excludes_older_traces(
    client: TestClient,
    db_session: Session,
):
    suffix = uuid.uuid4().hex[:8]
    token, organization_id, agent_id = _workspace(
        client, f"analytics-dates-{suffix}@example.com"
    )
    now = datetime.now(timezone.utc)
    inside = AIRequestTrace(
        organization_id=organization_id,
        agent_id=agent_id,
        status="success",
        latency_ms=10,
        prompt_tokens=1,
        completion_tokens=1,
        created_at=now - timedelta(days=2),
    )
    outside = AIRequestTrace(
        organization_id=organization_id,
        agent_id=agent_id,
        status="success",
        latency_ms=10,
        prompt_tokens=1,
        completion_tokens=1,
        created_at=now - timedelta(days=20),
    )
    db_session.add_all([inside, outside])
    db_session.commit()
    response = client.get(
        f"/api/v1/organizations/{organization_id}/analytics/traces?days=7",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200, response.text
    assert [item["id"] for item in response.json()] == [str(inside.id)]
