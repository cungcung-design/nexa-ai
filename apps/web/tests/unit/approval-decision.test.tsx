import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const refresh = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh, push: vi.fn(), replace: vi.fn() }),
}));

const authorizedOrganization = vi.hoisted(() => vi.fn());
const backendGet = vi.hoisted(() => vi.fn());

vi.mock("@/lib/workspace", () => ({
  authorizedOrganization,
}));

vi.mock("@/lib/api", () => ({
  backendGet,
}));

import { DecisionButtons } from "@/components/approvals/decision-buttons";
import ApprovalReviewPage from "@/app/dashboard/organizations/[organizationId]/approvals/[approvalId]/page";

const approval = {
  id: "approval-1",
  status: "PENDING",
  action: "demo_create_note",
  thread_id: "thread-1",
  requested_by: null,
  decided_by: null,
  decided_at: null,
  created_at: "2026-10-22T00:00:00.000Z",
};

describe("approval review page", () => {
  beforeEach(() => {
    refresh.mockReset();
    authorizedOrganization.mockReset();
    backendGet.mockReset();
  });

  it("renders reviewer actions from loaded data without a server event handler", async () => {
    authorizedOrganization.mockResolvedValue({
      id: "org-1",
      role: "OWNER",
      name: "Acme",
    });
    backendGet.mockResolvedValue(approval);

    const ui = await ApprovalReviewPage({
      params: Promise.resolve({
        organizationId: "org-1",
        approvalId: "approval-1",
      }),
    });
    render(ui);

    expect(screen.getByRole("heading", { name: "demo_create_note" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Approve" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reject" })).toBeInTheDocument();
    expect(screen.getByText("Pending review")).toBeInTheDocument();
  });

  it("keeps the unauthorized note for members who cannot review", async () => {
    authorizedOrganization.mockResolvedValue({
      id: "org-1",
      role: "VIEWER",
      name: "Acme",
    });
    backendGet.mockResolvedValue(approval);

    const ui = await ApprovalReviewPage({
      params: Promise.resolve({
        organizationId: "org-1",
        approvalId: "approval-1",
      }),
    });
    render(ui);

    expect(
      screen.getByText("You are not authorized to approve or reject this request.")
    ).toBeInTheDocument();
  });
});

describe("dashboard decision buttons", () => {
  beforeEach(() => {
    refresh.mockReset();
    vi.restoreAllMocks();
  });

  it("approves through the durable workflow decision route", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ status: "APPROVED" }), { status: 200 })
    );

    render(
      <DecisionButtons orgId="org-1" approvalId="approval-1" status="PENDING" />
    );
    await user.click(screen.getByRole("button", { name: "Approve" }));

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/workspace/org-1/workflows/approvals/approval-1/decision",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ approved: true }),
      })
    );
    expect(await screen.findByText("Decision already recorded")).toBeInTheDocument();
    expect(refresh).toHaveBeenCalled();
  });

  it("rejects through the durable workflow decision route", async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ status: "REJECTED" }), { status: 200 })
    );

    render(
      <DecisionButtons orgId="org-1" approvalId="approval-1" status="PENDING" />
    );
    await user.click(screen.getByRole("button", { name: "Reject" }));

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/workspace/org-1/workflows/approvals/approval-1/decision",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ approved: false }),
      })
    );
    expect(await screen.findByText("Decision already recorded")).toBeInTheDocument();
  });

  it("shows a controlled conflict when the decision was already recorded", async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ detail: "Approval already decided" }), {
        status: 409,
      })
    );

    render(
      <DecisionButtons orgId="org-1" approvalId="approval-1" status="PENDING" />
    );
    await user.click(screen.getByRole("button", { name: "Approve" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Approval already decided"
    );
    expect(screen.getByRole("button", { name: "Approve" })).toBeEnabled();
  });

  it("does not send a decision for a request that is no longer pending", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.spyOn(globalThis, "fetch");

    render(
      <DecisionButtons orgId="org-1" approvalId="approval-1" status="APPROVED" />
    );
    expect(screen.getByText("Decision already recorded")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
    await user.click(screen.getByText("Decision already recorded"));

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
