"""Playground conversation persistence.

The model client is replaced in these tests. They do not call Ollama and
they do not reset database volumes.
"""

import uuid
from types import SimpleNamespace

from fastapi.testclient import TestClient
from openai import OpenAIError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import ConversationMessage
from app.modules.analytics.models import AIRequestTrace

PASSWORD = "Playground-Module-Secure-Pass"


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _register(client: TestClient, email: str) -> str:
    created = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": PASSWORD},
    )
    assert created.status_code == 201, created.text
    return created.json()["access_token"]


def _organization(client: TestClient, token: str) -> str:
    suffix = uuid.uuid4().hex[:8]
    created = client.post(
        "/api/v1/organizations",
        headers=_auth(token),
        json={"name": "Playground Org", "slug": f"playground-{suffix}"},
    )
    assert created.status_code == 201, created.text
    return created.json()["id"]


def _agent(client: TestClient, org_id: str, token: str, name: str = "Playground Agent") -> str:
    created = client.post(
        f"/api/v1/organizations/{org_id}/agents",
        headers=_auth(token),
        json={"name": name, "description": "playground persistence"},
    )
    assert created.status_code == 201, created.text
    return created.json()["id"]


def _publish(client: TestClient, org_id: str, token: str, agent_id: str) -> str:
    version = client.post(
        f"/api/v1/organizations/{org_id}/agents/{agent_id}/versions",
        headers=_auth(token),
        json={
            "system_prompt": "You answer in one short sentence.",
            "model": "qwen3:4b",
            "temperature": 0.2,
            "max_tokens": 64,
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
    return version_id


def _conversation(client: TestClient, org_id: str, token: str, agent_id: str) -> str:
    created = client.post(
        f"/api/v1/organizations/{org_id}/conversations",
        headers=_auth(token),
        json={"agent_id": agent_id, "title": "Playground thread"},
    )
    assert created.status_code == 201, created.text
    return created.json()["id"]


class _Completion:
    def __init__(self, content: str):
        self.choices = [
            SimpleNamespace(
                message=SimpleNamespace(content=content, tool_calls=None)
            )
        ]
        self.usage = SimpleNamespace(prompt_tokens=12, completion_tokens=5)


class _Client:
    def __init__(self, content: str = "Stored assistant reply"):
        self.content = content
        self.calls = 0

    def create(self, **_kwargs):
        self.calls += 1
        return _Completion(self.content)


def _install_model(monkeypatch, content: str = "Stored assistant reply"):
    client = _Client(content)
    monkeypatch.setattr(
        "app.ai.runtime.get_llm_client",
        lambda: SimpleNamespace(chat=SimpleNamespace(completions=client)),
    )
    monkeypatch.setattr("app.ai.runtime.retrieve_context", lambda **_kwargs: [])
    return client


def _trace_on_test_connection(monkeypatch, db_session: Session):
    def open_session():
        return Session(
            bind=db_session.connection(),
            join_transaction_mode="create_savepoint",
        )

    monkeypatch.setattr(
        "app.modules.analytics.tracing.SessionLocal",
        open_session,
    )


def _messages(client: TestClient, org_id: str, token: str, conversation_id: str):
    response = client.get(
        f"/api/v1/organizations/{org_id}/conversations/{conversation_id}/messages",
        headers=_auth(token),
    )
    assert response.status_code == 200, response.text
    return response.json()


def test_unpublished_agent_cannot_execute(client: TestClient, monkeypatch):
    _install_model(monkeypatch)
    suffix = uuid.uuid4().hex[:8]
    owner = _register(client, f"playground-draft-{suffix}@example.com")
    org_id = _organization(client, owner)
    agent_id = _agent(client, org_id, owner)
    conversation_id = _conversation(client, org_id, owner, agent_id)

    direct = client.post(
        f"/api/v1/organizations/{org_id}/agents/{agent_id}/chat",
        headers=_auth(owner),
        json={"message": "Hello"},
    )
    assert direct.status_code == 404, direct.text
    assert "published" in direct.json()["detail"]

    threaded = client.post(
        f"/api/v1/organizations/{org_id}/conversations/{conversation_id}/chat",
        headers=_auth(owner),
        json={"message": "Hello"},
    )
    assert threaded.status_code == 404, threaded.text
    assert _messages(client, org_id, owner, conversation_id) == []


def test_conversation_persists_and_continues(
    client: TestClient, db_session: Session, monkeypatch
):
    model = _install_model(monkeypatch, "First stored reply")
    _trace_on_test_connection(monkeypatch, db_session)
    suffix = uuid.uuid4().hex[:8]
    owner = _register(client, f"playground-keep-{suffix}@example.com")
    org_id = _organization(client, owner)
    agent_id = _agent(client, org_id, owner)
    _publish(client, org_id, owner, agent_id)
    conversation_id = _conversation(client, org_id, owner, agent_id)

    first = client.post(
        f"/api/v1/organizations/{org_id}/conversations/{conversation_id}/chat",
        headers=_auth(owner),
        json={"message": "Remember the color blue"},
    )
    assert first.status_code == 200, first.text
    assert first.json()["conversation_id"] == conversation_id
    assert first.json()["answer"] == "First stored reply"

    stored = _messages(client, org_id, owner, conversation_id)
    assert [item["role"] for item in stored] == ["user", "assistant"]
    assert stored[0]["content"] == "Remember the color blue"
    assert stored[1]["content"] == "First stored reply"

    model.content = "Second stored reply"
    second = client.post(
        f"/api/v1/organizations/{org_id}/conversations/{conversation_id}/chat",
        headers=_auth(owner),
        json={"message": "What color did I mention?"},
    )
    assert second.status_code == 200, second.text
    assert second.json()["conversation_id"] == conversation_id
    continued = _messages(client, org_id, owner, conversation_id)
    assert [item["content"] for item in continued] == [
        "Remember the color blue",
        "First stored reply",
        "What color did I mention?",
        "Second stored reply",
    ]
    assert model.calls == 2

    db_session.expire_all()
    traces = db_session.scalars(
        select(AIRequestTrace).where(
            AIRequestTrace.organization_id == uuid.UUID(org_id)
        )
    ).all()
    assert len(traces) == 2
    assert traces[-1].status == "success"
    assert traces[-1].prompt_tokens == 12
    assert traces[-1].completion_tokens == 5


def test_provider_failure_does_not_store_a_reply(
    client: TestClient, db_session: Session, monkeypatch
):
    def fail(**_kwargs):
        raise OpenAIError("ollama unavailable")

    monkeypatch.setattr(
        "app.ai.runtime.get_llm_client",
        lambda: SimpleNamespace(
            chat=SimpleNamespace(completions=SimpleNamespace(create=fail))
        ),
    )
    monkeypatch.setattr("app.ai.runtime.retrieve_context", lambda **_kwargs: [])
    suffix = uuid.uuid4().hex[:8]
    owner = _register(client, f"playground-fail-{suffix}@example.com")
    org_id = _organization(client, owner)
    agent_id = _agent(client, org_id, owner)
    _publish(client, org_id, owner, agent_id)
    conversation_id = _conversation(client, org_id, owner, agent_id)

    failed = client.post(
        f"/api/v1/organizations/{org_id}/conversations/{conversation_id}/chat",
        headers=_auth(owner),
        json={"message": "This must not be stored"},
    )
    assert failed.status_code == 502, failed.text
    assert failed.json()["detail"] == "LLM provider request failed"
    assert _messages(client, org_id, owner, conversation_id) == []
    rows = db_session.scalars(
        select(ConversationMessage).where(
            ConversationMessage.conversation_id == uuid.UUID(conversation_id)
        )
    ).all()
    assert rows == []


def test_conversation_is_isolated_by_owner_and_workspace(
    client: TestClient, monkeypatch
):
    _install_model(monkeypatch)
    suffix = uuid.uuid4().hex[:8]
    owner = _register(client, f"playground-owner-{suffix}@example.com")
    other = _register(client, f"playground-other-{suffix}@example.com")
    org_id = _organization(client, owner)
    other_org = _organization(client, other)
    agent_id = _agent(client, org_id, owner)
    _publish(client, org_id, owner, agent_id)
    conversation_id = _conversation(client, org_id, owner, agent_id)

    hidden = client.get(
        f"/api/v1/organizations/{org_id}/conversations/{conversation_id}/messages",
        headers=_auth(other),
    )
    assert hidden.status_code == 404, hidden.text

    cross_workspace = client.post(
        f"/api/v1/organizations/{other_org}/conversations/{conversation_id}/chat",
        headers=_auth(other),
        json={"message": "steal this thread"},
    )
    assert cross_workspace.status_code == 404, cross_workspace.text
    assert _messages(client, org_id, owner, conversation_id) == []


def test_anonymous_chat_is_rejected(client: TestClient):
    response = client.post(
        f"/api/v1/organizations/{uuid.uuid4()}/agents/{uuid.uuid4()}/chat",
        json={"message": "Hello"},
    )
    assert response.status_code == 401
