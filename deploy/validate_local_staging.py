"""Exercise the isolated staging API. It does not print secrets or reset data."""

from __future__ import annotations

import json
import time
import urllib.error
import urllib.request
import uuid

BASE = "http://127.0.0.1:18000"
PASSWORD = "Staging-Local-Pass-2026"


def request(method: str, path: str, body: dict | None = None, token: str | None = None, data: bytes | None = None, headers: dict | None = None):
    req_headers = dict(headers or {})
    if token:
        req_headers["Authorization"] = f"Bearer {token}"
    payload = data
    if body is not None:
        payload = json.dumps(body).encode()
        req_headers["Content-Type"] = "application/json"
    request_obj = urllib.request.Request(BASE + path, data=payload, headers=req_headers, method=method)
    try:
        with urllib.request.urlopen(request_obj, timeout=30) as response:
            raw = response.read()
            return response.status, raw
    except urllib.error.HTTPError as exc:
        return exc.code, exc.read()


def main() -> None:
    status, raw = request("GET", "/ready")
    assert status == 200, raw
    print("ready")

    email = f"staging-{uuid.uuid4().hex[:10]}@example.com"
    status, raw = request("POST", "/api/v1/auth/register", {"email": email, "password": PASSWORD})
    assert status == 201, raw
    status, raw = request("POST", "/api/v1/auth/login", {"email": email, "password": PASSWORD})
    assert status == 200, raw
    token = json.loads(raw)["access_token"]
    print("authenticated")

    status, raw = request(
        "POST",
        "/api/v1/auth/password-reset/request",
        {"email": email},
    )
    text = raw.decode("utf-8", errors="replace")
    assert "password-recovery?token" not in text, text
    payload = json.loads(text) if text.startswith("{") else {}
    assert not payload.get("dev_reset_link"), text
    print(f"reset-link-hidden status={status}")

    origin_headers = {"Origin": "http://127.0.0.1:13000"}
    status, raw = request("GET", "/health", headers=origin_headers)
    assert status == 200, raw
    print("browser-origin-health")

    status, raw = request(
        "POST",
        "/api/v1/organizations",
        {"name": "Staging Check", "slug": f"staging-check-{uuid.uuid4().hex[:8]}"},
        token,
    )
    assert status == 201, raw
    org_id = json.loads(raw)["id"]
    status, raw = request(
        "POST",
        f"/api/v1/organizations/{org_id}/agents",
        {"name": "Staging Agent", "description": "local staging check"},
        token,
    )
    assert status == 201, raw
    agent_id = json.loads(raw)["id"]
    status, raw = request(
        "POST",
        f"/api/v1/organizations/{org_id}/knowledge",
        {"name": "Staging Docs"},
        token,
    )
    assert status == 201, raw
    knowledge_id = json.loads(raw)["id"]

    phrase = f"STAGING-TOKEN-{uuid.uuid4().hex[:8]}"
    boundary = "----nexaStaging"
    filename = "staging.txt"
    content = f"Queued staging document. The retrieval phrase is {phrase}.\n".encode()
    body = (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="file"; filename="{filename}"\r\n'
        "Content-Type: text/plain\r\n\r\n"
    ).encode() + content + f"\r\n--{boundary}--\r\n".encode()
    status, raw = request(
        "POST",
        f"/api/v1/organizations/{org_id}/knowledge/{knowledge_id}/documents",
        token=token,
        data=body,
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
    )
    assert status == 202, raw
    uploaded = json.loads(raw)
    assert uploaded["status"] == "PENDING", raw
    document_id = uploaded["id"]
    print("upload-queued")

    deadline = time.time() + 180
    state = "PENDING"
    while time.time() < deadline:
        status, raw = request(
            "GET",
            f"/api/v1/organizations/{org_id}/knowledge/{knowledge_id}/documents",
            token=token,
        )
        assert status == 200, raw
        current = next(item for item in json.loads(raw) if item["id"] == document_id)
        state = current["status"]
        if state in {"READY", "FAILED"}:
            break
        time.sleep(2)
    assert state == "READY", state
    status, raw = request(
        "POST",
        f"/api/v1/organizations/{org_id}/knowledge/{knowledge_id}/search",
        {"query": phrase, "limit": 3},
        token,
    )
    assert status == 200, raw
    matches = json.loads(raw)
    assert any(phrase in item["content"] for item in matches), raw
    print("document-retrieved")

    status, raw = request(
        "POST",
        f"/api/v1/organizations/{org_id}/workflows/demo-action",
        {"agent_id": agent_id, "note": "staging checkpoint"},
        token,
    )
    assert status == 200, raw
    approval = json.loads(raw)
    assert approval["status"] == "PENDING", raw
    print(f"checkpoint-thread {approval['thread_id']}")


if __name__ == "__main__":
    main()
