"""Tests for the settings module.

The suite covers personal settings, workspace settings, the AI configuration
inheritance chain, the mandatory workspace policies, run snapshots, the
workspace lifecycle actions and the audit trail they leave behind.
"""

import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.db.models import Agent, AgentVersion, Membership, Organization
from app.db.models import Role as DbRole
from app.modules.security.audit_models import SecurityAuditEvent
from app.modules.settings.models import (
    AgentConfigOverride,
    RunConfigSnapshot,
    UserSettings,
    WorkspaceSettings,
)

PASSWORD = "Settings-Module-Secure-Pass"


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _register(client: TestClient, email: str) -> str:
    created = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": PASSWORD},
    )
    assert created.status_code == 201, created.text
    return created.json()["access_token"]


@pytest.fixture
def workspace(client: TestClient):
    """Owner, admin, developer, viewer and an outsider of one workspace."""
    suffix = uuid.uuid4().hex[:10]
    emails = {
        "owner": f"settings-owner-{suffix}@example.com",
        "admin": f"settings-admin-{suffix}@example.com",
        "developer": f"settings-developer-{suffix}@example.com",
        "viewer": f"settings-viewer-{suffix}@example.com",
        "outsider": f"settings-outsider-{suffix}@example.com",
    }
    tokens = {role: _register(client, email) for role, email in emails.items()}

    organization = client.post(
        "/api/v1/organizations",
        headers=_auth(tokens["owner"]),
        json={"name": "Settings Test Org", "slug": f"settings-test-{suffix}"},
    )
    assert organization.status_code == 201, organization.text
    org_id = organization.json()["id"]

    for role in ("admin", "developer", "viewer"):
        added = client.post(
            f"/api/v1/organizations/{org_id}/members",
            headers=_auth(tokens["owner"]),
            json={"email": emails[role], "role": role.upper()},
        )
        assert added.status_code == 201, added.text

    return {"org_id": org_id, "emails": emails, "tokens": tokens}


def _published_agent(
    client: TestClient, org_id: str, token: str, model: str = "gpt-4o-mini"
) -> tuple[str, str]:
    """Create an agent with one published version."""
    created = client.post(
        f"/api/v1/organizations/{org_id}/agents",
        headers=_auth(token),
        json={"name": "Settings Agent", "description": "inheritance test"},
    )
    assert created.status_code == 201, created.text
    agent_id = created.json()["id"]

    version = client.post(
        f"/api/v1/organizations/{org_id}/agents/{agent_id}/versions",
        headers=_auth(token),
        json={
            "system_prompt": "A system prompt that is long enough.",
            "model": model,
            "temperature": 0.3,
            "max_tokens": 512,
            "tools_config": {},
        },
    )
    assert version.status_code == 201, version.text
    version_id = version.json()["id"]

    published = client.post(
        f"/api/v1/organizations/{org_id}/agents/{agent_id}/publish/{version_id}",
        headers=_auth(token),
    )
    assert published.status_code == 200, published.text
    return agent_id, version_id


def _set_ai_defaults(
    client: TestClient, org_id: str, token: str, **payload
) -> dict:
    response = client.patch(
        f"/api/v1/organizations/{org_id}/settings",
        headers=_auth(token),
        json={"ai": payload},
    )
    assert response.status_code == 200, response.text
    return response.json()


# --- Personal settings ------------------------------------------------------


def test_personal_settings_are_saved_and_persisted(client: TestClient, workspace):
    token = workspace["tokens"]["developer"]

    initial = client.get("/api/v1/settings/me", headers=_auth(token))
    assert initial.status_code == 200, initial.text
    body = initial.json()
    assert body["email"] == workspace["emails"]["developer"]
    assert body["full_name"] == ""
    assert body["notifications"]["security_alerts"] is True
    assert "security_alerts" in body["mandatory_notifications"]

    updated = client.patch(
        "/api/v1/settings/me",
        headers=_auth(token),
        json={
            "full_name": "Dana Developer",
            "job_title": "AI Engineer",
            "language": "de",
            "appearance": "light",
        },
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["full_name"] == "Dana Developer"

    reloaded = client.get("/api/v1/settings/me", headers=_auth(token))
    assert reloaded.status_code == 200, reloaded.text
    assert reloaded.json()["job_title"] == "AI Engineer"
    assert reloaded.json()["language"] == "de"
    assert reloaded.json()["appearance"] == "light"


def test_personal_settings_reject_unsupported_values(client: TestClient, workspace):
    token = workspace["tokens"]["developer"]

    response = client.patch(
        "/api/v1/settings/me",
        headers=_auth(token),
        json={"language": "kl"},
    )
    assert response.status_code == 422, response.text

    appearance = client.patch(
        "/api/v1/settings/me",
        headers=_auth(token),
        json={"appearance": "neon"},
    )
    assert appearance.status_code == 422, appearance.text


def test_notification_preferences_are_personal_and_mandatory(
    client: TestClient, workspace
):
    token = workspace["tokens"]["developer"]

    updated = client.patch(
        "/api/v1/settings/me/notifications",
        headers=_auth(token),
        json={"billing_updates": True, "approvals": False},
    )
    assert updated.status_code == 200, updated.text
    body = updated.json()
    assert body["notifications"]["billing_updates"] is True
    assert body["notifications"]["approvals"] is False
    # A mandatory notification cannot be switched off.
    assert body["notifications"]["security_alerts"] is True

    blocked = client.patch(
        "/api/v1/settings/me/notifications",
        headers=_auth(token),
        json={"security_alerts": False},
    )
    assert blocked.status_code == 422, blocked.text
    assert "security_alerts" in blocked.json()["detail"]


def test_notification_preferences_are_not_shared_between_users(
    client: TestClient, workspace
):
    developer = workspace["tokens"]["developer"]
    viewer = workspace["tokens"]["viewer"]

    client.patch(
        "/api/v1/settings/me/notifications",
        headers=_auth(developer),
        json={"billing_updates": True},
    )

    other = client.get("/api/v1/settings/me", headers=_auth(viewer))
    assert other.status_code == 200, other.text
    assert other.json()["notifications"]["billing_updates"] is False


def test_password_change_requires_the_current_password(
    client: TestClient, workspace
):
    token = workspace["tokens"]["developer"]

    wrong = client.post(
        "/api/v1/settings/me/password",
        headers=_auth(token),
        json={
            "current_password": "not-the-password",
            "new_password": "Another-Secure-Password-1",
        },
    )
    assert wrong.status_code == 400, wrong.text

    changed = client.post(
        "/api/v1/settings/me/password",
        headers=_auth(token),
        json={
            "current_password": PASSWORD,
            "new_password": "Another-Secure-Password-1",
        },
    )
    assert changed.status_code == 200, changed.text

    login = client.post(
        "/api/v1/auth/login",
        json={
            "email": workspace["emails"]["developer"],
            "password": "Another-Secure-Password-1",
        },
    )
    assert login.status_code == 200, login.text


# --- Workspace settings -----------------------------------------------------


def test_workspace_settings_are_organization_scoped(
    client: TestClient, workspace
):
    org_id = workspace["org_id"]
    tokens = workspace["tokens"]

    read = client.get(
        f"/api/v1/organizations/{org_id}/settings",
        headers=_auth(tokens["viewer"]),
    )
    assert read.status_code == 200, read.text
    body = read.json()
    assert body["organization"]["id"] == org_id
    assert body["organization"]["role"] == "VIEWER"
    assert body["can_manage"] is False
    assert body["capabilities"]["mfa"] is False

    outsider = client.get(
        f"/api/v1/organizations/{org_id}/settings",
        headers=_auth(tokens["outsider"]),
    )
    assert outsider.status_code == 404, outsider.text


def test_workspace_settings_write_requires_the_manage_permission(
    client: TestClient, workspace
):
    org_id = workspace["org_id"]
    tokens = workspace["tokens"]

    developer = client.patch(
        f"/api/v1/organizations/{org_id}/settings",
        headers=_auth(tokens["developer"]),
        json={"data": {"retention_days": 30}},
    )
    assert developer.status_code == 403, developer.text

    admin = client.patch(
        f"/api/v1/organizations/{org_id}/settings",
        headers=_auth(tokens["admin"]),
        json={"data": {"retention_days": 30}},
    )
    assert admin.status_code == 200, admin.text
    assert admin.json()["data"]["retention_days"] == 30


def test_workspace_settings_are_isolated_between_workspaces(
    client: TestClient, workspace
):
    org_id = workspace["org_id"]
    token = workspace["tokens"]["owner"]
    suffix = uuid.uuid4().hex[:10]

    other = client.post(
        "/api/v1/organizations",
        headers=_auth(token),
        json={"name": "Other Org", "slug": f"other-org-{suffix}"},
    )
    assert other.status_code == 201, other.text
    other_id = other.json()["id"]

    client.patch(
        f"/api/v1/organizations/{org_id}/settings",
        headers=_auth(token),
        json={"data": {"retention_days": 11}},
    )

    read = client.get(
        f"/api/v1/organizations/{other_id}/settings",
        headers=_auth(token),
    )
    assert read.status_code == 200, read.text
    assert read.json()["data"]["retention_days"] == 365


# --- AI configuration inheritance -------------------------------------------


def test_agent_inherits_the_workspace_default(client: TestClient, workspace):
    org_id = workspace["org_id"]
    token = workspace["tokens"]["owner"]
    agent_id, version_id = _published_agent(client, org_id, token)

    _set_ai_defaults(
        client,
        org_id,
        token,
        default_model="qwen3:4b",
        default_temperature=0.7,
        default_agent_timeout_seconds=120,
        default_tool_approval_policy="optional",
    )

    effective = client.get(
        f"/api/v1/organizations/{org_id}/settings/ai/effective"
        f"?agent_id={agent_id}&version_id={version_id}",
        headers=_auth(token),
    )
    assert effective.status_code == 200, effective.text
    settings = effective.json()["settings"]

    assert settings["model"]["value"] == "qwen3:4b"
    assert settings["model"]["source"] == "workspace_default"
    assert settings["model"]["inherited"] is True
    assert settings["model"]["overridden"] is False
    assert settings["temperature"]["value"] == 0.7
    assert settings["agent_timeout_seconds"]["value"] == 120
    assert settings["tool_approval_policy"]["value"] == "optional"


def test_agent_override_wins_over_the_workspace_default(
    client: TestClient, workspace
):
    org_id = workspace["org_id"]
    token = workspace["tokens"]["owner"]
    agent_id, version_id = _published_agent(client, org_id, token)

    _set_ai_defaults(client, org_id, token, default_model="qwen3:4b")

    stored = client.put(
        f"/api/v1/organizations/{org_id}/settings/ai/overrides/{agent_id}"
        f"/{version_id}",
        headers=_auth(token),
        json={"model": "gpt-4o-mini", "temperature": 0.0},
    )
    assert stored.status_code == 200, stored.text
    assert stored.json()["temperature"] == 0.0

    effective = client.get(
        f"/api/v1/organizations/{org_id}/settings/ai/effective"
        f"?agent_id={agent_id}&version_id={version_id}",
        headers=_auth(token),
    )
    settings = effective.json()["settings"]
    assert settings["model"]["value"] == "gpt-4o-mini"
    assert settings["model"]["source"] == "agent_override"
    assert settings["model"]["overridden"] is True
    assert settings["model"]["reset_available"] is True
    # An explicit zero is different from an unset value.
    assert settings["temperature"]["value"] == 0.0


def test_agent_override_can_be_reset_to_inherited(client: TestClient, workspace):
    org_id = workspace["org_id"]
    token = workspace["tokens"]["owner"]
    agent_id, version_id = _published_agent(client, org_id, token)

    _set_ai_defaults(client, org_id, token, default_model="qwen3:4b")
    client.put(
        f"/api/v1/organizations/{org_id}/settings/ai/overrides/{agent_id}"
        f"/{version_id}",
        headers=_auth(token),
        json={"model": "gpt-4o-mini"},
    )

    removed = client.delete(
        f"/api/v1/organizations/{org_id}/settings/ai/overrides/{agent_id}"
        f"/{version_id}",
        headers=_auth(token),
    )
    assert removed.status_code == 204, removed.text

    effective = client.get(
        f"/api/v1/organizations/{org_id}/settings/ai/effective"
        f"?agent_id={agent_id}&version_id={version_id}",
        headers=_auth(token),
    )
    settings = effective.json()["settings"]
    assert settings["model"]["value"] == "qwen3:4b"
    assert settings["model"]["source"] == "workspace_default"
    assert settings["model"]["reset_available"] is False


def test_workflow_override_wins_over_the_agent_override(
    client: TestClient, workspace
):
    org_id = workspace["org_id"]
    token = workspace["tokens"]["owner"]
    agent_id, version_id = _published_agent(client, org_id, token)

    _set_ai_defaults(client, org_id, token, default_model="qwen3:4b")
    client.put(
        f"/api/v1/organizations/{org_id}/settings/ai/overrides/{agent_id}"
        f"/{version_id}",
        headers=_auth(token),
        json={"model": "gpt-4o-mini"},
    )
    workflow = client.put(
        f"/api/v1/organizations/{org_id}/settings/ai/workflows/demo_create_note",
        headers=_auth(token),
        json={"model": "gpt-4.1-mini"},
    )
    assert workflow.status_code == 200, workflow.text

    effective = client.get(
        f"/api/v1/organizations/{org_id}/settings/ai/effective"
        f"?agent_id={agent_id}&version_id={version_id}"
        "&workflow_key=demo_create_note",
        headers=_auth(token),
    )
    settings = effective.json()["settings"]
    assert settings["model"]["value"] == "gpt-4.1-mini"
    assert settings["model"]["source"] == "workflow_override"


def test_workspace_defaults_do_not_modify_a_published_version(
    client: TestClient, workspace
):
    org_id = workspace["org_id"]
    token = workspace["tokens"]["owner"]
    agent_id, version_id = _published_agent(client, org_id, token)

    _set_ai_defaults(
        client,
        org_id,
        token,
        default_model="qwen3:4b",
        default_temperature=1.5,
    )

    versions = client.get(
        f"/api/v1/organizations/{org_id}/agents/{agent_id}/versions",
        headers=_auth(token),
    )
    assert versions.status_code == 200, versions.text
    version = versions.json()[0]
    assert version["model"] == "gpt-4o-mini"
    assert version["temperature"] == 0.3


def test_model_restriction_blocks_a_disallowed_model(
    client: TestClient, workspace
):
    org_id = workspace["org_id"]
    token = workspace["tokens"]["owner"]
    agent_id, version_id = _published_agent(client, org_id, token)

    _set_ai_defaults(client, org_id, token, allowed_models=["gpt-4o-mini"])

    rejected = client.patch(
        f"/api/v1/organizations/{org_id}/settings",
        headers=_auth(token),
        json={"ai": {"default_model": "qwen3:4b"}},
    )
    assert rejected.status_code == 422, rejected.text
    assert "not allowed" in rejected.json()["detail"]

    override = client.put(
        f"/api/v1/organizations/{org_id}/settings/ai/overrides/{agent_id}"
        f"/{version_id}",
        headers=_auth(token),
        json={"model": "qwen3:4b"},
    )
    assert override.status_code == 422, override.text


def test_required_tool_approval_cannot_be_weakened(
    client: TestClient, workspace
):
    org_id = workspace["org_id"]
    token = workspace["tokens"]["owner"]
    agent_id, version_id = _published_agent(client, org_id, token)

    _set_ai_defaults(
        client,
        org_id,
        token,
        require_tool_approval=True,
        default_tool_approval_policy="require",
    )
    client.put(
        f"/api/v1/organizations/{org_id}/settings/ai/overrides/{agent_id}"
        f"/{version_id}",
        headers=_auth(token),
        json={"tool_approval_policy": "disabled"},
    )

    effective = client.get(
        f"/api/v1/organizations/{org_id}/settings/ai/effective"
        f"?agent_id={agent_id}&version_id={version_id}",
        headers=_auth(token),
    )
    body = effective.json()
    assert body["settings"]["tool_approval_policy"]["value"] == "require"
    assert body["settings"]["tool_approval_policy"]["locked_by_policy"] is True
    assert body["restrictions"]["require_tool_approval"] is True


def test_agent_configuration_list_reports_inheritance(
    client: TestClient, workspace
):
    org_id = workspace["org_id"]
    token = workspace["tokens"]["owner"]
    agent_id, version_id = _published_agent(client, org_id, token)

    listing = client.get(
        f"/api/v1/organizations/{org_id}/settings/ai/agents",
        headers=_auth(token),
    )
    assert listing.status_code == 200, listing.text
    item = listing.json()["items"][0]
    assert item["id"] == agent_id
    assert item["version_number"] == 1
    assert item["inherited"] is True
    assert item["override"] is None


# --- Run snapshots ----------------------------------------------------------


def test_workflow_run_stores_a_resolved_config_snapshot(
    client: TestClient, workspace
):
    org_id = workspace["org_id"]
    token = workspace["tokens"]["owner"]
    agent_id, _version_id = _published_agent(client, org_id, token)

    _set_ai_defaults(client, org_id, token, default_model="qwen3:4b")

    run = client.post(
        f"/api/v1/organizations/{org_id}/workflows/demo-action",
        headers=_auth(token),
        json={"agent_id": agent_id, "note": "inheritance"},
    )
    assert run.status_code == 200, run.text

    snapshots = client.get(
        f"/api/v1/organizations/{org_id}/settings/runs",
        headers=_auth(token),
    )
    assert snapshots.status_code == 200, snapshots.text
    items = snapshots.json()["items"]
    assert items, "the run must be recorded with a configuration snapshot"
    snapshot = items[0]
    assert snapshot["agent_id"] == agent_id
    assert snapshot["workflow_key"] == "demo_create_note"
    assert snapshot["resolved_config"]["model"] == "qwen3:4b"
    assert snapshot["sources"]["model"] == "workspace_default"


def test_a_later_settings_change_does_not_rewrite_a_snapshot(
    client: TestClient, workspace
):
    org_id = workspace["org_id"]
    token = workspace["tokens"]["owner"]
    agent_id, _version_id = _published_agent(client, org_id, token)

    _set_ai_defaults(client, org_id, token, default_model="qwen3:4b")
    client.post(
        f"/api/v1/organizations/{org_id}/workflows/demo-action",
        headers=_auth(token),
        json={"agent_id": agent_id, "note": "first"},
    )
    _set_ai_defaults(client, org_id, token, default_model="gpt-4o-mini")

    snapshots = client.get(
        f"/api/v1/organizations/{org_id}/settings/runs",
        headers=_auth(token),
    )
    snapshot = snapshots.json()["items"][0]
    assert snapshot["resolved_config"]["model"] == "qwen3:4b"


# --- Lifecycle --------------------------------------------------------------


def test_ownership_transfer_moves_the_owner_role(client: TestClient, workspace):
    org_id = workspace["org_id"]
    tokens = workspace["tokens"]

    members = client.get(
        f"/api/v1/organizations/{org_id}/team/members",
        headers=_auth(tokens["owner"]),
    )
    member_ids = {
        item["email"]: item["id"] for item in members.json()["items"]
    }
    target = member_ids[workspace["emails"]["admin"]]

    transferred = client.post(
        f"/api/v1/organizations/{org_id}/settings/ownership/transfer",
        headers=_auth(tokens["owner"]),
        json={"membership_id": target},
    )
    assert transferred.status_code == 200, transferred.text
    assert transferred.json()["new_owner"] == workspace["emails"]["admin"]

    listing = client.get(
        f"/api/v1/organizations/{org_id}/team/members",
        headers=_auth(tokens["admin"]),
    )
    roles = {item["email"]: item["role"] for item in listing.json()["items"]}
    assert roles[workspace["emails"]["admin"]] == "OWNER"
    # The workspace keeps an owner, so the previous owner steps down.
    assert roles[workspace["emails"]["owner"]] == "ADMIN"


def test_ownership_transfer_rules(client: TestClient, workspace):
    org_id = workspace["org_id"]
    tokens = workspace["tokens"]

    members = client.get(
        f"/api/v1/organizations/{org_id}/team/members",
        headers=_auth(tokens["owner"]),
    )
    member_ids = {
        item["email"]: item["id"] for item in members.json()["items"]
    }
    own_id = member_ids[workspace["emails"]["owner"]]

    same = client.post(
        f"/api/v1/organizations/{org_id}/settings/ownership/transfer",
        headers=_auth(tokens["owner"]),
        json={"membership_id": own_id},
    )
    assert same.status_code == 422, same.text

    not_owner = client.post(
        f"/api/v1/organizations/{org_id}/settings/ownership/transfer",
        headers=_auth(tokens["admin"]),
        json={"membership_id": own_id},
    )
    assert not_owner.status_code == 403, not_owner.text


def test_workspace_deletion_requires_the_exact_name(
    client: TestClient, workspace
):
    org_id = workspace["org_id"]
    token = workspace["tokens"]["owner"]

    wrong = client.post(
        f"/api/v1/organizations/{org_id}/settings/delete",
        headers=_auth(token),
        json={"confirm_name": "not the workspace name"},
    )
    assert wrong.status_code == 422, wrong.text

    deleted = client.post(
        f"/api/v1/organizations/{org_id}/settings/delete",
        headers=_auth(token),
        json={"confirm_name": "Settings Test Org"},
    )
    assert deleted.status_code == 200, deleted.text

    gone = client.get(
        f"/api/v1/organizations/{org_id}",
        headers=_auth(token),
    )
    assert gone.status_code == 404, gone.text


def test_workspace_deletion_requires_the_owner_role(
    client: TestClient, workspace
):
    org_id = workspace["org_id"]

    refused = client.post(
        f"/api/v1/organizations/{org_id}/settings/delete",
        headers=_auth(workspace["tokens"]["admin"]),
        json={"confirm_name": "Settings Test Org"},
    )
    assert refused.status_code == 403, refused.text


# --- Audit trail ------------------------------------------------------------


def test_settings_changes_are_audited(client: TestClient, workspace, db_session):
    org_id = workspace["org_id"]
    token = workspace["tokens"]["owner"]

    client.patch(
        f"/api/v1/organizations/{org_id}/settings",
        headers=_auth(token),
        json={"ai": {"default_model": "qwen3:4b"}},
    )

    events = db_session.scalars(
        select(SecurityAuditEvent).where(
            SecurityAuditEvent.organization_id == org_id,
            SecurityAuditEvent.action
            == "workspace.ai_configuration_updated",
        )
    ).all()
    assert events, "the AI configuration change must be audited"
    event = events[0]
    assert event.actor_user_id is not None
    assert event.resource_type == "workspace"
    assert event.changes["after"]["default_model"] == "qwen3:4b"


def test_personal_settings_changes_are_audited(
    client: TestClient, workspace, db_session
):
    org_id = workspace["org_id"]
    token = workspace["tokens"]["developer"]

    client.patch(
        "/api/v1/settings/me",
        headers=_auth(token),
        json={"full_name": "Audited User"},
    )

    events = db_session.scalars(
        select(SecurityAuditEvent).where(
            SecurityAuditEvent.organization_id == org_id,
            SecurityAuditEvent.action == "user.settings_updated",
        )
    ).all()
    assert events, "a personal settings change must be audited"


def test_settings_rows_are_persisted(client: TestClient, workspace, db_session):
    org_id = workspace["org_id"]
    token = workspace["tokens"]["owner"]

    client.patch(
        f"/api/v1/organizations/{org_id}/settings",
        headers=_auth(token),
        json={"data": {"retention_days": 90}},
    )
    client.get("/api/v1/settings/me", headers=_auth(token))

    workspace_row = db_session.scalar(
        select(WorkspaceSettings).where(
            WorkspaceSettings.organization_id == org_id
        )
    )
    assert workspace_row is not None
    assert workspace_row.retention_days == 90

    user_row = db_session.scalar(
        select(UserSettings).where(
            UserSettings.user_id == db_session.scalar(
                select(Membership.user_id).where(
                    Membership.organization_id == org_id,
                    Membership.role == DbRole.OWNER,
                )
            )
        )
    )
    assert user_row is not None
