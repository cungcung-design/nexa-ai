"""Tests for the Team module and workspace permission relationships."""

import uuid
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.db.models import User
from app.modules.security.audit_models import SecurityAuditEvent
from app.modules.team.models import OrganizationInvitation

PASSWORD = "Team-Module-Secure-Pass"


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
    """Owner, admin, developer and viewer members of one workspace."""
    suffix = uuid.uuid4().hex[:10]
    emails = {
        "owner": f"team-owner-{suffix}@example.com",
        "admin": f"team-admin-{suffix}@example.com",
        "developer": f"team-developer-{suffix}@example.com",
        "viewer": f"team-viewer-{suffix}@example.com",
        "outsider": f"team-outsider-{suffix}@example.com",
    }
    tokens = {role: _register(client, email) for role, email in emails.items()}

    organization = client.post(
        "/api/v1/organizations",
        headers=_auth(tokens["owner"]),
        json={"name": "Team Test Org", "slug": f"team-test-{suffix}"},
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

    return {
        "org_id": org_id,
        "emails": emails,
        "tokens": tokens,
    }


def _member_ids(client: TestClient, org_id: str, token: str) -> dict[str, str]:
    listing = client.get(
        f"/api/v1/organizations/{org_id}/team/members",
        headers=_auth(token),
    )
    assert listing.status_code == 200, listing.text
    return {item["email"]: item["id"] for item in listing.json()["items"]}


# --- Metrics and directory --------------------------------------------------


def test_team_metrics_use_real_backend_counts(client: TestClient, workspace):
    org_id = workspace["org_id"]
    tokens = workspace["tokens"]

    metrics = client.get(
        f"/api/v1/organizations/{org_id}/team/metrics",
        headers=_auth(tokens["owner"]),
    )
    assert metrics.status_code == 200, metrics.text
    body = metrics.json()
    assert body["total_members"] == 4
    assert body["active_members"] == 4
    assert body["suspended_members"] == 0
    assert body["pending_invitations"] == 0
    assert body["roles"] == 4

    listing = client.get(
        f"/api/v1/organizations/{org_id}/team/members",
        headers=_auth(tokens["owner"]),
    )
    assert listing.status_code == 200, listing.text
    assert listing.json()["total"] == 4
    emails = {item["email"] for item in listing.json()["items"]}
    assert emails == {
        workspace["emails"][role] for role in ("owner", "admin", "developer", "viewer")
    }


def test_members_directory_search_and_role_filter(client: TestClient, workspace):
    org_id = workspace["org_id"]
    token = workspace["tokens"]["owner"]

    filtered = client.get(
        f"/api/v1/organizations/{org_id}/team/members?role=viewer",
        headers=_auth(token),
    )
    assert filtered.status_code == 200, filtered.text
    assert filtered.json()["total"] == 1
    assert filtered.json()["items"][0]["role"] == "VIEWER"
    assert filtered.json()["items"][0]["role_label"] == "Viewer"

    searched = client.get(
        f"/api/v1/organizations/{org_id}/team/members?search=admin-",
        headers=_auth(token),
    )
    assert searched.status_code == 200, searched.text
    assert searched.json()["total"] == 1


def test_role_matrix_reflects_backend_permission_grants(client: TestClient, workspace):
    org_id = workspace["org_id"]
    token = workspace["tokens"]["owner"]

    matrix = client.get(
        f"/api/v1/organizations/{org_id}/team/permissions/matrix",
        headers=_auth(token),
    )
    assert matrix.status_code == 200, matrix.text
    body = matrix.json()
    assert body["roles"] == ["OWNER", "ADMIN", "DEVELOPER", "VIEWER"]

    capabilities = {row["capability"]: row for row in body["capabilities"]}
    assert capabilities["Manage Billing"]["grants"] == {
        "OWNER": True,
        "ADMIN": False,
        "DEVELOPER": False,
        "VIEWER": False,
    }
    assert capabilities["Manage Team"]["grants"]["DEVELOPER"] is False
    assert capabilities["View Agents"]["grants"]["VIEWER"] is True

    roles = client.get(
        f"/api/v1/organizations/{org_id}/team/roles",
        headers=_auth(token),
    )
    assert roles.status_code == 200, roles.text
    summaries = {row["role"]: row for row in roles.json()}
    assert summaries["OWNER"]["member_count"] == 1
    assert summaries["VIEWER"]["member_count"] == 1
    assert "member.manage" in summaries["ADMIN"]["permissions"]
    assert summaries["DEVELOPER"]["label"] == "Editor"


# --- Invitations ------------------------------------------------------------


def test_invitation_lifecycle_create_resend_and_revoke(client: TestClient, workspace):
    org_id = workspace["org_id"]
    token = workspace["tokens"]["owner"]
    invite_email = f"invited-{uuid.uuid4().hex[:8]}@example.com"

    created = client.post(
        f"/api/v1/organizations/{org_id}/team/invitations",
        headers=_auth(token),
        json={"email": invite_email, "role": "DEVELOPER", "message": "Join us"},
    )
    assert created.status_code == 201, created.text
    body = created.json()
    assert body["email"] == invite_email
    assert body["role"] == "DEVELOPER"
    assert body["role_label"] == "Editor"
    assert body["status"] == "PENDING"
    assert body["invite_token"]
    assert "agent.write" in body["permissions"]

    metrics = client.get(
        f"/api/v1/organizations/{org_id}/team/metrics",
        headers=_auth(token),
    )
    assert metrics.json()["pending_invitations"] == 1

    resend = client.post(
        f"/api/v1/organizations/{org_id}/team/invitations/{body['id']}/resend",
        headers=_auth(token),
    )
    assert resend.status_code == 200, resend.text
    assert resend.json()["invite_token"]
    assert resend.json()["invite_token"] != body["invite_token"]

    revoked = client.post(
        f"/api/v1/organizations/{org_id}/team/invitations/{body['id']}/revoke",
        headers=_auth(token),
    )
    assert revoked.status_code == 200, revoked.text
    assert revoked.json()["status"] == "REVOKED"

    metrics = client.get(
        f"/api/v1/organizations/{org_id}/team/metrics",
        headers=_auth(token),
    )
    assert metrics.json()["pending_invitations"] == 0


def test_invitation_tokens_are_never_returned_by_the_listing(
    client: TestClient, workspace
):
    org_id = workspace["org_id"]
    token = workspace["tokens"]["owner"]
    invite_email = f"hidden-token-{uuid.uuid4().hex[:8]}@example.com"

    created = client.post(
        f"/api/v1/organizations/{org_id}/team/invitations",
        headers=_auth(token),
        json={"email": invite_email, "role": "VIEWER"},
    )
    assert created.status_code == 201, created.text

    listing = client.get(
        f"/api/v1/organizations/{org_id}/team/invitations",
        headers=_auth(token),
    )
    assert listing.status_code == 200, listing.text
    assert len(listing.json()) == 1
    for invitation in listing.json():
        assert invitation["invite_token"] is None
        assert "token_hash" not in invitation
        assert "token" not in invitation


def test_duplicate_membership_and_invitation_are_rejected(
    client: TestClient, workspace
):
    org_id = workspace["org_id"]
    token = workspace["tokens"]["owner"]
    member_email = workspace["emails"]["viewer"]

    existing_member = client.post(
        f"/api/v1/organizations/{org_id}/team/invitations",
        headers=_auth(token),
        json={"email": member_email, "role": "VIEWER"},
    )
    assert existing_member.status_code == 409, existing_member.text

    invite_email = f"dup-{uuid.uuid4().hex[:8]}@example.com"
    first = client.post(
        f"/api/v1/organizations/{org_id}/team/invitations",
        headers=_auth(token),
        json={"email": invite_email, "role": "VIEWER"},
    )
    assert first.status_code == 201, first.text

    second = client.post(
        f"/api/v1/organizations/{org_id}/team/invitations",
        headers=_auth(token),
        json={"email": invite_email, "role": "VIEWER"},
    )
    assert second.status_code == 409, second.text


def test_invitation_requires_manage_permission(client: TestClient, workspace):
    org_id = workspace["org_id"]
    developer_token = workspace["tokens"]["developer"]

    response = client.post(
        f"/api/v1/organizations/{org_id}/team/invitations",
        headers=_auth(developer_token),
        json={"email": f"nope-{uuid.uuid4().hex[:8]}@example.com", "role": "VIEWER"},
    )
    assert response.status_code == 403, response.text

    listing = client.get(
        f"/api/v1/organizations/{org_id}/team/invitations",
        headers=_auth(developer_token),
    )
    assert listing.status_code == 403, listing.text


def test_invitation_accept_creates_membership_with_assigned_role(
    client: TestClient, workspace
):
    org_id = workspace["org_id"]
    owner_token = workspace["tokens"]["owner"]
    invite_email = f"accept-{uuid.uuid4().hex[:8]}@example.com"

    created = client.post(
        f"/api/v1/organizations/{org_id}/team/invitations",
        headers=_auth(owner_token),
        json={"email": invite_email, "role": "DEVELOPER"},
    )
    assert created.status_code == 201, created.text
    invite_token = created.json()["invite_token"]

    preview = client.get(f"/api/v1/invitations/{invite_token}")
    assert preview.status_code == 200, preview.text
    assert preview.json()["status"] == "PENDING"
    assert preview.json()["role_label"] == "Editor"
    assert preview.json()["organization_id"] == org_id

    invitee_token = _register(client, invite_email)

    accepted = client.post(
        f"/api/v1/invitations/{invite_token}/accept",
        headers=_auth(invitee_token),
    )
    assert accepted.status_code == 200, accepted.text
    assert accepted.json()["role"] == "DEVELOPER"

    members = client.get(
        f"/api/v1/organizations/{org_id}/team/members",
        headers=_auth(owner_token),
    )
    assert members.json()["total"] == 5

    # Accepting twice is a conflict.
    again = client.post(
        f"/api/v1/invitations/{invite_token}/accept",
        headers=_auth(invitee_token),
    )
    assert again.status_code == 409, again.text


def test_invitation_accept_rejects_a_different_identity(
    client: TestClient, workspace
):
    org_id = workspace["org_id"]
    owner_token = workspace["tokens"]["owner"]
    invite_email = f"identity-{uuid.uuid4().hex[:8]}@example.com"

    created = client.post(
        f"/api/v1/organizations/{org_id}/team/invitations",
        headers=_auth(owner_token),
        json={"email": invite_email, "role": "VIEWER"},
    )
    invite_token = created.json()["invite_token"]

    other_token = _register(client, f"other-{uuid.uuid4().hex[:8]}@example.com")
    rejected = client.post(
        f"/api/v1/invitations/{invite_token}/accept",
        headers=_auth(other_token),
    )
    assert rejected.status_code == 403, rejected.text


def test_revoked_and_expired_invitations_cannot_be_accepted(
    client: TestClient, workspace, db_session
):
    org_id = workspace["org_id"]
    owner_token = workspace["tokens"]["owner"]

    revoked_email = f"revoked-{uuid.uuid4().hex[:8]}@example.com"
    revoked = client.post(
        f"/api/v1/organizations/{org_id}/team/invitations",
        headers=_auth(owner_token),
        json={"email": revoked_email, "role": "VIEWER"},
    )
    revoked_token = revoked.json()["invite_token"]
    client.post(
        f"/api/v1/organizations/{org_id}/team/invitations/{revoked.json()['id']}/revoke",
        headers=_auth(owner_token),
    )
    revoked_invitee = _register(client, revoked_email)
    revoked_result = client.post(
        f"/api/v1/invitations/{revoked_token}/accept",
        headers=_auth(revoked_invitee),
    )
    assert revoked_result.status_code == 409, revoked_result.text

    expired_email = f"expired-{uuid.uuid4().hex[:8]}@example.com"
    expired = client.post(
        f"/api/v1/organizations/{org_id}/team/invitations",
        headers=_auth(owner_token),
        json={"email": expired_email, "role": "VIEWER"},
    )
    expired_token = expired.json()["invite_token"]
    expired_id = uuid.UUID(expired.json()["id"])

    invitation = db_session.get(OrganizationInvitation, expired_id)
    assert invitation is not None
    invitation.expires_at = datetime.now(timezone.utc) - timedelta(days=1)
    db_session.commit()

    preview = client.get(f"/api/v1/invitations/{expired_token}")
    assert preview.status_code == 200, preview.text
    assert preview.json()["status"] == "EXPIRED"

    expired_invitee = _register(client, expired_email)
    expired_result = client.post(
        f"/api/v1/invitations/{expired_token}/accept",
        headers=_auth(expired_invitee),
    )
    assert expired_result.status_code == 409, expired_result.text


def test_unknown_invitation_token_is_not_found(client: TestClient):
    response = client.get("/api/v1/invitations/not-a-real-token")
    assert response.status_code == 404, response.text


# --- Membership management --------------------------------------------------


def test_role_change_and_suspend_require_permission(client: TestClient, workspace):
    org_id = workspace["org_id"]
    tokens = workspace["tokens"]
    ids = _member_ids(client, org_id, tokens["owner"])
    developer_membership = ids[workspace["emails"]["developer"]]

    forbidden = client.patch(
        f"/api/v1/organizations/{org_id}/team/members/{developer_membership}",
        headers=_auth(tokens["developer"]),
        json={"role": "ADMIN"},
    )
    assert forbidden.status_code == 403, forbidden.text

    changed = client.patch(
        f"/api/v1/organizations/{org_id}/team/members/{developer_membership}",
        headers=_auth(tokens["owner"]),
        json={"role": "ADMIN"},
    )
    assert changed.status_code == 200, changed.text
    assert changed.json()["role"] == "ADMIN"
    assert changed.json()["role_label"] == "Admin"


def test_admins_cannot_grant_a_role_above_their_own(client: TestClient, workspace):
    org_id = workspace["org_id"]
    tokens = workspace["tokens"]
    ids = _member_ids(client, org_id, tokens["owner"])
    viewer_membership = ids[workspace["emails"]["viewer"]]

    escalation = client.patch(
        f"/api/v1/organizations/{org_id}/team/members/{viewer_membership}",
        headers=_auth(tokens["admin"]),
        json={"role": "OWNER"},
    )
    assert escalation.status_code == 403, escalation.text

    admin_grant = client.patch(
        f"/api/v1/organizations/{org_id}/team/members/{viewer_membership}",
        headers=_auth(tokens["admin"]),
        json={"role": "ADMIN"},
    )
    assert admin_grant.status_code == 200, admin_grant.text


def test_last_active_owner_cannot_be_demoted_suspended_or_removed(
    client: TestClient, workspace
):
    org_id = workspace["org_id"]
    tokens = workspace["tokens"]
    ids = _member_ids(client, org_id, tokens["owner"])
    owner_membership = ids[workspace["emails"]["owner"]]

    demoted = client.patch(
        f"/api/v1/organizations/{org_id}/team/members/{owner_membership}",
        headers=_auth(tokens["admin"]),
        json={"role": "VIEWER"},
    )
    assert demoted.status_code == 409, demoted.text

    suspended = client.patch(
        f"/api/v1/organizations/{org_id}/team/members/{owner_membership}",
        headers=_auth(tokens["admin"]),
        json={"status": "SUSPENDED"},
    )
    assert suspended.status_code == 409, suspended.text

    removed = client.delete(
        f"/api/v1/organizations/{org_id}/team/members/{owner_membership}",
        headers=_auth(tokens["admin"]),
    )
    assert removed.status_code == 409, removed.text

    # The owner membership is untouched.
    still_owner = client.get(
        f"/api/v1/organizations/{org_id}/team/members",
        headers=_auth(tokens["owner"]),
    )
    entry = next(
        item
        for item in still_owner.json()["items"]
        if item["id"] == owner_membership
    )
    assert entry["role"] == "OWNER"
    assert entry["status"] == "ACTIVE"


def test_admins_cannot_change_the_owner(client: TestClient, workspace):
    org_id = workspace["org_id"]
    tokens = workspace["tokens"]
    emails = workspace["emails"]

    second_owner = client.post(
        f"/api/v1/organizations/{org_id}/members",
        headers=_auth(tokens["owner"]),
        json={"email": emails["outsider"], "role": "OWNER"},
    )
    assert second_owner.status_code == 201, second_owner.text

    ids = _member_ids(client, org_id, tokens["owner"])
    owner_membership = ids[emails["owner"]]

    response = client.patch(
        f"/api/v1/organizations/{org_id}/team/members/{owner_membership}",
        headers=_auth(tokens["admin"]),
        json={"role": "VIEWER"},
    )
    assert response.status_code == 403, response.text

    removal = client.delete(
        f"/api/v1/organizations/{org_id}/team/members/{owner_membership}",
        headers=_auth(tokens["admin"]),
    )
    assert removal.status_code == 403, removal.text


def test_owners_cannot_change_their_own_membership(client: TestClient, workspace):
    org_id = workspace["org_id"]
    tokens = workspace["tokens"]
    emails = workspace["emails"]
    ids = _member_ids(client, org_id, tokens["owner"])
    owner_membership = ids[emails["owner"]]

    # The workspace only has one owner, so the owner may not step down.
    response = client.patch(
        f"/api/v1/organizations/{org_id}/team/members/{owner_membership}",
        headers=_auth(tokens["owner"]),
        json={"role": "ADMIN"},
    )
    assert response.status_code == 409, response.text

    second_owner = client.post(
        f"/api/v1/organizations/{org_id}/members",
        headers=_auth(tokens["owner"]),
        json={"email": emails["outsider"], "role": "OWNER"},
    )
    assert second_owner.status_code == 201, second_owner.text

    # With a second owner the self guard applies instead.
    self_change = client.patch(
        f"/api/v1/organizations/{org_id}/team/members/{owner_membership}",
        headers=_auth(tokens["owner"]),
        json={"role": "ADMIN"},
    )
    assert self_change.status_code == 400, self_change.text

    removal = client.delete(
        f"/api/v1/organizations/{org_id}/team/members/{owner_membership}",
        headers=_auth(tokens["owner"]),
    )
    assert removal.status_code == 400, removal.text


def test_suspended_member_loses_workspace_access_in_the_same_session(
    client: TestClient, workspace
):
    org_id = workspace["org_id"]
    tokens = workspace["tokens"]
    ids = _member_ids(client, org_id, tokens["owner"])
    viewer_membership = ids[workspace["emails"]["viewer"]]
    viewer_token = tokens["viewer"]

    allowed = client.get(
        f"/api/v1/organizations/{org_id}/agents",
        headers=_auth(viewer_token),
    )
    assert allowed.status_code == 200, allowed.text

    suspended = client.patch(
        f"/api/v1/organizations/{org_id}/team/members/{viewer_membership}",
        headers=_auth(tokens["owner"]),
        json={"status": "SUSPENDED"},
    )
    assert suspended.status_code == 200, suspended.text
    assert suspended.json()["status"] == "SUSPENDED"
    assert suspended.json()["permissions"] == []

    blocked = client.get(
        f"/api/v1/organizations/{org_id}/agents",
        headers=_auth(viewer_token),
    )
    assert blocked.status_code == 403, blocked.text

    metrics = client.get(
        f"/api/v1/organizations/{org_id}/team/metrics",
        headers=_auth(tokens["owner"]),
    )
    assert metrics.json()["active_members"] == 3
    assert metrics.json()["suspended_members"] == 1

    reactivated = client.patch(
        f"/api/v1/organizations/{org_id}/team/members/{viewer_membership}",
        headers=_auth(tokens["owner"]),
        json={"status": "ACTIVE"},
    )
    assert reactivated.status_code == 200, reactivated.text
    restored = client.get(
        f"/api/v1/organizations/{org_id}/agents",
        headers=_auth(viewer_token),
    )
    assert restored.status_code == 200, restored.text


def test_removing_a_membership_keeps_the_user_and_other_memberships(
    client: TestClient, workspace
):
    org_id = workspace["org_id"]
    tokens = workspace["tokens"]
    emails = workspace["emails"]
    ids = _member_ids(client, org_id, tokens["owner"])
    viewer_membership = ids[emails["viewer"]]

    other_org = client.post(
        "/api/v1/organizations",
        headers=_auth(tokens["viewer"]),
        json={"name": "Second Org", "slug": f"second-org-{uuid.uuid4().hex[:8]}"},
    )
    assert other_org.status_code == 201, other_org.text
    other_org_id = other_org.json()["id"]

    removed = client.delete(
        f"/api/v1/organizations/{org_id}/team/members/{viewer_membership}",
        headers=_auth(tokens["owner"]),
    )
    assert removed.status_code == 204, removed.text

    # The account still exists and keeps its other workspace membership.
    organizations = client.get(
        "/api/v1/organizations",
        headers=_auth(tokens["viewer"]),
    )
    assert organizations.status_code == 200, organizations.text
    remaining = {org["id"] for org in organizations.json()}
    assert other_org_id in remaining
    assert org_id not in remaining

    profile = client.get("/api/v1/auth/me", headers=_auth(tokens["viewer"]))
    assert profile.status_code == 200, profile.text
    assert profile.json()["email"] == emails["viewer"]


def test_team_endpoints_are_isolated_between_organizations(
    client: TestClient, workspace
):
    org_id = workspace["org_id"]
    tokens = workspace["tokens"]

    outsider_members = client.get(
        f"/api/v1/organizations/{org_id}/team/members",
        headers=_auth(tokens["outsider"]),
    )
    assert outsider_members.status_code == 404, outsider_members.text

    outsider_metrics = client.get(
        f"/api/v1/organizations/{org_id}/team/metrics",
        headers=_auth(tokens["outsider"]),
    )
    assert outsider_metrics.status_code == 404, outsider_metrics.text

    ids = _member_ids(client, org_id, tokens["owner"])
    outsider_detail = client.get(
        f"/api/v1/organizations/{org_id}/team/members/{ids[workspace['emails']['viewer']]}",
        headers=_auth(tokens["outsider"]),
    )
    assert outsider_detail.status_code == 404, outsider_detail.text


def test_member_detail_resolves_effective_permissions_and_resources(
    client: TestClient, workspace
):
    org_id = workspace["org_id"]
    tokens = workspace["tokens"]

    agent = client.post(
        f"/api/v1/organizations/{org_id}/agents",
        headers=_auth(tokens["owner"]),
        json={"name": "Team Agent", "description": "Fixture"},
    )
    assert agent.status_code == 201, agent.text

    ids = _member_ids(client, org_id, tokens["owner"])
    developer_detail = client.get(
        f"/api/v1/organizations/{org_id}/team/members/{ids[workspace['emails']['developer']]}",
        headers=_auth(tokens["owner"]),
    )
    assert developer_detail.status_code == 200, developer_detail.text
    body = developer_detail.json()

    granted = {entry["permission"] for entry in body["effective_permissions"] if entry["granted"]}
    assert "agent.write" in granted
    assert "member.manage" not in granted
    assert body["granted_permissions"] == sorted(granted)
    assert body["groups_supported"] is False
    assert body["direct_access_supported"] is False
    assert body["groups_note"]
    assert body["direct_access_note"]
    assert body["resources"]["workflows_supported"] is False
    assert any(
        resource["name"] == "Team Agent" for resource in body["resources"]["agents"]
    )


def test_member_activity_is_filtered_to_the_member_actor_id(
    client: TestClient, workspace
):
    org_id = workspace["org_id"]
    tokens = workspace["tokens"]
    ids = _member_ids(client, org_id, tokens["owner"])

    client.patch(
        f"/api/v1/organizations/{org_id}/team/members/{ids[workspace['emails']['developer']]}",
        headers=_auth(tokens["owner"]),
        json={"role": "ADMIN"},
    )

    detail = client.get(
        f"/api/v1/organizations/{org_id}/team/members/{ids[workspace['emails']['developer']]}",
        headers=_auth(tokens["owner"]),
    )
    assert detail.status_code == 200, detail.text
    activity = detail.json()["activity"]
    assert activity
    assert any(entry["action"] == "member.role_changed" for entry in activity)


# --- Audit records ----------------------------------------------------------


def test_team_changes_are_audited_without_invitation_tokens(
    client: TestClient, workspace
):
    org_id = workspace["org_id"]
    tokens = workspace["tokens"]
    invite_email = f"audited-{uuid.uuid4().hex[:8]}@example.com"

    created = client.post(
        f"/api/v1/organizations/{org_id}/team/invitations",
        headers=_auth(tokens["owner"]),
        json={"email": invite_email, "role": "VIEWER"},
    )
    assert created.status_code == 201, created.text
    invite_token = created.json()["invite_token"]

    ids = _member_ids(client, org_id, tokens["owner"])
    client.patch(
        f"/api/v1/organizations/{org_id}/team/members/{ids[workspace['emails']['viewer']]}",
        headers=_auth(tokens["owner"]),
        json={"role": "DEVELOPER"},
    )

    events = client.get(
        f"/api/v1/organizations/{org_id}/audit-logs?limit=100",
        headers=_auth(tokens["owner"]),
    )
    assert events.status_code == 200, events.text
    items = events.json()["items"]
    actions = {item["action"] for item in items}
    assert "member.invited" in actions
    assert "member.role_changed" in actions

    invited = next(item for item in items if item["action"] == "member.invited")
    assert invited["organization_id"] == org_id
    assert invited["actor_email"] == workspace["emails"]["owner"]
    assert invited["resource_name"] == invite_email
    assert invited["outcome"] == "success"
    assert invite_token not in events.text


def test_audit_events_record_before_and_after_role_values(
    client: TestClient, workspace, db_session
):
    org_id = workspace["org_id"]
    tokens = workspace["tokens"]
    ids = _member_ids(client, org_id, tokens["owner"])

    client.patch(
        f"/api/v1/organizations/{org_id}/team/members/{ids[workspace['emails']['viewer']]}",
        headers=_auth(tokens["owner"]),
        json={"role": "DEVELOPER"},
    )

    event = db_session.scalar(
        select(SecurityAuditEvent)
        .where(
            SecurityAuditEvent.organization_id == uuid.UUID(org_id),
            SecurityAuditEvent.action == "member.role_changed",
        )
        .order_by(SecurityAuditEvent.created_at.desc())
    )
    assert event is not None
    assert event.changes["before"]["role"] == "VIEWER"
    assert event.changes["after"]["role"] == "DEVELOPER"
    assert event.actor_user_id is not None
    assert event.resource_id is not None
