"""Workflow catalog and execution history.

These tests use the existing approval graph. They delete checkpoint rows for
the threads they create and do not reset database volumes.
"""

import uuid

from fastapi.testclient import TestClient
from psycopg import Connection
from psycopg.rows import dict_row

from app.ai.workflows.checkpointer import checkpoint_database_url

PASSWORD = "Workflow-Catalog-Secure-Pass"


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
        json={"name": "Workflow Agent", "description": "workflow catalog"},
    )
    assert created.status_code == 201, created.text
    return created.json()["id"]


def _delete_thread(thread_id: str) -> None:
    try:
        with Connection.connect(
            checkpoint_database_url(),
            autocommit=True,
            row_factory=dict_row,
        ) as connection:
            for table in ("checkpoint_writes", "checkpoint_blobs", "checkpoints"):
                connection.execute(
                    f"DELETE FROM langgraph.{table} WHERE thread_id = %s",
                    (thread_id,),
                )
    except Exception:
        return


def test_catalog_lists_only_the_implemented_workflow(client: TestClient):
    suffix = uuid.uuid4().hex[:8]
    token = _register(client, f"workflow-list-{suffix}@example.com")
    org_id = _organization(client, token, "Workflow List")
    listed = client.get(
        f"/api/v1/organizations/{org_id}/workflows/definitions",
        headers=_auth(token),
    )
    assert listed.status_code == 200, listed.text
    body = listed.json()
    assert [item["key"] for item in body] == ["demo_create_note"]
    assert body[0]["requires_approval"] is True
    assert body[0]["inputs"][1]["max_length"] == 500


def test_execution_pauses_then_records_approval_and_rejection(client: TestClient):
    suffix = uuid.uuid4().hex[:8]
    owner = _register(client, f"workflow-owner-{suffix}@example.com")
    org_id = _organization(client, owner, "Workflow Runs")
    agent_id = _agent(client, org_id, owner)
    threads: list[str] = []
    try:
        started = client.post(
            f"/api/v1/organizations/{org_id}/workflows/demo-action",
            headers=_auth(owner),
            json={"agent_id": agent_id, "note": "alpha note"},
        )
        assert started.status_code == 200, started.text
        pending = started.json()
        threads.append(pending["thread_id"])
        assert pending["status"] == "PENDING"
        assert pending["action"] == "demo_create_note"

        waiting = client.get(
            f"/api/v1/organizations/{org_id}/workflows/executions",
            headers=_auth(owner),
        )
        assert waiting.status_code == 200, waiting.text
        first = waiting.json()[0]
        assert first["id"] == pending["id"]
        assert first["display_status"] == "waiting_for_approval"
        assert first["result"] is None
        assert first["arguments"]["note"] == "alpha note"
        assert first["completed_at"] is None

        approved = client.post(
            f"/api/v1/organizations/{org_id}/approvals/{pending['id']}/decision",
            headers=_auth(owner),
            json={"approved": True},
        )
        assert approved.status_code == 200, approved.text
        assert approved.json()["thread_id"] == pending["thread_id"]

        completed = client.get(
            f"/api/v1/organizations/{org_id}/workflows/executions",
            headers=_auth(owner),
        ).json()[0]
        assert completed["display_status"] == "completed"
        assert completed["status"] == "APPROVED"
        assert completed["result"]["note"] == "Demo note created: alpha note"
        assert completed["completed_at"]

        again = client.post(
            f"/api/v1/organizations/{org_id}/approvals/{pending['id']}/decision",
            headers=_auth(owner),
            json={"approved": True},
        )
        assert again.status_code == 409, again.text

        rejected_start = client.post(
            f"/api/v1/organizations/{org_id}/workflows/demo-action",
            headers=_auth(owner),
            json={"agent_id": agent_id, "note": "beta note"},
        )
        assert rejected_start.status_code == 200, rejected_start.text
        second = rejected_start.json()
        threads.append(second["thread_id"])
        assert second["id"] != pending["id"]
        denied = client.post(
            f"/api/v1/organizations/{org_id}/approvals/{second['id']}/decision",
            headers=_auth(owner),
            json={"approved": False},
        )
        assert denied.status_code == 200, denied.text

        history = client.get(
            f"/api/v1/organizations/{org_id}/workflows/executions",
            headers=_auth(owner),
        ).json()
        assert len(history) == 2
        rejected = next(item for item in history if item["id"] == second["id"])
        assert rejected["display_status"] == "rejected"
        assert rejected["result"]["error"] == "Action rejected by human"
        kept = next(item for item in history if item["id"] == pending["id"])
        assert kept["result"]["note"] == "Demo note created: alpha note"
    finally:
        for thread_id in threads:
            _delete_thread(thread_id)


def test_invalid_input_and_workspace_isolation(client: TestClient):
    suffix = uuid.uuid4().hex[:8]
    owner = _register(client, f"workflow-guard-{suffix}@example.com")
    outsider = _register(client, f"workflow-out-{suffix}@example.com")
    viewer = _register(client, f"workflow-viewer-{suffix}@example.com")
    org_id = _organization(client, owner, "Workflow Guard")
    other = _organization(client, outsider, "Other Workflows")
    added = client.post(
        f"/api/v1/organizations/{org_id}/members",
        headers=_auth(owner),
        json={"email": f"workflow-viewer-{suffix}@example.com", "role": "VIEWER"},
    )
    assert added.status_code == 201, added.text
    agent_id = _agent(client, org_id, owner)

    blank = client.post(
        f"/api/v1/organizations/{org_id}/workflows/demo-action",
        headers=_auth(owner),
        json={"agent_id": agent_id, "note": ""},
    )
    assert blank.status_code == 422, blank.text

    missing = client.post(
        f"/api/v1/organizations/{org_id}/workflows/demo-action",
        headers=_auth(owner),
        json={"agent_id": str(uuid.uuid4()), "note": "missing agent"},
    )
    assert missing.status_code == 404, missing.text

    forbidden = client.post(
        f"/api/v1/organizations/{org_id}/workflows/demo-action",
        headers=_auth(viewer),
        json={"agent_id": agent_id, "note": "viewer note"},
    )
    assert forbidden.status_code == 403, forbidden.text

    anonymous = client.get(f"/api/v1/organizations/{org_id}/workflows/executions")
    assert anonymous.status_code == 401

    cross = client.get(
        f"/api/v1/organizations/{org_id}/workflows/executions",
        headers=_auth(outsider),
    )
    assert cross.status_code == 404, cross.text

    other_catalog = client.get(
        f"/api/v1/organizations/{other}/workflows/definitions",
        headers=_auth(owner),
    )
    assert other_catalog.status_code == 404, other_catalog.text
