import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import DashboardPage, {
  MetricCard,
  ActivityItem,
  ActivityFeed,
  WorkflowExecutionChart,
  TopWorkflowsTable,
  HumanReviewQueue,
  AgentStatusGauge,
} from "@/app/dashboard/page";

import {
  Bot,
  CheckCircle2,
  Shapes,
  Timer,
  X,
  Zap,
} from "lucide-react";

describe("DashboardPage", () => {
  it("renders without errors", () => {
    render(<DashboardPage />);
  });

  it("renders the welcome banner", () => {
    render(<DashboardPage />);
    expect(screen.getByText(/Welcome back, Arif/)).toBeInTheDocument();
    expect(screen.getByText(/what's happening/)).toBeInTheDocument();
  });

  it("renders all five metric card labels", () => {
    render(<DashboardPage />);
    expect(screen.getByText("Active Workflows")).toBeInTheDocument();
    expect(screen.getByText("Total Executions")).toBeInTheDocument();
    expect(screen.getAllByText("Success Rate")).toHaveLength(2);
    expect(screen.getByText("Time Saved")).toBeInTheDocument();
    expect(screen.getByText("Active AI Agents")).toBeInTheDocument();
  });

  it("renders metric card values", () => {
    render(<DashboardPage />);
    expect(screen.getByText("24")).toBeInTheDocument();
    expect(screen.getByText("1.42K")).toBeInTheDocument();
    expect(screen.getByText("96.3%")).toBeInTheDocument();
    expect(screen.getByText(/320/)).toBeInTheDocument();
    expect(screen.getAllByText("18")).toHaveLength(2);
  });

  it("renders the workflow execution chart section", () => {
    render(<DashboardPage />);
    expect(
      screen.getByText("Workflow Execution Overview")
    ).toBeInTheDocument();
    expect(screen.getByText(/Successful/)).toBeInTheDocument();
    expect(screen.getByText(/Failed/)).toBeInTheDocument();
    expect(screen.getByText("Human Review (12)")).toBeInTheDocument();
    expect(screen.getByText("Last 7 Days")).toBeInTheDocument();
  });

  it("renders the recent activity feed with all items", () => {
    render(<DashboardPage />);
    expect(screen.getByText("Recent Activity")).toBeInTheDocument();
    expect(screen.getByText("2m ago")).toBeInTheDocument();
    expect(screen.getByText("15m ago")).toBeInTheDocument();
    expect(screen.getByText("1h ago")).toBeInTheDocument();
    expect(screen.getByText("2h ago")).toBeInTheDocument();
    expect(screen.getByText("3h ago")).toBeInTheDocument();
    expect(screen.getAllByText("View All")).toHaveLength(3);
  });

  it("renders the top performing workflows table", () => {
    render(<DashboardPage />);
    expect(
      screen.getByText("Top Performing Workflows")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "Workflow" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "Success Rate" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "Executions" })
    ).toBeInTheDocument();
  });

  it("renders the human review queue with all items", () => {
    render(<DashboardPage />);
    expect(screen.getByText("Human Review Queue")).toBeInTheDocument();
    expect(screen.getByText("Purchase Approval Flow")).toBeInTheDocument();
    expect(screen.getByText("Vendor Verification")).toBeInTheDocument();
  });

  it("renders the AI agent status gauge", () => {
    render(<DashboardPage />);
    expect(screen.getByText("AI Agent Status")).toBeInTheDocument();
    expect(screen.getByText("Total Agents")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("Idle")).toBeInTheDocument();
    expect(screen.getByText("In Review")).toBeInTheDocument();
    expect(screen.getByText("Error")).toBeInTheDocument();
    expect(screen.getByText("Manage Agents")).toBeInTheDocument();
  });
});

describe("MetricCard", () => {
  it("renders label, value, and change", () => {
    render(
      <MetricCard
        data={{
          id: "test",
          label: "Test Metric",
          value: "100",
          change: "5% vs yesterday",
          Icon: Bot,
          iconBg: "bg-blue-50",
          iconColor: "text-blue-600",
        }}
      />
    );
    expect(screen.getByText("Test Metric")).toBeInTheDocument();
    expect(screen.getByText("100")).toBeInTheDocument();
    expect(screen.getByText("5% vs yesterday")).toBeInTheDocument();
  });

  it("renders the icon", () => {
    const { container } = render(
      <MetricCard
        data={{
          id: "test",
          label: "Bot Metric",
          value: "1",
          change: "0% vs yesterday",
          Icon: Bot,
          iconBg: "bg-cyan-50",
          iconColor: "text-cyan-600",
        }}
      />
    );
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("renders suffix when provided", () => {
    const { container } = render(
      <MetricCard
        data={{
          id: "time",
          label: "Time Saved",
          value: "320",
          suffix: "h",
          change: "15% vs yesterday",
          Icon: Timer,
          iconBg: "bg-amber-50",
          iconColor: "text-amber-600",
        }}
      />
    );
    expect(container.textContent).toContain("320");
    expect(container.textContent).toContain("h");
  });
});

describe("ActivityItem", () => {
  it("renders name, description, and timestamp", () => {
    render(
      <ActivityItem
        item={{
          id: "test",
          name: "Test Workflow",
          description: "Executed successfully",
          timestamp: "2m ago",
          status: "success",
          Icon: CheckCircle2,
          iconBg: "bg-emerald-50",
          iconColor: "text-emerald-600",
          dotColor: "bg-emerald-500",
        }}
      />
    );
    expect(screen.getByText("Test Workflow")).toBeInTheDocument();
    expect(
      screen.getByText("Executed successfully")
    ).toBeInTheDocument();
    expect(screen.getByText("2m ago")).toBeInTheDocument();
  });

  it("renders the status icon", () => {
    const { container } = render(
      <ActivityItem
        item={{
          id: "test",
          name: "Test Workflow",
          description: "Execution failed",
          timestamp: "1h ago",
          status: "failed",
          Icon: X,
          iconBg: "bg-rose-50",
          iconColor: "text-rose-600",
          dotColor: "bg-rose-500",
        }}
      />
    );
    expect(container.querySelector("svg")).toBeInTheDocument();
  });
});

describe("ActivityFeed", () => {
  it("renders all activity items", () => {
    render(
      <ActivityFeed
        items={[
          {
            id: "a1",
            name: "Workflow A",
            description: "Done",
            timestamp: "1m ago",
            status: "success",
            Icon: CheckCircle2,
            iconBg: "bg-emerald-50",
            iconColor: "text-emerald-600",
            dotColor: "bg-emerald-500",
          },
          {
            id: "a2",
            name: "Workflow B",
            description: "Pending",
            timestamp: "5m ago",
            status: "pending",
            Icon: Zap,
            iconBg: "bg-amber-50",
            iconColor: "text-amber-600",
            dotColor: "bg-amber-400",
          },
        ]}
      />
    );
    expect(screen.getByText("Workflow A")).toBeInTheDocument();
    expect(screen.getByText("Workflow B")).toBeInTheDocument();
  });
});

describe("WorkflowExecutionChart", () => {
  it("renders title and legend with counts", () => {
    render(
      <WorkflowExecutionChart
        data={{ successful: 312, failed: 8, humanReview: 12 }}
      />
    );
    expect(
      screen.getByText("Workflow Execution Overview")
    ).toBeInTheDocument();
    expect(screen.getByText("Successful (312)")).toBeInTheDocument();
    expect(screen.getByText("Failed (8)")).toBeInTheDocument();
    expect(screen.getByText("Human Review (12)")).toBeInTheDocument();
  });

  it("renders the time period selector", () => {
    render(
      <WorkflowExecutionChart
        data={{ successful: 10, failed: 0, humanReview: 0 }}
      />
    );
    expect(screen.getByText("Last 7 Days")).toBeInTheDocument();
  });
});

describe("TopWorkflowsTable", () => {
  it("renders workflow rows with data", () => {
    render(
      <TopWorkflowsTable
        workflows={[
          {
            id: "wf-1",
            name: "Test Workflow",
            Icon: Shapes,
            iconBg: "bg-blue-50",
            iconColor: "text-blue-600",
            successRate: "98.6%",
            executions: 432,
          },
        ]}
      />
    );
    expect(screen.getByText("Test Workflow")).toBeInTheDocument();
    expect(screen.getByText("98.6%")).toBeInTheDocument();
    expect(screen.getByText("432")).toBeInTheDocument();
  });

  it("renders empty state", () => {
    const { container } = render(<TopWorkflowsTable workflows={[]} />);
    expect(container.querySelector("tbody")).toBeEmptyDOMElement();
  });
});

describe("HumanReviewQueue", () => {
  it("renders review items with counts", () => {
    render(
      <HumanReviewQueue
        items={[
          {
            id: "rq-1",
            name: "Review Item",
            submitted: "Submitted 5m ago",
            count: 3,
            badgeBg: "bg-blue-100",
            badgeColor: "text-blue-600",
          },
        ]}
      />
    );
    expect(screen.getByText("Review Item")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("Submitted 5m ago")).toBeInTheDocument();
  });

  it("renders empty state", () => {
    render(<HumanReviewQueue items={[]} />);
    expect(screen.getByText("Human Review Queue")).toBeInTheDocument();
  });
});

describe("AgentStatusGauge", () => {
  it("renders total agents and status segments", () => {
    render(
      <AgentStatusGauge
        summary={[
          { label: "Active", value: 12, dotColor: "bg-emerald-500" },
          { label: "Idle", value: 4, dotColor: "bg-blue-500" },
        ]}
        total={18}
      />
    );
    expect(screen.getByText("Total Agents")).toBeInTheDocument();
    expect(screen.getByText("18")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("Idle")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
  });

  it("renders the manage agents link", () => {
    render(
      <AgentStatusGauge
        summary={[
          { label: "Active", value: 1, dotColor: "bg-emerald-500" },
        ]}
        total={1}
      />
    );
    expect(screen.getByText("Manage Agents")).toBeInTheDocument();
  });
});
