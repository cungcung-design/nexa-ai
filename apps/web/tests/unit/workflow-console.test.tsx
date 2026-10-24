import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  WorkflowConsole,
  type WorkflowExecution,
} from "@/components/workflow-console";

const definitions = [
  {
    key: "demo_create_note",
    name: "demo_create_note",
    description: "Pauses for human approval, then stores a demo note.",
    requires_approval: true,
    inputs: [
      { name: "agent_id", type: "uuid", required: true },
      { name: "note", type: "string", required: true, min_length: 1, max_length: 500 },
    ],
  },
];

const agents = [
  {
    id: "agent-1",
    name: "Support Agent",
    description: "",
    is_archived: false,
  },
];

const waiting: WorkflowExecution = {
  id: "execution-1",
  workflow_key: "demo_create_note",
  workflow_name: "demo_create_note",
  thread_id: "thread-1",
  status: "PENDING",
  display_status: "waiting_for_approval",
  agent_id: "agent-1",
  agent_name: "Support Agent",
  arguments: { note: "alpha note" },
  result: null,
  checkpoint_error: null,
  created_at: "2026-10-22T05:00:00Z",
  completed_at: null,
};

describe("workflow console", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("shows the implemented workflow and an empty history", () => {
    render(
      <WorkflowConsole
        orgId="org-1"
        role="OWNER"
        agents={agents as never}
        definitions={definitions}
        initialExecutions={[]}
      />
    );

    expect(screen.getByText("demo_create_note")).toBeInTheDocument();
    expect(screen.getByText("No executions yet.")).toBeInTheDocument();
    expect(screen.queryByText(/142 req\/min/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Apply Normalization/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Latency 15ms/)).not.toBeInTheDocument();
  });

  it("starts one execution and ignores a duplicate submit", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(
      () => new Promise(() => undefined)
    );
    render(
      <WorkflowConsole
        orgId="org-1"
        role="OWNER"
        agents={agents as never}
        definitions={definitions}
        initialExecutions={[]}
      />
    );

    await user.type(screen.getByLabelText("Note"), "alpha note");
    const form = screen.getByRole("button", { name: "Start workflow" }).closest("form");
    fireEvent.submit(form!);
    fireEvent.submit(form!);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Starting..." })).toBeDisabled();
  });

  it("shows a pending approval link and a completed result", () => {
    const completed: WorkflowExecution = {
      ...waiting,
      id: "execution-2",
      status: "APPROVED",
      display_status: "completed",
      result: { note: "Demo note created: alpha note" },
      completed_at: "2026-10-22T05:05:00Z",
    };
    render(
      <WorkflowConsole
        orgId="org-1"
        role="ADMIN"
        agents={agents as never}
        definitions={definitions}
        initialExecutions={[waiting, completed]}
      />
    );

    expect(screen.getByText("Waiting for approval")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open approval" })).toHaveAttribute(
      "href",
      "/dashboard/organizations/org-1/approvals/execution-1"
    );
    expect(screen.getByText("Demo note created: alpha note")).toBeInTheDocument();
    expect(screen.getByText("Completed")).toBeInTheDocument();
  });

  it("shows a rejected result and blocks viewers from starting", () => {
    render(
      <WorkflowConsole
        orgId="org-1"
        role="VIEWER"
        agents={agents as never}
        definitions={definitions}
        initialExecutions={[
          {
            ...waiting,
            status: "REJECTED",
            display_status: "rejected",
            result: { error: "Action rejected by human" },
            completed_at: "2026-10-22T05:06:00Z",
          },
        ]}
      />
    );

    expect(screen.getByText("Rejected")).toBeInTheDocument();
    expect(screen.getByText("Action rejected by human")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start workflow" })).toBeDisabled();
  });
});
