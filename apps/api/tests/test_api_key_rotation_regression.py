"""Regression coverage for key rotation and published external invocation.

Requires TEST_DATABASE_URL pointing to an isolated migrated PostgreSQL *_test DB.
No real LLM call is made: only the provider execution is mocked.
"""
import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.modules.security.models import OrganizationAPIKey


def _headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _setup(client: TestClient):
    suffix = uuid.uuid4().hex[:12]
    registered = client.post("/api/v1/auth/register", json={
        "email": f"rotation-{suffix}@example.com",
        "password": "Rotation-Test-Strong-Pass-2026",
    })
    assert registered.status_code == 201, registered.text
    token = registered.json()["access_token"]
    created = client.post("/api/v1/organizations", headers=_headers(token), json={
        "name": "Rotation Test", "slug": f"rotation-{suffix}",
    })
    assert created.status_code == 201, created.text
    return token, created.json()["id"]


def _create_key(client, org, token, **kwargs):
    response = client.post(f"/api/v1/organizations/{org}/api-keys", headers=_headers(token), json={
        "name": "Regression key", "scopes": ["agent:invoke"], **kwargs,
    })
    assert response.status_code == 201, response.text
    return response.json()


def _rotate(client, org, token, key_id):
    return client.post(f"/api/v1/organizations/{org}/api-keys/{key_id}/rotate", headers=_headers(token))


def test_rotate_reveals_once_revokes_old_and_rejects_repeat(client: TestClient, db_session: Session):
    token, org = _setup(client)
    old = _create_key(client, org, token)
    rotated = _rotate(client, org, token, old["id"])
    assert rotated.status_code == 200, rotated.text
    new = rotated.json()
    assert new["id"] != old["id"]
    assert new["api_key"] != old["api_key"]
    assert new["scopes"] == old["scopes"]

    listed = client.get(f"/api/v1/organizations/{org}/api-keys", headers=_headers(token))
    assert listed.status_code == 200
    assert len(listed.json()) == 2
    assert not any("api_key" in row or "key_hash" in row for row in listed.json())
    assert old["api_key"] not in listed.text and new["api_key"] not in listed.text
    assert _rotate(client, org, token, old["id"]).status_code == 404
    assert db_session.get(OrganizationAPIKey, uuid.UUID(old["id"])).is_active is False
    assert db_session.get(OrganizationAPIKey, uuid.UUID(new["id"])).is_active is True


def test_rotated_key_invokes_published_agent_with_mock_provider(client: TestClient):
    token, org = _setup(client)
    agent_response = client.post(f"/api/v1/organizations/{org}/agents", headers=_headers(token), json={
        "name": "Rotation Agent", "description": "Published regression agent",
    })
    assert agent_response.status_code == 201, agent_response.text
    agent = agent_response.json()["id"]
    version_response = client.post(f"/api/v1/organizations/{org}/agents/{agent}/versions", headers=_headers(token), json={
        "system_prompt": "You are a regression testing assistant.",
        "model": "qwen3:4b", "temperature": 0.3, "max_tokens": 128, "tools_config": {},
    })
    assert version_response.status_code == 201, version_response.text
    version = version_response.json()["id"]
    published = client.post(f"/api/v1/organizations/{org}/agents/{agent}/publish/{version}", headers=_headers(token))
    assert published.status_code == 200, published.text

    old = _create_key(client, org, token)
    new_response = _rotate(client, org, token, old["id"])
    assert new_response.status_code == 200, new_response.text
    new = new_response.json()
    url = f"/api/v1/external/agents/{agent}/invoke"
    old_attempt = client.post(url, headers=_headers(old["api_key"]), json={"message": "hello"})
    assert old_attempt.status_code == 401

    with patch("app.modules.security.router.run_agent", return_value={
        "answer": "Test response", "agent_id": uuid.UUID(agent),
        "version_id": uuid.UUID(version), "model": "qwen3:4b",
        "prompt_tokens": 3, "completion_tokens": 2, "sources": [],
    }) as run:
        new_attempt = client.post(url, headers=_headers(new["api_key"]), json={"message": "hello"})
        assert new_attempt.status_code == 200, new_attempt.text
        assert new_attempt.json()["answer"] == "Test response"
        run.assert_called_once()


def test_expired_revoked_and_other_workspace_rotation_denied(client: TestClient, db_session: Session):
    owner, org = _setup(client)
    outsider, other_org = _setup(client)
    active = _create_key(client, org, owner)
    assert _rotate(client, other_org, outsider, active["id"]).status_code == 404
    assert _rotate(client, org, outsider, active["id"]).status_code in (403, 404)

    revoked = client.post(f"/api/v1/organizations/{org}/api-keys/{active['id']}/revoke", headers=_headers(owner))
    assert revoked.status_code == 200
    assert _rotate(client, org, owner, active["id"]).status_code == 404

    expiring = _create_key(client, org, owner, expires_at=(datetime.now(timezone.utc) + timedelta(days=1)).isoformat())
    record = db_session.get(OrganizationAPIKey, uuid.UUID(expiring["id"]))
    record.expires_at = datetime.now(timezone.utc) - timedelta(minutes=1)
    db_session.commit()
    denied = _rotate(client, org, owner, expiring["id"])
    assert denied.status_code == 400
    assert "Expired" in denied.json()["detail"]
