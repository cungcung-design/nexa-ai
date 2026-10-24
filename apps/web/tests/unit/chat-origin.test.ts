import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const state = vi.hoisted(() => ({
  token: "session-token" as string | undefined,
  organization: { id: "org-1" } as { id: string } | null,
}));

vi.mock("server-only", () => ({}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => (state.token ? { value: state.token } : undefined),
  }),
}));

vi.mock("@/lib/workspace", () => ({
  authorizedOrganization: async () => state.organization,
}));

vi.mock("@/lib/api", () => ({
  API_URL: "http://api.test",
}));

import { POST } from "@/app/api/workspace/[orgId]/agents/[agentId]/chat/route";

function chatRequest(origin: string, host: string) {
  return new NextRequest(
    "http://localhost:3000/api/workspace/org-1/agents/agent-1/chat",
    {
      method: "POST",
      headers: {
        origin,
        host,
        "content-type": "application/json",
      },
      body: JSON.stringify({ message: "Hello from the playground" }),
    }
  );
}

describe("agent chat origin validation", () => {
  beforeEach(() => {
    state.token = "session-token";
    state.organization = { id: "org-1" };
    vi.restoreAllMocks();
  });

  it("accepts a 127.0.0.1 browser when Next resolves localhost", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ answer: "from the model" }), { status: 200 })
    );

    const response = await POST(
      chatRequest("http://127.0.0.1:3000", "127.0.0.1:3000"),
      { params: Promise.resolve({ orgId: "org-1", agentId: "agent-1" }) }
    );

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://api.test/api/v1/organizations/org-1/agents/agent-1/chat",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer session-token",
        }),
      })
    );
  });

  it("rejects a cross-origin browser", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    const response = await POST(
      chatRequest("http://evil.example", "127.0.0.1:3000"),
      { params: Promise.resolve({ orgId: "org-1", agentId: "agent-1" }) }
    );
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "Invalid request origin",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a missing session and a workspace the user does not belong to", async () => {
    state.token = undefined;
    const anonymous = await POST(
      chatRequest("http://127.0.0.1:3000", "127.0.0.1:3000"),
      { params: Promise.resolve({ orgId: "org-1", agentId: "agent-1" }) }
    );
    expect(anonymous.status).toBe(401);

    state.token = "session-token";
    state.organization = null;
    const outsider = await POST(
      chatRequest("http://127.0.0.1:3000", "127.0.0.1:3000"),
      { params: Promise.resolve({ orgId: "org-1", agentId: "agent-1" }) }
    );
    expect(outsider.status).toBe(403);
  });
});
