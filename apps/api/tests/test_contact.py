"""Tests for the contact form of the public landing page.

The suite covers the storage of a message, the label of the chosen topic, and
the validation of the address of the visitor.
"""

import uuid

from fastapi.testclient import TestClient

from app.db.models import ContactMessage


def _message(subject: str = "demo") -> dict[str, str]:
    return {
        "name": "Ada Lovelace",
        "email": f"ada-{uuid.uuid4().hex[:8]}@example.com",
        "subject": subject,
        "message": "I would like to see a demo of the platform.",
    }


def test_a_message_is_stored_and_answered(client: TestClient, db_session):
    payload = _message()

    response = client.post("/api/v1/contact", json=payload)

    assert response.status_code == 201, response.text
    answer = response.json()
    assert answer["message"]
    assert answer["reference"]

    record = db_session.query(ContactMessage).filter_by(
        id=uuid.UUID(answer["reference"])
    ).one()
    assert record.email == payload["email"]
    assert record.name == payload["name"]
    assert record.message == payload["message"]


def test_the_topic_becomes_its_label(client: TestClient, db_session):
    response = client.post("/api/v1/contact", json=_message("partnership"))

    assert response.status_code == 201, response.text
    record = db_session.query(ContactMessage).filter_by(
        id=uuid.UUID(response.json()["reference"])
    ).one()
    assert record.subject == "Partnerships"


def test_an_invalid_address_is_refused(client: TestClient):
    payload = _message()
    payload["email"] = "not-an-address"

    response = client.post("/api/v1/contact", json=payload)

    assert response.status_code == 422


def test_a_short_message_is_refused(client: TestClient):
    payload = _message()
    payload["message"] = "hi"

    response = client.post("/api/v1/contact", json=payload)

    assert response.status_code == 422
