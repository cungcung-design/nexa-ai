import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { AgentCard } from "@/components/agents/AgentCard";

describe("AgentCard", () => {
  it("displays agent information", () => {
    render(
      <AgentCard
        id="agent-123"
        name="Customer Support Agent"
        description="Answers customer questions"
        published={true}
        onOpen={() => {}}
      />
    );

    expect(
      screen.getByText("Customer Support Agent")
    ).toBeInTheDocument();

    expect(
      screen.getByText("Answers customer questions")
    ).toBeInTheDocument();

    expect(
      screen.getByTestId("agent-status")
    ).toHaveTextContent("Published");
  });

  it("displays draft status", () => {
    render(
      <AgentCard
        id="agent-123"
        name="Draft Agent"
        description="Not published"
        published={false}
        onOpen={() => {}}
      />
    );

    expect(
      screen.getByTestId("agent-status")
    ).toHaveTextContent("Draft");
  });

  it("opens the selected agent", async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();

    render(
      <AgentCard
        id="agent-123"
        name="Support Agent"
        description="Support"
        published={true}
        onOpen={onOpen}
      />
    );

    await user.click(
      screen.getByRole("button", {
        name: "Open Agent",
      })
    );

    expect(onOpen).toHaveBeenCalledWith("agent-123");
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});
