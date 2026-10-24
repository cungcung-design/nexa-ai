"""Durable workflow checkpoints.

These tests use the test database's langgraph schema. They do not flush or
rebuild PostgreSQL. Checkpoint rows created here are deleted by thread id.
"""

import json
import os
import subprocess
import sys
import threading
import uuid
from pathlib import Path

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from psycopg import Connection
from psycopg.rows import dict_row
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session
from langgraph.types import Command

from app.ai.workflows.approval import (
    awaiting_human_approval,
    build_approval_graph,
    checkpoint_organization_id,
)
from app.ai.workflows.checkpointer import (
    checkpoint_database_url,
    get_approval_graph,
    open_checkpoint_runtime,
    shutdown_checkpointer,
)
from app.core.permissions import Role
from app.core.security import hash_password
from app.db.models import Agent, Membership, Organization, User, WorkflowApproval
from app.modules.security.audit_models import SecurityAuditEvent
from app.modules.workflows.router import apply_workflow_decision

PASSWORD = "Checkpoint-Module-Secure-Pass"
API_ROOT = Path(__file__).resolve().parents[1]


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
    suffix = uuid.uuid4().hex[:10]
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
        json={"name": "Checkpoint Agent", "description": "approval persistence"},
    )
    assert created.status_code == 201, created.text
    return created.json()["id"]


def _start(client: TestClient, org_id: str, token: str, agent_id: str, note: str):
    response = client.post(
        f"/api/v1/organizations/{org_id}/workflows/demo-action",
        headers=_auth(token),
        json={"agent_id": agent_id, "note": note},
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["status"] == "PENDING"
    return body


def _decide(client: TestClient, org_id: str, token: str, approval_id: str, approved: bool):
    return client.post(
        f"/api/v1/organizations/{org_id}/workflows/approvals/{approval_id}/decision",
        headers=_auth(token),
        json={"approved": approved},
    )


def _dashboard_decide(
    client: TestClient, org_id: str, token: str, approval_id: str, approved: bool
):
    return client.post(
        f"/api/v1/organizations/{org_id}/approvals/{approval_id}/decision",
        headers=_auth(token),
        json={"approved": approved},
    )


def _delete_thread(thread_id: str) -> None:
    try:
        with Connection.connect(
            checkpoint_database_url(),
            autocommit=True,
            row_factory=dict_row,
        ) as connection:
            for table in (
                "checkpoint_writes",
                "checkpoint_blobs",
                "checkpoints",
            ):
                connection.execute(
                    f"DELETE FROM langgraph.{table} WHERE thread_id = %s",
                    (thread_id,),
                )
    except Exception:
        return


def _checkpoint_count(thread_id: str) -> int:
    with Connection.connect(
        checkpoint_database_url(),
        autocommit=True,
        row_factory=dict_row,
    ) as connection:
        row = connection.execute(
            """
            SELECT COUNT(*) AS n
            FROM langgraph.checkpoints
            WHERE thread_id = %s
            """,
            (thread_id,),
        ).fetchone()
    return int(row["n"])


def _latest_checkpoint_id(thread_id: str) -> str | None:
    runtime = open_checkpoint_runtime()
    try:
        graph = build_approval_graph(runtime.saver)
        snapshot = graph.get_state({"configurable": {"thread_id": thread_id}})
        configurable = (snapshot.config or {}).get("configurable", {})
        return configurable.get("checkpoint_id")
    finally:
        runtime.close()


def _graph_state(thread_id: str):
    runtime = open_checkpoint_runtime()
    try:
        graph = build_approval_graph(runtime.saver)
        return graph.get_state({"configurable": {"thread_id": thread_id}})
    finally:
        runtime.close()


def test_checkpoint_url_rejects_non_postgres(monkeypatch):
    monkeypatch.setenv("CHECKPOINT_DATABASE_URL", "sqlite:///checkpoints.db")
    with pytest.raises(RuntimeError, match="PostgreSQL"):
        checkpoint_database_url()


def test_separate_checkpointers_resume_and_reject():
    if not os.getenv("TEST_DATABASE_URL"):
        pytest.skip("TEST_DATABASE_URL is not configured")

    approved_thread = str(uuid.uuid4())
    rejected_thread = str(uuid.uuid4())
    organization_id = str(uuid.uuid4())
    try:
        starter = open_checkpoint_runtime()
        try:
            graph = build_approval_graph(starter.saver)
            for thread_id, note in (
                (approved_thread, "keep this note"),
                (rejected_thread, "discard this note"),
            ):
                graph.invoke(
                    {
                        "organization_id": organization_id,
                        "agent_id": str(uuid.uuid4()),
                        "action": "demo_create_note",
                        "arguments": {"note": note},
                    },
                    {"configurable": {"thread_id": thread_id}},
                )
                paused = graph.get_state(
                    {"configurable": {"thread_id": thread_id}}
                )
                assert awaiting_human_approval(paused)
                assert checkpoint_organization_id(paused) == organization_id
                assert _checkpoint_count(thread_id) >= 1
        finally:
            starter.close()

        resumed = open_checkpoint_runtime()
        try:
            graph = build_approval_graph(resumed.saver)
            approved = graph.invoke(
                Command(resume=True),
                {"configurable": {"thread_id": approved_thread}},
            )
            rejected = graph.invoke(
                Command(resume=False),
                {"configurable": {"thread_id": rejected_thread}},
            )
        finally:
            resumed.close()

        assert approved["approved"] is True
        assert approved["result"]["note"] == "Demo note created: keep this note"
        assert rejected["approved"] is False
        assert rejected["result"]["error"] == "Action rejected by human"

        reread = _graph_state(approved_thread)
        assert not awaiting_human_approval(reread)
        assert reread.values["result"]["note"] == "Demo note created: keep this note"
        with Connection.connect(
            checkpoint_database_url(),
            autocommit=True,
            row_factory=dict_row,
        ) as connection:
            public_table = connection.execute(
                """
                SELECT 1 AS found
                FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = 'checkpoints'
                """
            ).fetchone()
            assert public_table is None
    finally:
        _delete_thread(approved_thread)
        _delete_thread(rejected_thread)


def test_workflow_resumes_in_a_new_process(tmp_path: Path):
    if not os.getenv("TEST_DATABASE_URL"):
        pytest.skip("TEST_DATABASE_URL is not configured")

    started = tmp_path / "started.json"
    finished = tmp_path / "finished.json"
    env = os.environ.copy()
    env["CHECKPOINT_DATABASE_URL"] = os.environ["TEST_DATABASE_URL"]
    env["PYTHONPATH"] = str(API_ROOT)
    thread_id = None
    try:
        start = subprocess.run(
            [
                sys.executable,
                str(API_ROOT / "tests" / "checkpoint_restart_worker.py"),
                "start",
                "after restart",
                str(started),
            ],
            cwd=API_ROOT,
            env=env,
            capture_output=True,
            text=True,
            timeout=120,
            check=False,
        )
        assert start.returncode == 0, start.stderr
        payload = json.loads(started.read_text(encoding="utf-8"))
        assert payload["waiting"] is True
        thread_id = payload["thread_id"]

        resume = subprocess.run(
            [
                sys.executable,
                str(API_ROOT / "tests" / "checkpoint_restart_worker.py"),
                "resume",
                thread_id,
                "true",
                str(finished),
            ],
            cwd=API_ROOT,
            env=env,
            capture_output=True,
            text=True,
            timeout=120,
            check=False,
        )
        assert resume.returncode == 0, resume.stderr
        result = json.loads(finished.read_text(encoding="utf-8"))
        assert result["result"]["note"] == "Demo note created: after restart"
    finally:
        if thread_id:
            _delete_thread(thread_id)


def test_api_restart_resumes_the_original_thread(client: TestClient):
    suffix = uuid.uuid4().hex[:10]
    owner = _register(client, f"checkpoint-owner-{suffix}@example.com")
    org_id = _organization(client, owner, "Checkpoint Org")
    agent_id = _agent(client, org_id, owner)
    pending = _start(client, org_id, owner, agent_id, "survive restart")
    thread_id = pending["thread_id"]
    try:
        assert _checkpoint_count(thread_id) >= 1
        paused = _graph_state(thread_id)
        assert awaiting_human_approval(paused)
        assert checkpoint_organization_id(paused) == org_id

        shutdown_checkpointer()

        decision = _decide(client, org_id, owner, pending["id"], True)
        assert decision.status_code == 200, decision.text
        assert decision.json()["status"] == "APPROVED"
        assert decision.json()["thread_id"] == thread_id

        finished = _graph_state(thread_id)
        assert not awaiting_human_approval(finished)
        assert finished.values["result"]["note"] == (
            "Demo note created: survive restart"
        )
    finally:
        _delete_thread(thread_id)


def test_repeated_approval_does_not_run_the_action_again(client: TestClient):
    suffix = uuid.uuid4().hex[:10]
    owner = _register(client, f"checkpoint-repeat-{suffix}@example.com")
    org_id = _organization(client, owner, "Repeat Org")
    agent_id = _agent(client, org_id, owner)
    pending = _start(client, org_id, owner, agent_id, "only once")
    thread_id = pending["thread_id"]
    try:
        first = _decide(client, org_id, owner, pending["id"], True)
        assert first.status_code == 200, first.text
        checkpoint_id = _latest_checkpoint_id(thread_id)
        writes_before = _checkpoint_count(thread_id)

        second = _decide(client, org_id, owner, pending["id"], True)
        assert second.status_code == 409, second.text
        assert second.json()["detail"] == "Approval already decided"
        assert _latest_checkpoint_id(thread_id) == checkpoint_id
        assert _checkpoint_count(thread_id) == writes_before
        assert _graph_state(thread_id).values["result"]["note"] == (
            "Demo note created: only once"
        )
    finally:
        _delete_thread(thread_id)


def test_missing_and_invalid_checkpoints_are_rejected(
    client: TestClient, db_session
):
    suffix = uuid.uuid4().hex[:10]
    owner = _register(client, f"checkpoint-missing-{suffix}@example.com")
    org_id = _organization(client, owner, "Missing Org")
    agent_id = _agent(client, org_id, owner)
    missing = _start(client, org_id, owner, agent_id, "lost checkpoint")
    invalid = _start(client, org_id, owner, agent_id, "bad thread")
    try:
        _delete_thread(missing["thread_id"])
        lost = _decide(client, org_id, owner, missing["id"], True)
        assert lost.status_code == 409, lost.text
        assert lost.json()["detail"] == "Workflow checkpoint not found"

        replacement = str(uuid.uuid4())
        row = db_session.scalar(
            select(WorkflowApproval).where(
                WorkflowApproval.id == uuid.UUID(invalid["id"])
            )
        )
        assert row is not None
        row.thread_id = replacement
        db_session.commit()
        unknown = _decide(client, org_id, owner, invalid["id"], True)
        assert unknown.status_code == 409, unknown.text
        assert unknown.json()["detail"] == "Workflow checkpoint not found"
        assert _graph_state(invalid["thread_id"]).values["arguments"]["note"] == (
            "bad thread"
        )
    finally:
        _delete_thread(missing["thread_id"])
        _delete_thread(invalid["thread_id"])


def test_cross_tenant_resume_is_rejected(client: TestClient, db_session):
    suffix = uuid.uuid4().hex[:10]
    owner_a = _register(client, f"checkpoint-a-{suffix}@example.com")
    owner_b = _register(client, f"checkpoint-b-{suffix}@example.com")
    viewer = _register(client, f"checkpoint-viewer-{suffix}@example.com")
    developer = _register(client, f"checkpoint-dev-{suffix}@example.com")
    org_a = _organization(client, owner_a, "Tenant A")
    org_b = _organization(client, owner_b, "Tenant B")
    for token, role in ((viewer, "VIEWER"), (developer, "DEVELOPER")):
        added = client.post(
            f"/api/v1/organizations/{org_a}/members",
            headers=_auth(owner_a),
            json={
                "email": f"checkpoint-{'viewer' if role == 'VIEWER' else 'dev'}-{suffix}@example.com",
                "role": role,
            },
        )
        assert added.status_code == 201, added.text

    agent_a = _agent(client, org_a, owner_a)
    agent_b = _agent(client, org_b, owner_b)
    pending_a = _start(client, org_a, developer, agent_a, "tenant a note")
    pending_b = _start(client, org_b, owner_b, agent_b, "tenant b note")
    try:
        viewer_decision = _decide(
            client, org_a, viewer, pending_a["id"], True
        )
        assert viewer_decision.status_code == 403, viewer_decision.text
        developer_decision = _decide(
            client, org_a, developer, pending_a["id"], True
        )
        assert developer_decision.status_code == 403, developer_decision.text

        other_workspace = _decide(
            client, org_b, owner_b, pending_a["id"], True
        )
        assert other_workspace.status_code == 404, other_workspace.text

        outsider = _decide(client, org_a, owner_b, pending_a["id"], True)
        assert outsider.status_code == 404, outsider.text

        stolen = db_session.scalar(
            select(WorkflowApproval).where(
                WorkflowApproval.id == uuid.UUID(pending_b["id"])
            )
        )
        assert stolen is not None
        stolen.thread_id = pending_a["thread_id"]
        db_session.commit()
        checkpoint_id = _latest_checkpoint_id(pending_a["thread_id"])
        bypass = _decide(client, org_b, owner_b, pending_b["id"], True)
        assert bypass.status_code == 404, bypass.text
        assert _latest_checkpoint_id(pending_a["thread_id"]) == checkpoint_id
        assert awaiting_human_approval(_graph_state(pending_a["thread_id"]))

        allowed = _decide(client, org_a, owner_a, pending_a["id"], False)
        assert allowed.status_code == 200, allowed.text
        assert allowed.json()["status"] == "REJECTED"
        finished = _graph_state(pending_a["thread_id"])
        assert finished.values["result"]["error"] == "Action rejected by human"
    finally:
        _delete_thread(pending_a["thread_id"])
        _delete_thread(pending_b["thread_id"])


def test_dashboard_approval_resumes_after_api_restart(client: TestClient, db_session):
    from app.modules.security.audit_models import SecurityAuditEvent

    suffix = uuid.uuid4().hex[:10]
    owner = _register(client, f"dashboard-approve-{suffix}@example.com")
    org_id = _organization(client, owner, "Dashboard Approve")
    agent_id = _agent(client, org_id, owner)
    pending = _start(client, org_id, owner, agent_id, "dashboard resume")
    thread_id = pending["thread_id"]
    try:
        assert awaiting_human_approval(_graph_state(thread_id))
        shutdown_checkpointer()

        decision = _dashboard_decide(client, org_id, owner, pending["id"], True)
        assert decision.status_code == 200, decision.text
        assert decision.json()["status"] == "APPROVED"
        assert decision.json()["thread_id"] == thread_id

        finished = _graph_state(thread_id)
        assert not awaiting_human_approval(finished)
        assert finished.values["result"]["note"] == "Demo note created: dashboard resume"

        db_session.expire_all()
        actions = set(
            db_session.scalars(
                select(SecurityAuditEvent.action).where(
                    SecurityAuditEvent.organization_id == uuid.UUID(org_id),
                    SecurityAuditEvent.resource_id == uuid.UUID(pending["id"]),
                )
            ).all()
        )
        assert "approval.approved" in actions
        assert "execution.completed" in actions
    finally:
        _delete_thread(thread_id)


def test_dashboard_rejection_does_not_execute(client: TestClient):
    suffix = uuid.uuid4().hex[:10]
    owner = _register(client, f"dashboard-reject-{suffix}@example.com")
    org_id = _organization(client, owner, "Dashboard Reject")
    agent_id = _agent(client, org_id, owner)
    pending = _start(client, org_id, owner, agent_id, "must not run")
    thread_id = pending["thread_id"]
    try:
        decision = _dashboard_decide(client, org_id, owner, pending["id"], False)
        assert decision.status_code == 200, decision.text
        assert decision.json()["status"] == "REJECTED"
        assert decision.json()["thread_id"] == thread_id
        finished = _graph_state(thread_id)
        assert finished.values["approved"] is False
        assert finished.values["result"]["error"] == "Action rejected by human"
        assert "note" not in finished.values["result"]
    finally:
        _delete_thread(thread_id)


def test_dashboard_repeated_decision_conflicts(client: TestClient):
    suffix = uuid.uuid4().hex[:10]
    owner = _register(client, f"dashboard-repeat-{suffix}@example.com")
    org_id = _organization(client, owner, "Dashboard Repeat")
    agent_id = _agent(client, org_id, owner)
    pending = _start(client, org_id, owner, agent_id, "once from dashboard")
    thread_id = pending["thread_id"]
    try:
        first = _dashboard_decide(client, org_id, owner, pending["id"], True)
        assert first.status_code == 200, first.text
        checkpoint_id = _latest_checkpoint_id(thread_id)

        second = _dashboard_decide(client, org_id, owner, pending["id"], True)
        assert second.status_code == 409, second.text
        assert second.json()["detail"] == "Approval already decided"
        assert _latest_checkpoint_id(thread_id) == checkpoint_id
        assert _graph_state(thread_id).values["result"]["note"] == (
            "Demo note created: once from dashboard"
        )
    finally:
        _delete_thread(thread_id)


def test_dashboard_unauthorized_decision(client: TestClient):
    suffix = uuid.uuid4().hex[:10]
    owner = _register(client, f"dashboard-owner-{suffix}@example.com")
    viewer = _register(client, f"dashboard-viewer-{suffix}@example.com")
    developer = _register(client, f"dashboard-dev-{suffix}@example.com")
    outsider = _register(client, f"dashboard-out-{suffix}@example.com")
    org_id = _organization(client, owner, "Dashboard Auth")
    _organization(client, outsider, "Dashboard Other")
    for token, role, email in (
        (viewer, "VIEWER", f"dashboard-viewer-{suffix}@example.com"),
        (developer, "DEVELOPER", f"dashboard-dev-{suffix}@example.com"),
    ):
        added = client.post(
            f"/api/v1/organizations/{org_id}/members",
            headers=_auth(owner),
            json={"email": email, "role": role},
        )
        assert added.status_code == 201, added.text

    agent_id = _agent(client, org_id, owner)
    pending = _start(client, org_id, owner, agent_id, "protected")
    thread_id = pending["thread_id"]
    try:
        for token in (viewer, developer):
            denied = _dashboard_decide(client, org_id, token, pending["id"], True)
            assert denied.status_code == 403, denied.text
            assert "Owners and Admins" in denied.json()["detail"]
        hidden = _dashboard_decide(client, org_id, outsider, pending["id"], True)
        assert hidden.status_code == 404, hidden.text
        assert awaiting_human_approval(_graph_state(thread_id))
    finally:
        _delete_thread(thread_id)


def _race_approval_decisions(
    decisions: list[bool],
    *,
    expected_status: str | None = None,
) -> None:
    """Two committed sessions decide one pending approval at the same moment."""
    database_url = os.getenv("TEST_DATABASE_URL", "").strip()
    if not database_url:
        pytest.skip("TEST_DATABASE_URL is not configured")

    suffix = uuid.uuid4().hex[:10]
    engine = create_engine(database_url, pool_pre_ping=True)
    organization_id = None
    user_id = None
    thread_id = str(uuid.uuid4())
    try:
        with Session(engine) as setup:
            owner = User(
                email=f"race-approval-{suffix}@example.com",
                password_hash=hash_password(PASSWORD),
            )
            organization = Organization(
                name="Race Approval",
                slug=f"race-approval-{suffix}",
            )
            setup.add_all([owner, organization])
            setup.flush()
            agent = Agent(
                organization_id=organization.id,
                name="Race Agent",
                description="concurrent approval",
            )
            setup.add(agent)
            setup.add(
                Membership(
                    user_id=owner.id,
                    organization_id=organization.id,
                    role=Role.OWNER,
                )
            )
            setup.flush()
            approval = WorkflowApproval(
                organization_id=organization.id,
                agent_id=agent.id,
                thread_id=thread_id,
                action="demo_create_note",
                arguments={"note": "race note"},
                requested_by=owner.id,
                status="PENDING",
            )
            setup.add(approval)
            setup.commit()
            organization_id = organization.id
            user_id = owner.id
            agent_id = agent.id
            approval_id = approval.id

        graph = get_approval_graph()
        graph.invoke(
            {
                "organization_id": str(organization_id),
                "agent_id": str(agent_id),
                "action": "demo_create_note",
                "arguments": {"note": "race note"},
            },
            {"configurable": {"thread_id": thread_id}},
        )
        assert awaiting_human_approval(_graph_state(thread_id))

        barrier = threading.Barrier(len(decisions))
        results: list[object] = []
        errors: list[BaseException] = []

        def decide_once(approved: bool) -> None:
            with Session(engine) as db:
                current = db.get(User, user_id)
                assert current is not None
                try:
                    barrier.wait(timeout=10)
                    results.append(
                        apply_workflow_decision(
                            db,
                            organization_id=organization_id,
                            approval_id=approval_id,
                            user=current,
                            approved=approved,
                        )
                    )
                except HTTPException as exc:
                    results.append(exc)
                except BaseException as exc:
                    errors.append(exc)

        workers = [
            threading.Thread(target=decide_once, args=(approved,))
            for approved in decisions
        ]
        for worker in workers:
            worker.start()
        for worker in workers:
            worker.join(timeout=30)

        assert errors == []
        assert len(results) == len(decisions)
        successes = [item for item in results if not isinstance(item, HTTPException)]
        conflicts = [
            item
            for item in results
            if isinstance(item, HTTPException) and item.status_code == 409
        ]
        assert len(successes) == 1
        assert len(conflicts) == 1
        assert conflicts[0].detail == "Approval already decided"
        winner = successes[0]
        if expected_status is not None:
            assert winner.status == expected_status

        finished = _graph_state(thread_id)
        assert not awaiting_human_approval(finished)
        result = finished.values["result"]
        if winner.status == "APPROVED":
            assert result["note"] == "Demo note created: race note"
            assert "error" not in result
        else:
            assert winner.status == "REJECTED"
            assert result["error"] == "Action rejected by human"
            assert "note" not in result
        with Session(engine) as check:
            stored = check.get(WorkflowApproval, approval_id)
            assert stored is not None
            assert stored.status == winner.status
    finally:
        _delete_thread(thread_id)
        if organization_id is not None:
            with Session(engine) as cleanup:
                cleanup.execute(
                    SecurityAuditEvent.__table__.delete().where(
                        SecurityAuditEvent.organization_id == organization_id
                    )
                )
                cleanup.execute(
                    WorkflowApproval.__table__.delete().where(
                        WorkflowApproval.organization_id == organization_id
                    )
                )
                cleanup.execute(
                    Agent.__table__.delete().where(
                        Agent.organization_id == organization_id
                    )
                )
                cleanup.execute(
                    Membership.__table__.delete().where(
                        Membership.organization_id == organization_id
                    )
                )
                cleanup.execute(
                    Organization.__table__.delete().where(
                        Organization.id == organization_id
                    )
                )
                if user_id is not None:
                    cleanup.execute(User.__table__.delete().where(User.id == user_id))
                cleanup.commit()
        engine.dispose()


def test_concurrent_approval_decisions_resume_the_workflow_once():
    _race_approval_decisions([True, True], expected_status="APPROVED")


def test_concurrent_approve_and_reject_apply_one_decision():
    _race_approval_decisions([True, False])
