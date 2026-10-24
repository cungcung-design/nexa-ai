import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Agent, AgentVersion } from "@/lib/api";

const nav = vi.hoisted(() => ({
  pathname: "/dashboard/organizations/org-1/agents/agent-1/studio/overview",
  refresh: vi.fn(),
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ organizationId: "org-1", agentId: "agent-1" }),
  usePathname: () => nav.pathname,
  useRouter: () => ({
    push: nav.push,
    replace: vi.fn(),
    refresh: nav.refresh,
  }),
}));

import { AgentStudio } from "@/components/agent-studio";

const agent: Agent = {
  id: "agent-1",
  name: "Support Agent",
  description: "Answers customer questions clearly.",
  is_archived: false,
  published_version_id: null,
};

const versions: AgentVersion[] = [];

describe("Agent Studio", () => {
  beforeEach(() => {
    nav.pathname = "/dashboard/organizations/org-1/agents/agent-1/studio/overview";
    nav.refresh.mockReset();
    nav.push.mockReset();
    vi.restoreAllMocks();
  });

  it("renders the overview without using isActive before initialization", () => {
    render(<AgentStudio agent={agent} versions={versions} />);

    expect(screen.getByRole("heading", { name: "Support Agent" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Overview" })).toBeInTheDocument();
    expect(screen.getByText("No versions yet.")).toBeInTheDocument();
  });

  it("saves an edited draft through the workspace agent route", async () => {
    nav.pathname = "/dashboard/organizations/org-1/agents/agent-1/studio/instructions";
    const user = userEvent.setup();
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ id: "agent-1" }), { status: 200 })
    );

    render(<AgentStudio agent={agent} versions={versions} />);
    const instructions = screen.getByPlaceholderText(
      "Define the agent's behavior, persona, and instructions..."
    );
    await user.clear(instructions);
    await user.type(instructions, "Updated support instructions for customers.");
    await user.click(screen.getByRole("button", { name: "Save Draft" }));

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/workspace/org-1/agents/agent-1",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({
          name: "Support Agent",
          description: "Updated support instructions for customers.",
        }),
      })
    );
    expect(await screen.findByText("Draft saved.")).toBeInTheDocument();
  });

  it("publishes a new immutable version from the draft", async () => {
    nav.pathname = "/dashboard/organizations/org-1/agents/agent-1/studio/instructions";
    const user = userEvent.setup();
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.endsWith("/versions")) {
        return new Response(JSON.stringify({ id: "version-9" }), { status: 201 });
      }
      if (url.endsWith("/publish/version-9")) {
        return new Response(
          JSON.stringify({ id: "agent-1", published_version_id: "version-9" }),
          { status: 200 }
        );
      }
      return new Response(JSON.stringify({ error: `unexpected ${url} ${init?.method}` }), {
        status: 500,
      });
    });

    render(<AgentStudio agent={agent} versions={versions} />);
    const instructions = screen.getByPlaceholderText(
      "Define the agent's behavior, persona, and instructions..."
    );
    await user.clear(instructions);
    await user.type(instructions, "Publish this customer support prompt.");
    await user.click(screen.getByRole("button", { name: "Publish" }));

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/workspace/org-1/agents/agent-1/versions",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          system_prompt: "Publish this customer support prompt.",
          model: "gpt-4.1-mini",
          temperature: 0.3,
          max_tokens: 1024,
          tools_config: {},
        }),
      })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/workspace/org-1/agents/agent-1/publish/version-9",
      expect.objectContaining({ method: "POST" })
    );
    expect(await screen.findByText("Version published.")).toBeInTheDocument();
    expect(nav.refresh).toHaveBeenCalled();
  });

  it("marks the published version as live in the versions view", () => {
    nav.pathname = "/dashboard/organizations/org-1/agents/agent-1/studio/versions";
    render(
      <AgentStudio
        agent={{ ...agent, published_version_id: "version-2" }}
        versions={[
          {
            id: "version-2",
            agent_id: "agent-1",
            version_number: 2,
            system_prompt: "Live prompt",
            model: "gpt-4.1-mini",
            temperature: 0.3,
            max_tokens: 1024,
            created_at: "2026-10-22T00:00:00Z",
          },
        ]}
      />
    );

    expect(screen.getByRole("heading", { name: "Version History" })).toBeInTheDocument();
    expect(screen.getByText("v2")).toBeInTheDocument();
    expect(screen.getByText("Live")).toBeInTheDocument();
  });
});
