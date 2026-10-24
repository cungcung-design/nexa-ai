"""API key management.

These tests use the migrated organization_api_keys table. They do not reset
database volumes and they do not print generated secrets.
"""

import uuid
from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.modules.security.api_keys import hash_api_key
from app.modules.security.audit_models import SecurityAuditEvent
from app.modules.security.models import OrganizationAPIKey

PASSWORD = "Api-Key-Module-Secure-Pass"


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _register(client: TestClient, email: str) -> str:
    created = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": PASSWORD},
    )
    assert created.status_code == 201, created.text
    return created.json()["access_token"]


def _organization(client: TestClient, token: str, name: str) -> str:
    suffix = uuid.uuid4().hex[:8]
    created = client.post(
        "/api/v1/organizations",
        headers=_auth(token),
        json={"name": name, "slug": f"{name.lower().replace(' ', '-')}-{suffix}"},
    )
    assert created.status_code == 201, created.text
    return created.json()["id"]


def _agent(client: TestClient, org_id: str, token: str) -> str:
    created = client.post(
        f"/api/v1/organizations/{org_id}/agents",
        headers=_auth(token),
        json={"name": "Key Agent", "description": "api key auth"},
    )
    assert created.status_code == 201, created.text
    return created.json()["id"]


def test_api_key_table_exists(db_session: Session):
    present = db_session.execute(
        text("SELECT to_regclass('public.organization_api_keys')")
    ).scalar()
    assert present == "organization_api_keys"


def test_create_list_revoke_and_authenticate(
    client: TestClient, db_session: Session
):
    suffix = uuid.uuid4().hex[:8]
    owner = _register(client, f"keys-owner-{suffix}@example.com")
    org_id = _organization(client, owner, "Key Workspace")
    agent_id = _agent(client, org_id, owner)
    expires_at = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()

    created = client.post(
        f"/api/v1/organizations/{org_id}/api-keys",
        headers=_auth(owner),
        json={
            "name": "Production API Key",
            "scopes": ["agent:invoke"],
            "expires_at": expires_at,
        },
    )
    assert created.status_code == 201, created.text
    body = created.json()
    secret = body["api_key"]
    assert secret.startswith("nexa_live_")
    assert body["key_prefix"] == secret[:20]
    assert "key_hash" not in body
    assert body["is_active"] is True

    stored = db_session.scalar(
        select(OrganizationAPIKey).where(OrganizationAPIKey.id == body["id"])
    )
    assert stored is not None
    assert stored.key_hash == hash_api_key(secret)
    assert secret not in stored.key_hash
    assert stored.key_hash not in created.text

    listed = client.get(
        f"/api/v1/organizations/{org_id}/api-keys",
        headers=_auth(owner),
    )
    assert listed.status_code == 200, listed.text
    items = listed.json()
    assert len(items) == 1
    assert items[0]["key_prefix"] == body["key_prefix"]
    assert "api_key" not in items[0]
    assert "key_hash" not in items[0]
    assert secret not in listed.text

    event = db_session.scalar(
        select(SecurityAuditEvent).where(
            SecurityAuditEvent.organization_id == org_id,
            SecurityAuditEvent.action == "api_key.created",
        )
    )
    assert event is not None
    assert secret not in str(event.details)

    accepted = client.post(
        f"/api/v1/external/agents/{agent_id}/invoke",
        headers={"Authorization": f"Bearer {secret}"},
        json={"message": "ping"},
    )
    assert accepted.status_code == 400, accepted.text
    assert accepted.json()["detail"] == "Agent has no published version"

    revoked = client.post(
        f"/api/v1/organizations/{org_id}/api-keys/{body['id']}/revoke",
        headers=_auth(owner),
    )
    assert revoked.status_code == 200, revoked.text
    assert revoked.json()["is_active"] is False
    assert "api_key" not in revoked.json()

    rejected = client.post(
        f"/api/v1/external/agents/{agent_id}/invoke",
        headers={"Authorization": f"Bearer {secret}"},
        json={"message": "ping"},
    )
    assert rejected.status_code == 401


def test_invalid_scopes_expiration_and_isolation(client: TestClient, db_session: Session):
    suffix = uuid.uuid4().hex[:8]
    owner = _register(client, f"keys-guard-{suffix}@example.com")
    outsider = _register(client, f"keys-out-{suffix}@example.com")
    viewer = _register(client, f"keys-viewer-{suffix}@example.com")
    org_id = _organization(client, owner, "Key Guard")
    _organization(client, outsider, "Other Keys")
    added = client.post(
        f"/api/v1/organizations/{org_id}/members",
        headers=_auth(owner),
        json={"email": f"keys-viewer-{suffix}@example.com", "role": "VIEWER"},
    )
    assert added.status_code == 201, added.text
    agent_id = _agent(client, org_id, owner)

    invalid = client.post(
        f"/api/v1/organizations/{org_id}/api-keys",
        headers=_auth(owner),
        json={"name": "Bad scope", "scopes": ["billing:write"]},
    )
    assert invalid.status_code == 400, invalid.text
    assert "Invalid scopes" in invalid.json()["detail"]

    past = client.post(
        f"/api/v1/organizations/{org_id}/api-keys",
        headers=_auth(owner),
        json={
            "name": "Already expired",
            "scopes": ["agent:read"],
            "expires_at": (datetime.now(timezone.utc) - timedelta(minutes=5)).isoformat(),
        },
    )
    assert past.status_code == 422, past.text

    too_long = client.post(
        f"/api/v1/organizations/{org_id}/api-keys",
        headers=_auth(owner),
        json={
            "name": "Too long",
            "scopes": ["agent:read"],
            "expires_at": (datetime.now(timezone.utc) + timedelta(days=400)).isoformat(),
        },
    )
    assert too_long.status_code == 422, too_long.text

    read_only = client.post(
        f"/api/v1/organizations/{org_id}/api-keys",
        headers=_auth(owner),
        json={"name": "Read only", "scopes": ["agent:read"]},
    )
    assert read_only.status_code == 201, read_only.text
    read_secret = read_only.json()["api_key"]
    denied = client.post(
        f"/api/v1/external/agents/{agent_id}/invoke",
        headers={"Authorization": f"Bearer {read_secret}"},
        json={"message": "ping"},
    )
    assert denied.status_code == 401

    expiring = client.post(
        f"/api/v1/organizations/{org_id}/api-keys",
        headers=_auth(owner),
        json={
            "name": "Short lived",
            "scopes": ["agent:invoke"],
            "expires_at": (datetime.now(timezone.utc) + timedelta(days=1)).isoformat(),
        },
    )
    assert expiring.status_code == 201, expiring.text
    record = db_session.get(OrganizationAPIKey, expiring.json()["id"])
    assert record is not None
    record.expires_at = datetime.now(timezone.utc) - timedelta(minutes=1)
    db_session.commit()
    expired = client.post(
        f"/api/v1/external/agents/{agent_id}/invoke",
        headers={"Authorization": f"Bearer {expiring.json()['api_key']}"},
        json={"message": "ping"},
    )
    assert expired.status_code == 401

    forbidden = client.post(
        f"/api/v1/organizations/{org_id}/api-keys",
        headers=_auth(viewer),
        json={"name": "Viewer key", "scopes": ["agent:read"]},
    )
    assert forbidden.status_code == 403, forbidden.text

    anonymous = client.get(f"/api/v1/organizations/{org_id}/api-keys")
    assert anonymous.status_code == 401

    cross = client.get(
        f"/api/v1/organizations/{org_id}/api-keys",
        headers=_auth(outsider),
    )
    assert cross.status_code == 404, cross.text

    other_revoke = client.post(
        f"/api/v1/organizations/{org_id}/api-keys/{read_only.json()['id']}/revoke",
        headers=_auth(outsider),
    )
    assert other_revoke.status_code == 404, other_revoke.text
