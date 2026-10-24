import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

import { AgentPlaygroundChat } from "@/components/agent-playground-chat";

const props = {
  orgId: "org-1",
  agentId: "agent-1",
  agentName: "Support Agent",
  versionLabel: "1",
  model: "qwen3:4b",
  temperature: 0.2,
  initialConversationId: null,
  initialMessages: [],
};

describe("agent playground chat", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("requires a published version and does not show the sample refund transcript", () => {
    render(<AgentPlaygroundChat {...props} published={false} />);

    expect(screen.queryByText(/refund policy/i)).not.toBeInTheDocument();
    expect(
      screen.getByText("Publish this agent before sending a message.")
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send message" })).toBeDisabled();
  });

  it("sends one persisted message and ignores a duplicate submit", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(
      () => new Promise(() => undefined)
    );
    render(<AgentPlaygroundChat {...props} published />);

    await user.type(screen.getByLabelText("Message"), "Hello agent");
    const form = screen.getByRole("button", { name: "Send message" }).closest("form");
    expect(form).not.toBeNull();
    fireEvent.submit(form!);
    fireEvent.submit(form!);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/workspace/org-1/conversations",
      expect.objectContaining({ method: "POST" })
    );
    expect(screen.getByRole("button", { name: "Send message" })).toBeDisabled();
    expect(screen.getByText("Generating response...")).toBeInTheDocument();
  });

  it("shows a provider failure without an assistant message", async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith("/conversations")) {
        return new Response(JSON.stringify({ id: "conversation-1" }), { status: 201 });
      }
      return new Response(
        JSON.stringify({ detail: "LLM provider request failed" }),
        { status: 502 }
      );
    });
    render(<AgentPlaygroundChat {...props} published />);

    await user.type(screen.getByLabelText("Message"), "Hello agent");
    await user.click(screen.getByRole("button", { name: "Send message" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "LLM provider request failed"
    );
    expect(screen.queryByText("Stored assistant reply")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Message")).toHaveValue("Hello agent");
  });

  it("restores a saved conversation", () => {
    render(
      <AgentPlaygroundChat
        {...props}
        published
        initialConversationId="conversation-1"
        initialMessages={[
          { id: "m1", role: "user", content: "Remember blue" },
          { id: "m2", role: "assistant", content: "I will remember blue." },
        ]}
      />
    );

    expect(screen.getByText("Remember blue")).toBeInTheDocument();
    expect(screen.getByText("I will remember blue.")).toBeInTheDocument();
  });
});
