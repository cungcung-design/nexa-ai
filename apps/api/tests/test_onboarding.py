"""Tests for the onboarding flow.

The suite covers the progress of a new account, the order of the steps, the
workspace, the plan, the first agent, and the way a user continues in a
workspace of a team.
"""

import uuid

import pytest
from fastapi.testclient import TestClient

PASSWORD = "Onboarding-Secure-Pass"


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _unique_email(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:10]}@example.com"


def _register(client: TestClient, email: str) -> str:
    created = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": PASSWORD},
    )
    assert created.status_code == 201, created.text
    return created.json()["access_token"]


def _verify(client: TestClient, token: str) -> None:
    """Confirm the address of the signed in user."""
    sent = client.post("/api/v1/auth/verification/send", headers=_auth(token))
    assert sent.status_code == 200, sent.text
    link = sent.json()["verification_url"]
    assert link, sent.text
    confirmed = client.post(
        "/api/v1/auth/verification/confirm",
        json={"token": link.split("token=")[-1]},
    )
    assert confirmed.status_code == 200, confirmed.text


def _verified_account(client: TestClient, prefix: str) -> str:
    token = _register(client, _unique_email(prefix))
    _verify(client, token)
    return token


def _verified_account_with_email(client: TestClient, prefix: str) -> tuple[str, str]:
    email = _unique_email(prefix)
    token = _register(client, email)
    _verify(client, token)
    return token, email


def test_the_progress_of_a_new_account_starts_at_the_welcome(client: TestClient):
    token = _verified_account(client, "onboarding-state")

    response = client.get("/api/v1/onboarding/state", headers=_auth(token))

    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["step"] == "welcome"
    assert payload["completed_steps"] == []
    assert payload["workspace"] is None
    assert payload["email_verified"] is True


def test_an_unconfirmed_address_cannot_start_the_onboarding(client: TestClient):
    token = _register(client, _unique_email("onboarding-unverified"))

    response = client.post(
        "/api/v1/onboarding/step", json={"step": "welcome"}, headers=_auth(token)
    )

    assert response.status_code == 403, response.text
    assert "email address" in response.json()["detail"].lower()


def test_only_the_steps_that_collect_a_choice_can_be_marked(client: TestClient):
    token = _verified_account(client, "onboarding-step")

    welcome = client.post(
        "/api/v1/onboarding/step", json={"step": "welcome"}, headers=_auth(token)
    )
    assert welcome.status_code == 200, welcome.text
    assert welcome.json()["completed_steps"] == ["welcome"]
    assert welcome.json()["step"] == "workspace"

    rejected = client.post(
        "/api/v1/onboarding/step",
        json={"step": "workspace_information"},
        headers=_auth(token),
    )
    assert rejected.status_code == 400, rejected.text


def test_the_workspace_needs_the_steps_before_it(client: TestClient):
    token = _verified_account(client, "onboarding-order")

    too_early = client.post(
        "/api/v1/onboarding/workspace",
        json={"name": "Too Early", "slug": "too-early"},
        headers=_auth(token),
    )
    assert too_early.status_code == 409, too_early.text

    client.post(
        "/api/v1/onboarding/step", json={"step": "welcome"}, headers=_auth(token)
    )
    client.post(
        "/api/v1/onboarding/step", json={"step": "workspace"}, headers=_auth(token)
    )

    created = client.post(
        "/api/v1/onboarding/workspace",
        json={"name": "Order Workspace", "slug": "order-workspace"},
        headers=_auth(token),
    )
    assert created.status_code == 201, created.text
    assert created.json()["slug"] == "order-workspace"


def test_a_slug_that_is_taken_is_reported(client: TestClient):
    token = _verified_account(client, "onboarding-slug")
    taken = f"taken-{uuid.uuid4().hex[:8]}"

    client.post(
        "/api/v1/onboarding/step", json={"step": "welcome"}, headers=_auth(token)
    )
    client.post(
        "/api/v1/onboarding/step", json={"step": "workspace"}, headers=_auth(token)
    )
    first = client.post(
        "/api/v1/onboarding/workspace",
        json={"name": "First", "slug": taken},
        headers=_auth(token),
    )
    assert first.status_code == 201, first.text

    available = client.get(
        "/api/v1/onboarding/slug-available",
        params={"slug": taken},
        headers=_auth(token),
    )
    assert available.status_code == 200, available.text
    assert available.json()["available"] is False

    second = client.post(
        "/api/v1/onboarding/workspace",
        json={"name": "Second", "slug": taken},
        headers=_auth(token),
    )
    assert second.status_code == 409, second.text


def test_the_plan_comes_from_the_backend_and_activates_the_free_plan(
    client: TestClient,
):
    token = _verified_account(client, "onboarding-plan")
    client.post(
        "/api/v1/onboarding/step", json={"step": "welcome"}, headers=_auth(token)
    )
    client.post(
        "/api/v1/onboarding/step", json={"step": "workspace"}, headers=_auth(token)
    )
    workspace = client.post(
        "/api/v1/onboarding/workspace",
        json={"name": "Plan Workspace", "slug": f"plan-{uuid.uuid4().hex[:8]}"},
        headers=_auth(token),
    ).json()

    plans = client.get("/api/v1/onboarding/plans", headers=_auth(token))
    assert plans.status_code == 200, plans.text
    keys = [plan["key"] for plan in plans.json()["plans"]]
    assert "FREE" in keys
    assert "PRO" in keys
    assert "BUSINESS" in keys

    selected = client.post(
        "/api/v1/onboarding/plan",
        json={"workspace_id": workspace["id"], "plan": "FREE"},
        headers=_auth(token),
    )
    assert selected.status_code == 200, selected.text
    assert selected.json()["plan"] == "FREE"

    state = client.get("/api/v1/onboarding/state", headers=_auth(token)).json()
    assert state["plan"] == "FREE"
    assert state["step"] == "first_agent"


def test_the_first_agent_is_created_from_the_template(client: TestClient):
    token = _verified_account(client, "onboarding-agent")
    client.post(
        "/api/v1/onboarding/step", json={"step": "welcome"}, headers=_auth(token)
    )
    client.post(
        "/api/v1/onboarding/step", json={"step": "workspace"}, headers=_auth(token)
    )
    workspace = client.post(
        "/api/v1/onboarding/workspace",
        json={"name": "Agent Workspace", "slug": f"agent-{uuid.uuid4().hex[:8]}"},
        headers=_auth(token),
    ).json()
    client.post(
        "/api/v1/onboarding/plan",
        json={"workspace_id": workspace["id"], "plan": "FREE"},
        headers=_auth(token),
    )

    created = client.post(
        "/api/v1/onboarding/agent",
        json={"workspace_id": workspace["id"]},
        headers=_auth(token),
    )
    assert created.status_code == 201, created.text
    assert created.json()["created"] is True
    assert created.json()["name"]

    state = client.get("/api/v1/onboarding/state", headers=_auth(token)).json()
    assert state["step"] == "complete"
    assert "first_agent" in state["completed_steps"]


def test_skipping_finishes_the_onboarding(client: TestClient):
    token = _verified_account(client, "onboarding-skip")
    client.post(
        "/api/v1/onboarding/step", json={"step": "welcome"}, headers=_auth(token)
    )

    skipped = client.post("/api/v1/onboarding/skip", headers=_auth(token))

    assert skipped.status_code == 200, skipped.text
    assert skipped.json()["step"] == "complete"


def test_a_member_continues_in_the_workspace_of_the_team(client: TestClient):
    token, member_email = _verified_account_with_email(client, "onboarding-join")
    owner = _verified_account(client, "onboarding-owner")
    workspace = client.post(
        "/api/v1/organizations",
        json={"name": "Team Workspace", "slug": f"team-{uuid.uuid4().hex[:8]}"},
        headers=_auth(owner),
    )
    assert workspace.status_code == 201, workspace.text
    organization_id = workspace.json()["id"]

    invitation = client.post(
        f"/api/v1/organizations/{organization_id}/team/invitations",
        json={"email": member_email, "role": "developer"},
        headers=_auth(owner),
    )
    assert invitation.status_code == 201, invitation.text
    token_value = invitation.json()["invite_token"]
    assert token_value

    accepted = client.post(
        f"/api/v1/invitations/{token_value}/accept", headers=_auth(token)
    )
    assert accepted.status_code == 200, accepted.text

    joined = client.post(
        "/api/v1/onboarding/join",
        json={"workspace_id": organization_id},
        headers=_auth(token),
    )
    assert joined.status_code == 200, joined.text
    assert joined.json()["step"] == "first_agent"

    state = client.get("/api/v1/onboarding/state", headers=_auth(token)).json()
    assert state["workspace"]["id"] == organization_id
    assert "welcome" in state["completed_steps"]
    assert "workspace" in state["completed_steps"]


def test_a_user_cannot_continue_in_a_workspace_of_somebody_else(client: TestClient):
    token = _verified_account(client, "onboarding-outsider")
    owner = _verified_account(client, "onboarding-other-owner")
    workspace = client.post(
        "/api/v1/organizations",
        json={"name": "Other Workspace", "slug": f"other-{uuid.uuid4().hex[:8]}"},
        headers=_auth(owner),
    ).json()

    response = client.post(
        "/api/v1/onboarding/join",
        json={"workspace_id": workspace["id"]},
        headers=_auth(token),
    )

    assert response.status_code == 404, response.text
