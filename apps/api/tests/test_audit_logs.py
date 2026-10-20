import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import update

from app.core.redaction import REDACTED
from app.db.models import Agent, Organization, User
from app.db.session import SessionLocal
from app.main import app

PASSWORD = "Audit-Logs-Secure-Pass"


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _register_and_login(client: TestClient, email: str) -> str:
    created = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": PASSWORD},
    )
    assert created.status_code == 201, created.text
    logged_in = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": PASSWORD},
    )
    assert logged_in.status_code == 200, logged_in.text
    return logged_in.json()["access_token"]


def _cleanup(emails: list[str]) -> None:
    db = SessionLocal()
    try:
        users = db.query(User).filter(User.email.in_(emails)).all()
        user_ids = [user.id for user in users]
        if not user_ids:
            return
        from app.db.models import Membership

        org_ids = [
            membership.organization_id
            for membership in db.query(Membership)
            .filter(Membership.user_id.in_(user_ids))
            .all()
        ]
        if org_ids:
            db.execute(
                update(Agent)
                .where(Agent.organization_id.in_(org_ids))
                .values(published_version_id=None)
            )
            db.flush()
            db.query(Organization).filter(
                Organization.id.in_(org_ids)
            ).delete(synchronize_session=False)
        db.query(User).filter(User.id.in_(user_ids)).delete(
            synchronize_session=False
        )
        db.commit()
    finally:
        db.close()


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def audit_workspace(client: TestClient):
    suffix = uuid.uuid4().hex[:10]
    emails = {
        "owner": f"audit-owner-{suffix}@example.com",
        "developer": f"audit-developer-{suffix}@example.com",
        "viewer": f"audit-viewer-{suffix}@example.com",
        "outsider": f"audit-outsider-{suffix}@example.com",
    }

    try:
        tokens = {
            role: _register_and_login(client, email)
            for role, email in emails.items()
        }
        organization = client.post(
            "/api/v1/organizations",
            headers=_auth(tokens["owner"]),
            json={"name": "Audit Test Org", "slug": f"audit-test-{suffix}"},
        )
        assert organization.status_code == 201, organization.text
        org_id = organization.json()["id"]

        for role in ("developer", "viewer"):
            added = client.post(
                f"/api/v1/organizations/{org_id}/members",
                headers=_auth(tokens["owner"]),
                json={"email": emails[role], "role": role.upper()},
            )
            assert added.status_code == 201, added.text

        agent = client.post(
            f"/api/v1/organizations/{org_id}/agents",
            headers=_auth(tokens["owner"]),
            json={"name": "Audited Agent", "description": "Audit fixture"},
        )
        assert agent.status_code == 201, agent.text
        agent_id = agent.json()["id"]

        version = client.post(
            f"/api/v1/organizations/{org_id}/agents/{agent_id}/versions",
            headers=_auth(tokens["owner"]),
            json={
                "system_prompt": "You are an audited assistant.",
                "model": "gpt-4.1-mini",
                "temperature": 0.3,
                "max_tokens": 1024,
                "tools_config": {},
            },
        )
        assert version.status_code == 201, version.text
        version_id = version.json()["id"]

        published = client.post(
            f"/api/v1/organizations/{org_id}/agents/{agent_id}/publish/{version_id}",
            headers=_auth(tokens["owner"]),
        )
        assert published.status_code == 200, published.text

        yield {
            "org_id": org_id,
            "agent_id": agent_id,
            "tokens": tokens,
            "emails": emails,
        }
    finally:
        _cleanup(list(emails.values()))


def test_audit_events_are_recorded_and_listed(client, audit_workspace):
    org_id = audit_workspace["org_id"]
    owner = _auth(audit_workspace["tokens"]["owner"])

    listed = client.get(
        f"/api/v1/organizations/{org_id}/audit-logs",
        headers=owner,
    )
    assert listed.status_code == 200, listed.text
    body = listed.json()
    assert body["total"] >= 3
    assert body["page"] == 1
    assert body["page_size"] == 20
    assert body["page_count"] >= 1

    actions = {item["action"] for item in body["items"]}
    assert "agent.created" in actions
    assert "agent.published" in actions

    created = next(
        item for item in body["items"] if item["action"] == "agent.created"
    )
    assert created["event_id"].startswith("AUD-")
    assert created["category"] == "agents"
    assert created["outcome"] == "success"
    assert created["resource_type"] == "agent"
    assert created["resource_id"] == audit_workspace["agent_id"]
    assert created["resource_available"] is True
    assert created["actor_email"] == audit_workspace["emails"]["owner"]
    assert created["title"]
    assert created["summary"]


def test_audit_events_are_scoped_to_organization(client, audit_workspace):
    org_id = audit_workspace["org_id"]
    outsider = _auth(audit_workspace["tokens"]["outsider"])

    listed = client.get(
        f"/api/v1/organizations/{org_id}/audit-logs",
        headers=outsider,
    )
    assert listed.status_code == 404
    assert "detail" in listed.json()


def test_audit_event_detail_and_unknown_id(client, audit_workspace):
    org_id = audit_workspace["org_id"]
    owner = _auth(audit_workspace["tokens"]["owner"])

    listed = client.get(
        f"/api/v1/organizations/{org_id}/audit-logs",
        headers=owner,
    )
    event_id = listed.json()["items"][0]["id"]

    detail = client.get(
        f"/api/v1/organizations/{org_id}/audit-logs/{event_id}",
        headers=owner,
    )
    assert detail.status_code == 200, detail.text
    assert detail.json()["id"] == event_id

    missing = client.get(
        f"/api/v1/organizations/{org_id}/audit-logs/{uuid.uuid4()}",
        headers=owner,
    )
    assert missing.status_code == 404


def test_audit_filters_are_applied_server_side(client, audit_workspace):
    org_id = audit_workspace["org_id"]
    owner = _auth(audit_workspace["tokens"]["owner"])

    by_action = client.get(
        f"/api/v1/organizations/{org_id}/audit-logs",
        headers=owner,
        params={"search": "agent.published"},
    )
    assert by_action.status_code == 200
    assert by_action.json()["total"] >= 1
    assert all(
        "published" in item["action"]
        for item in by_action.json()["items"]
    )

    by_category = client.get(
        f"/api/v1/organizations/{org_id}/audit-logs",
        headers=owner,
        params={"category": "agents"},
    )
    assert by_category.status_code == 200
    assert by_category.json()["total"] >= 1
    assert all(
        "agents" in item["categories"]
        for item in by_category.json()["items"]
    )

    by_actor = client.get(
        f"/api/v1/organizations/{org_id}/audit-logs",
        headers=owner,
        params={"actor": audit_workspace["emails"]["owner"]},
    )
    assert by_actor.status_code == 200
    assert by_actor.json()["total"] >= 1

    by_resource = client.get(
        f"/api/v1/organizations/{org_id}/audit-logs",
        headers=owner,
        params={"resource_id": audit_workspace["agent_id"]},
    )
    assert by_resource.status_code == 200
    assert by_resource.json()["total"] >= 1

    paged = client.get(
        f"/api/v1/organizations/{org_id}/audit-logs",
        headers=owner,
        params={"limit": 1, "offset": 0},
    )
    assert paged.status_code == 200
    assert len(paged.json()["items"]) == 1
    assert paged.json()["limit"] == 1

    second = client.get(
        f"/api/v1/organizations/{org_id}/audit-logs",
        headers=owner,
        params={"limit": 1, "offset": 1},
    )
    assert second.status_code == 200
    assert second.json()["items"][0]["id"] != paged.json()["items"][0]["id"]

    too_large = client.get(
        f"/api/v1/organizations/{org_id}/audit-logs",
        headers=owner,
        params={"limit": 500},
    )
    assert too_large.status_code == 422


def test_audit_stats_activity_and_categories(client, audit_workspace):
    org_id = audit_workspace["org_id"]
    owner = _auth(audit_workspace["tokens"]["owner"])

    stats = client.get(
        f"/api/v1/organizations/{org_id}/audit-logs/stats",
        headers=owner,
    )
    assert stats.status_code == 200, stats.text
    assert stats.json()["total_events"] >= 3
    assert stats.json()["active_actors"] >= 1

    activity = client.get(
        f"/api/v1/organizations/{org_id}/audit-logs/activity",
        headers=owner,
        params={"days": 7},
    )
    assert activity.status_code == 200, activity.text
    assert len(activity.json()["points"]) == 7
    assert sum(point["count"] for point in activity.json()["points"]) >= 1

    categories = client.get(
        f"/api/v1/organizations/{org_id}/audit-logs/categories",
        headers=owner,
    )
    assert categories.status_code == 200, categories.text
    ids = {item["id"] for item in categories.json()}
    assert "agents" in ids
    assert "authentication" in ids
    agents_category = next(
        item for item in categories.json() if item["id"] == "agents"
    )
    assert agents_category["event_count"] >= 1
    assert agents_category["name"]


def test_audit_changes_groups_by_resource(client, audit_workspace):
    org_id = audit_workspace["org_id"]
    owner = _auth(audit_workspace["tokens"]["owner"])

    changes = client.get(
        f"/api/v1/organizations/{org_id}/audit-logs/changes",
        headers=owner,
    )
    assert changes.status_code == 200, changes.text
    assert changes.json()["total"] >= 1
    group = changes.json()["groups"][0]
    assert group["resource_type"]
    assert group["events"]
    assert group["events"][0]["changes"] is not None


def test_audit_export_requires_permission(client, audit_workspace):
    org_id = audit_workspace["org_id"]
    viewer = _auth(audit_workspace["tokens"]["viewer"])
    developer = _auth(audit_workspace["tokens"]["developer"])

    denied = client.post(
        f"/api/v1/organizations/{org_id}/audit-logs/export",
        headers=viewer,
        json={"format": "csv", "scope": "filtered"},
    )
    assert denied.status_code == 403

    developer_denied = client.post(
        f"/api/v1/organizations/{org_id}/audit-logs/export",
        headers=developer,
        json={"format": "csv", "scope": "filtered"},
    )
    assert developer_denied.status_code == 403


def test_audit_export_csv_and_json_are_downloadable(client, audit_workspace):
    org_id = audit_workspace["org_id"]
    owner = _auth(audit_workspace["tokens"]["owner"])

    for export_format in ("csv", "json"):
        created = client.post(
            f"/api/v1/organizations/{org_id}/audit-logs/export",
            headers=owner,
            json={"format": export_format, "scope": "filtered"},
        )
        assert created.status_code == 200, created.text
        export_id = created.json()["export_id"]

        status_response = client.get(
            f"/api/v1/organizations/{org_id}/audit-logs/export/{export_id}",
            headers=owner,
        )
        assert status_response.status_code == 200
        assert status_response.json()["status"] == "completed"
        assert status_response.json()["record_count"] >= 1
        assert status_response.json()["download_url"]

        download = client.get(
            f"/api/v1/organizations/{org_id}/audit-logs/export/{export_id}/download",
            headers=owner,
        )
        assert download.status_code == 200, download.text
        if export_format == "csv":
            assert "event_id" in download.text
            assert "action" in download.text
        else:
            import json as json_mod

            payload = json_mod.loads(download.text)
            assert isinstance(payload, list)
            assert payload
            assert "action" in payload[0]


def test_audit_export_of_another_organization_is_not_visible(client, audit_workspace):
    org_id = audit_workspace["org_id"]
    owner = _auth(audit_workspace["tokens"]["owner"])
    outsider = _auth(audit_workspace["tokens"]["outsider"])

    created = client.post(
        f"/api/v1/organizations/{org_id}/audit-logs/export",
        headers=owner,
        json={"format": "csv", "scope": "filtered"},
    )
    export_id = created.json()["export_id"]

    hidden = client.get(
        f"/api/v1/organizations/{org_id}/audit-logs/export/{export_id}",
        headers=outsider,
    )
    assert hidden.status_code == 404


def test_audit_read_requires_membership(client, audit_workspace):
    org_id = audit_workspace["org_id"]
    outsider = _auth(audit_workspace["tokens"]["outsider"])

    for path in ("", "/stats", "/activity", "/categories", "/changes"):
        response = client.get(
            f"/api/v1/organizations/{org_id}/audit-logs{path}",
            headers=outsider,
        )
        assert response.status_code == 404, path


def test_audit_details_redact_secrets(client, audit_workspace):
    from app.modules.security.audit import record_audit_event

    org_id = audit_workspace["org_id"]
    owner = _auth(audit_workspace["tokens"]["owner"])

    db = SessionLocal()
    try:
        event = record_audit_event(
            db,
            organization_id=uuid.UUID(org_id),
            action="integration.connected",
            resource_type="integration",
            resource_name="Secret Connector",
            actor_user_id=db.query(User).filter(
                User.email == audit_workspace["emails"]["owner"]
            ).one().id,
            details={
                "api_key": "super-secret-value",
                "nested": {"password": "another-secret", "safe": "visible"},
            },
            changes={"credential": "leak-me", "scope": ["read"]},
        )
        event_id = str(event.id)
    finally:
        db.close()

    detail = client.get(
        f"/api/v1/organizations/{org_id}/audit-logs/{event_id}",
        headers=owner,
    )
    assert detail.status_code == 200, detail.text
    payload = detail.json()
    assert payload["details"]["api_key"] == REDACTED
    assert payload["details"]["nested"]["password"] == REDACTED
    assert payload["details"]["nested"]["safe"] == "visible"
    assert payload["changes"]["credential"] == REDACTED
    assert "super-secret-value" not in detail.text
    assert "leak-me" not in detail.text
