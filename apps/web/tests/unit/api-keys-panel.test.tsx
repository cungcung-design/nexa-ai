import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ApiKeysPanel } from "@/components/settings/api-keys-panel";

const secret = "nexa_live_test_only_not_a_real_secret";

describe("api keys panel", () => {
  it("creates a key, shows the secret once, then lists only the mask", async () => {
    const user = userEvent.setup();
    const keys = [
      {
        id: "key-1",
        name: "Production API Key",
        key_prefix: "nexa_live_test_only",
        scopes: ["agent:read"],
        is_active: true,
        created_at: "2026-10-22T08:00:00Z",
        expires_at: null,
        revoked_at: null,
      },
    ];
    let created = false;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (_input, init) => {
      if (init?.method === "POST") {
        created = true;
        return new Response(JSON.stringify({ ...keys[0], api_key: secret }), {
          status: 201,
        });
      }
      return new Response(JSON.stringify(created ? keys : []), { status: 200 });
    });

    render(<ApiKeysPanel organizationId="org-1" />);
    expect(await screen.findByText("No API key yet")).toBeInTheDocument();
    expect(screen.queryByTestId("api-key-secret")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Create API Key" }));
    await user.type(screen.getByLabelText("Key name"), "Production API Key");
    await user.click(screen.getByRole("button", { name: "Create key" }));

    expect(await screen.findByTestId("api-key-secret")).toHaveTextContent(secret);
    await user.click(screen.getByRole("button", { name: "Hide secret" }));
    expect(screen.queryByTestId("api-key-secret")).not.toBeInTheDocument();
    expect(screen.getByText("nexa_••••••••••ONLY")).toBeInTheDocument();
    expect(screen.queryByText(secret)).not.toBeInTheDocument();
  });

  it("shows a controlled error when creation is rejected", async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      if (init?.method === "POST") {
        return new Response(
          JSON.stringify({ detail: "Invalid scopes: billing:write" }),
          { status: 400 }
        );
      }
      return new Response(JSON.stringify([]), { status: 200 });
    });

    render(<ApiKeysPanel organizationId="org-1" />);
    await screen.findByText("No API key yet");
    await user.click(screen.getByRole("button", { name: "Create API Key" }));
    await user.type(screen.getByLabelText("Key name"), "Bad key");
    fireEvent.click(screen.getByRole("button", { name: "Create key" }));

    expect(await screen.findByText("Invalid scopes: billing:write")).toBeInTheDocument();
    expect(screen.queryByTestId("api-key-secret")).not.toBeInTheDocument();
  });
});
