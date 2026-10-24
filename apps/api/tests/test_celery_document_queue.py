"""Queued document processing through the running Celery worker.

The upload commits a PENDING document and enqueues ``documents.process``.
This test does not call ``process_document.apply``. A worker started from
``apps/api`` must consume the same broker, database, and document storage
as this process.
"""

import time
import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import update

from app.db.models import Agent, Organization, User
from app.db.session import SessionLocal
from app.main import app
from app.worker.celery_app import celery_app

PASSWORD = "Celery-Queue-Pass-2026"
TOKEN = "ZEPHYR-9B-QUEUE-7741"


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _cleanup(email: str) -> None:
    db = SessionLocal()
    try:
        users = db.query(User).filter(User.email == email).all()
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
            db.query(Organization).filter(Organization.id.in_(org_ids)).delete(
                synchronize_session=False
            )
        db.query(User).filter(User.id.in_(user_ids)).delete(synchronize_session=False)
        db.commit()
    finally:
        db.close()


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client


def test_queued_document_is_processed_and_searchable(client: TestClient):
    workers = celery_app.control.inspect(timeout=3).ping()
    assert workers, "No Celery worker answered on the configured broker"

    suffix = uuid.uuid4().hex[:10]
    email = f"celery-queue-{suffix}@example.com"
    try:
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
        token = logged_in.json()["access_token"]

        organization = client.post(
            "/api/v1/organizations",
            headers=_auth(token),
            json={"name": "Queue Knowledge", "slug": f"queue-knowledge-{suffix}"},
        )
        assert organization.status_code == 201, organization.text
        org_id = organization.json()["id"]

        knowledge_base = client.post(
            f"/api/v1/organizations/{org_id}/knowledge",
            headers=_auth(token),
            json={"name": "Queued Docs"},
        )
        assert knowledge_base.status_code == 201, knowledge_base.text
        knowledge_base_id = knowledge_base.json()["id"]

        upload = client.post(
            f"/api/v1/organizations/{org_id}/knowledge/{knowledge_base_id}/documents",
            headers=_auth(token),
            files={
                "file": (
                    f"queued-{suffix}.txt",
                    (
                        "NEXORA queued this document for background indexing.\n"
                        f"The queued retrieval token is {TOKEN} and must be found.\n"
                    ).encode(),
                    "text/plain",
                )
            },
        )
        assert upload.status_code == 202, upload.text
        body = upload.json()
        assert body["status"] == "PENDING"
        document_id = body["id"]

        deadline = time.time() + 180
        status_name = "PENDING"
        while time.time() < deadline:
            listed = client.get(
                f"/api/v1/organizations/{org_id}/knowledge/{knowledge_base_id}/documents",
                headers=_auth(token),
            )
            assert listed.status_code == 200, listed.text
            current = next(item for item in listed.json() if item["id"] == document_id)
            status_name = current["status"]
            if status_name in {"READY", "FAILED"}:
                break
            time.sleep(2)

        if status_name != "READY":
            from app.db.models import Document

            db = SessionLocal()
            try:
                document = db.get(Document, uuid.UUID(document_id))
                detail = document.error_message if document is not None else "missing"
            finally:
                db.close()
            raise AssertionError(f"{status_name}: {detail}")

        search = client.post(
            f"/api/v1/organizations/{org_id}/knowledge/{knowledge_base_id}/search",
            headers=_auth(token),
            json={"query": TOKEN, "limit": 3},
        )
        assert search.status_code == 200, search.text
        matches = search.json()
        assert matches, "Indexed document returned no search results"
        assert any(TOKEN in item["content"] for item in matches)
        assert all(item["document_id"] == document_id for item in matches)
    finally:
        _cleanup(email)
