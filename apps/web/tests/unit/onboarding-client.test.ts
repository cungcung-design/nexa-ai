import { afterEach, describe, expect, it, vi } from "vitest";

import {
  completeStep,
  errorMessage,
  fetchOnboardingState,
  resolveAfterAuth,
} from "@/lib/onboarding";

function state(overrides: Record<string, unknown> = {}) {
  return {
    email: "person@example.com",
    email_verified: true,
    step: "welcome",
    completed_steps: [],
    workspace: null,
    plan: null,
    agent_id: null,
    can_create_agent: false,
    workspaces: [],
    ...overrides,
  };
}

function stubFetch(response: { ok: boolean; status?: number; body?: unknown }) {
  const mock = vi.fn().mockResolvedValue({
    ok: response.ok,
    status: response.status ?? 200,
    json: async () => response.body ?? {},
  });
  vi.stubGlobal("fetch", mock);
  return mock;
}

describe("errorMessage", () => {
  it("prefers the message of the backend", () => {
    expect(errorMessage({ detail: "The slug is taken." }, "Failed.")).toBe(
      "The slug is taken."
    );
  });

  it("falls back to the error field and to the given text", () => {
    expect(errorMessage({ error: "Network error." }, "Failed.")).toBe(
      "Network error."
    );
    expect(errorMessage({}, "Something failed.")).toBe("Something failed.");
  });
});

describe("fetchOnboardingState", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the state of the account", async () => {
    stubFetch({ ok: true, body: state() });

    const result = await fetchOnboardingState();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.email).toBe("person@example.com");
    }
  });

  it("keeps the status of a failed request", async () => {
    stubFetch({ ok: false, status: 401 });

    const result = await fetchOnboardingState();

    expect(result).toEqual({ ok: false, status: 401 });
  });

  it("reports a network failure without a status", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("offline"))
    );

    const result = await fetchOnboardingState();

    expect(result).toEqual({ ok: false, status: 0 });
  });
});

describe("resolveAfterAuth", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends a new account to the address confirmation", async () => {
    stubFetch({
      ok: true,
      body: state({ email_verified: false }),
    });

    expect(await resolveAfterAuth()).toBe("/verify-email");
  });

  it("keeps an invitation path through address confirmation", async () => {
    stubFetch({
      ok: true,
      body: state({ email_verified: false }),
    });

    expect(await resolveAfterAuth("/invitations/invite-token")).toBe(
      "/verify-email?next=%2Finvitations%2Finvite-token"
    );
  });

  it("returns a verified account to the invitation instead of a new workspace", async () => {
    stubFetch({ ok: true, body: state() });

    expect(await resolveAfterAuth("/invitations/invite-token")).toBe(
      "/invitations/invite-token"
    );
  });

  it("sends an account that is still in the flow to the welcome", async () => {
    stubFetch({ ok: true, body: state() });

    expect(await resolveAfterAuth()).toBe("/onboarding/welcome");
  });

  it("sends a finished account to the workspace", async () => {
    stubFetch({
      ok: true,
      body: state({ step: "complete", workspace: { id: "org-1" } }),
    });

    expect(await resolveAfterAuth("/dashboard/organizations/org-1")).toBe(
      "/dashboard/organizations/org-1"
    );
  });

  it("keeps the dashboard for an account of an earlier session", async () => {
    stubFetch({
      ok: true,
      body: state({ workspaces: [{ id: "org-1", name: "Old", slug: "old" }] }),
    });

    expect(await resolveAfterAuth()).toBe("/dashboard");
  });

  it("falls back to the dashboard when the state cannot be read", async () => {
    stubFetch({ ok: false, status: 503 });

    expect(await resolveAfterAuth()).toBe("/dashboard");
  });
});

describe("completeStep", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends the step to the backend", async () => {
    const mock = stubFetch({
      ok: true,
      body: { step: "workspace", completed_steps: ["welcome"], workspace_id: null },
    });

    const result = await completeStep("welcome");

    expect(result.completed_steps).toEqual(["welcome"]);
    expect(mock).toHaveBeenCalledWith(
      "/api/onboarding/step",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ step: "welcome" }),
      })
    );
  });

  it("reports a rejected step", async () => {
    stubFetch({ ok: false, status: 400, body: { detail: "Unknown step." } });

    await expect(completeStep("unknown")).rejects.toThrow("Unknown step.");
  });
});
