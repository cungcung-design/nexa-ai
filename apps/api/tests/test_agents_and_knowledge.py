import asyncio
import io
import uuid

import httpx
import pytest
from fastapi.testclient import TestClient
from pypdf import PdfWriter
from pypdf.generic import (
    DecodedStreamObject,
    DictionaryObject,
    NameObject,
)
from sqlalchemy import update

from app.db.models import Agent, Organization, User
from app.db.session import SessionLocal
from app.main import app

PASSWORD = "Lesson4-Secure-Pass"


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


def _pdf_bytes(text: str) -> bytes:
    writer = PdfWriter()
    writer.add_blank_page(width=612, height=792)
    page = writer.pages[0]
    page[NameObject("/Resources")] = DictionaryObject(
        {
            NameObject("/Font"): DictionaryObject(
                {
                    NameObject("/F1"): DictionaryObject(
                        {
                            NameObject("/Type"): NameObject("/Font"),
                            NameObject("/Subtype"): NameObject("/Type1"),
                            NameObject("/BaseFont"): NameObject("/Helvetica"),
                        }
                    )
                }
            )
        }
    )
    stream = DecodedStreamObject()
    stream.set_data(
        f"BT /F1 18 Tf 72 700 Td ({text}) Tj ET".encode("latin-1")
    )
    page[NameObject("/Contents")] = stream
    buffer = io.BytesIO()
    writer.write(buffer)
    return buffer.getvalue()


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client


def test_agent_lifecycle_permissions_and_knowledge_retrieval(client: TestClient):
    suffix = uuid.uuid4().hex[:10]
    emails = {
        "owner": f"owner-{suffix}@example.com",
        "developer": f"developer-{suffix}@example.com",
        "viewer": f"viewer-{suffix}@example.com",
        "outsider": f"outsider-{suffix}@example.com",
    }

    try:
        owner = _register_and_login(client, emails["owner"])
        developer = _register_and_login(client, emails["developer"])
        viewer = _register_and_login(client, emails["viewer"])
        outsider = _register_and_login(client, emails["outsider"])

        organization = client.post(
            "/api/v1/organizations",
            headers=_auth(owner),
            json={"name": "Nexa Support", "slug": f"nexa-support-{suffix}"},
        )
        assert organization.status_code == 201, organization.text
        org_id = organization.json()["id"]

        other_organization = client.post(
            "/api/v1/organizations",
            headers=_auth(outsider),
            json={"name": "Other Org", "slug": f"other-org-{suffix}"},
        )
        assert other_organization.status_code == 201, other_organization.text

        for email, role in (
            (emails["developer"], "DEVELOPER"),
            (emails["viewer"], "VIEWER"),
        ):
            added = client.post(
                f"/api/v1/organizations/{org_id}/members",
                headers=_auth(owner),
                json={"email": email, "role": role},
            )
            assert added.status_code == 201, added.text

        owner_agent = client.post(
            f"/api/v1/organizations/{org_id}/agents",
            headers=_auth(owner),
            json={
                "name": "Customer Support Agent",
                "description": "Answers customer questions",
            },
        )
        assert owner_agent.status_code == 201, owner_agent.text
        agent_id = owner_agent.json()["id"]
        assert owner_agent.json()["published_version_id"] is None

        developer_agent = client.post(
            f"/api/v1/organizations/{org_id}/agents",
            headers=_auth(developer),
            json={
                "name": "Sales Assistant",
                "description": "Helps customers find products",
            },
        )
        assert developer_agent.status_code == 201, developer_agent.text

        viewer_agent = client.post(
            f"/api/v1/organizations/{org_id}/agents",
            headers=_auth(viewer),
            json={"name": "Viewer Agent", "description": "Should fail"},
        )
        assert viewer_agent.status_code == 403

        hidden = client.get(
            f"/api/v1/organizations/{org_id}/agents/{agent_id}",
            headers=_auth(outsider),
        )
        assert hidden.status_code == 404

        version = client.post(
            f"/api/v1/organizations/{org_id}/agents/{agent_id}/versions",
            headers=_auth(owner),
            json={
                "system_prompt": "You are a helpful customer support assistant.",
                "model": "gpt-4.1-mini",
                "temperature": 0.3,
                "max_tokens": 1024,
                "tools_config": {},
            },
        )
        assert version.status_code == 201, version.text
        version_body = version.json()
        version_id = version_body["id"]
        assert version_body["version_number"] == 1
        assert version_body["model"] == "gpt-4.1-mini"
        assert version_body["temperature"] == 0.3

        schema = client.get("/openapi.json").json()
        for path, operations in schema["paths"].items():
            if "/versions" in path:
                assert "patch" not in operations
                assert "put" not in operations
        immutable = client.patch(
            f"/api/v1/organizations/{org_id}/agents/{agent_id}/versions/{version_id}",
            headers=_auth(owner),
            json={"system_prompt": "Changed after publish."},
        )
        assert immutable.status_code in {404, 405}

        published = client.post(
            f"/api/v1/organizations/{org_id}/agents/{agent_id}/publish/{version_id}",
            headers=_auth(owner),
        )
        assert published.status_code == 200, published.text
        assert published.json()["published_version_id"] == version_id

        viewer_publish = client.post(
            f"/api/v1/organizations/{org_id}/agents/{agent_id}/publish/{version_id}",
            headers=_auth(viewer),
        )
        assert viewer_publish.status_code == 403

        wrong_agent = client.post(
            f"/api/v1/organizations/{org_id}/agents/{developer_agent.json()['id']}/publish/{version_id}",
            headers=_auth(owner),
        )
        assert wrong_agent.status_code == 404

        async def create_version() -> httpx.Response:
            transport = httpx.ASGITransport(app=app)
            async with httpx.AsyncClient(
                transport=transport,
                base_url="http://test",
                timeout=None,
            ) as concurrent_client:
                return await concurrent_client.post(
                    f"/api/v1/organizations/{org_id}/agents/{agent_id}/versions",
                    headers=_auth(owner),
                    json={
                        "system_prompt": "You are a helpful customer support assistant.",
                        "model": "gpt-4.1-mini",
                        "temperature": 0.2,
                        "max_tokens": 512,
                        "tools_config": {},
                    },
                )

        async def create_pair() -> tuple[httpx.Response, httpx.Response]:
            return await asyncio.gather(create_version(), create_version())

        first, second = asyncio.run(create_pair())
        assert first.status_code == 201, first.text
        assert second.status_code == 201, second.text
        assert sorted(
            [
                first.json()["version_number"],
                second.json()["version_number"],
            ]
        ) == [2, 3]

        archived = client.delete(
            f"/api/v1/organizations/{org_id}/agents/{developer_agent.json()['id']}",
            headers=_auth(owner),
        )
        assert archived.status_code == 204
        assert archived.content == b""

        listed = client.get(
            f"/api/v1/organizations/{org_id}/agents",
            headers=_auth(owner),
        )
        assert listed.status_code == 200
        listed_ids = {item["id"] for item in listed.json()}
        assert developer_agent.json()["id"] not in listed_ids
        assert agent_id in listed_ids

        developer_archive = client.delete(
            f"/api/v1/organizations/{org_id}/agents/{agent_id}",
            headers=_auth(developer),
        )
        assert developer_archive.status_code == 403

        knowledge_base = client.post(
            f"/api/v1/organizations/{org_id}/knowledge",
            headers=_auth(owner),
            json={"name": "Company Knowledge"},
        )
        assert knowledge_base.status_code == 201, knowledge_base.text
        knowledge_base_id = knowledge_base.json()["id"]

        outsider_read = client.get(
            f"/api/v1/organizations/{org_id}/knowledge/{knowledge_base_id}",
            headers=_auth(outsider),
        )
        assert outsider_read.status_code == 404

        secret = "INTERNAL-ONLY-POLICY-TOKEN"
        upload = client.post(
            f"/api/v1/organizations/{org_id}/knowledge/{knowledge_base_id}/documents",
            headers=_auth(owner),
            files={
                "file": (
                    "nexa-test.txt",
                    (
                        "Nexa AI is a multi-tenant AI SaaS platform.\n"
                        "The platform uses Next.js, FastAPI, PostgreSQL, and LangGraph.\n"
                        f"Confidential note {secret}.\n"
                    ).encode(),
                    "text/plain",
                )
            },
        )
        assert upload.status_code == 201, upload.text
        assert upload.json()["status"] == "READY"
        assert secret not in upload.text

        viewer_upload = client.post(
            f"/api/v1/organizations/{org_id}/knowledge/{knowledge_base_id}/documents",
            headers=_auth(viewer),
            files={
                "file": (
                    "blocked.txt",
                    b"Viewer should not upload this document.",
                    "text/plain",
                )
            },
        )
        assert viewer_upload.status_code == 403

        rejected = client.post(
            f"/api/v1/organizations/{org_id}/knowledge/{knowledge_base_id}/documents",
            headers=_auth(owner),
            files={
                "file": (
                    "notes.exe",
                    f"do not echo {secret}".encode(),
                    "application/octet-stream",
                )
            },
        )
        assert rejected.status_code == 400
        assert secret not in rejected.text
        assert "do not echo" not in rejected.text

        pdf_upload = client.post(
            f"/api/v1/organizations/{org_id}/knowledge/{knowledge_base_id}/documents",
            headers=_auth(owner),
            files={
                "file": (
                    "stack.pdf",
                    _pdf_bytes("Nexa AI uses PostgreSQL and LangGraph"),
                    "application/pdf",
                )
            },
        )
        assert pdf_upload.status_code == 201, pdf_upload.text
        assert pdf_upload.json()["status"] == "READY"

        search = client.post(
            f"/api/v1/organizations/{org_id}/knowledge/{knowledge_base_id}/search",
            headers=_auth(owner),
            json={
                "query": "What technologies does Nexa AI use?",
                "limit": 3,
            },
        )
        assert search.status_code == 200, search.text
        contents = " ".join(item["content"] for item in search.json())
        assert "FastAPI" in contents or "PostgreSQL" in contents
        assert all(
            item["filename"] in {"nexa-test.txt", "stack.pdf"}
            for item in search.json()
        )

        outsider_search = client.post(
            f"/api/v1/organizations/{org_id}/knowledge/{knowledge_base_id}/search",
            headers=_auth(outsider),
            json={"query": "PostgreSQL", "limit": 3},
        )
        assert outsider_search.status_code == 404
    finally:
        _cleanup(list(emails.values()))
