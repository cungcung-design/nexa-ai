import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { fetchAgents } from "@/lib/api/agents";

describe("fetchAgents", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns agents on success", async () => {
    const mockAgents = [
      {
        id: "agent-1",
        name: "Support Agent",
        description: "Customer support",
      },
    ];

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockAgents,
    });

    vi.stubGlobal("fetch", mockFetch);

    const result = await fetchAgents("org-1");

    expect(result).toEqual(mockAgents);
    expect(mockFetch).toHaveBeenCalledOnce();
  });

  it("throws on unauthorized response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
      })
    );

    await expect(
      fetchAgents("org-1")
    ).rejects.toThrow("Failed to fetch agents (401)");
  });

  it("throws on server errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      })
    );

    await expect(
      fetchAgents("org-1")
    ).rejects.toThrow("Failed to fetch agents (500)");
  });
});
