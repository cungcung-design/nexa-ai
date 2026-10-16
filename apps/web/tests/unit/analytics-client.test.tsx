import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { AnalyticsClient } from "@/components/analytics-client";

const mockTraces = [
  {
    id: "trace-1",
    organization_id: "org-1",
    agent_id: "agent-1",
    status: "success",
    error_code: null,
    latency_ms: 1200,
    prompt_tokens: 100,
    completion_tokens: 50,
    created_at: "2026-10-10T10:00:00Z",
  },
  {
    id: "trace-2",
    organization_id: "org-1",
    agent_id: "agent-2",
    status: "failed",
    error_code: "rate_limit",
    latency_ms: 800,
    prompt_tokens: 200,
    completion_tokens: 100,
    created_at: "2026-10-11T10:00:00Z",
  },
  {
    id: "trace-3",
    organization_id: "org-1",
    agent_id: "agent-1",
    status: "success",
    error_code: null,
    latency_ms: 1500,
    prompt_tokens: 150,
    completion_tokens: 75,
    created_at: "2026-10-12T10:00:00Z",
  },
];

function mockFetchTraces(traces: typeof mockTraces, ok = true) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok,
    json: async () => traces,
  } as Response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("AnalyticsClient", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders loading state initially", () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
    } as Response);
    vi.stubGlobal("fetch", fetchMock);

    render(<AnalyticsClient orgId="org-1" />);

    expect(screen.getByText(/Monitor performance across your AI workspace/)).toBeInTheDocument();
  });

  it("fetches traces from the workspace analytics endpoint with credentials", async () => {
    const fetchMock = mockFetchTraces(mockTraces);

    render(<AnalyticsClient orgId="org-1" />);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/workspace/org-1/analytics/traces",
      expect.objectContaining({ credentials: "include" })
    );
  });

  it("renders metric cards with correct values", async () => {
    mockFetchTraces(mockTraces);

    render(<AnalyticsClient orgId="org-1" />);

    // Total requests: 3 traces
    const threes = await screen.findAllByText("3");
    expect(threes.length).toBeGreaterThanOrEqual(1);
    // Success rate: 2/3 = 67%
    const rates = await screen.findAllByText("67%");
    expect(rates.length).toBeGreaterThanOrEqual(1);
    // Avg latency: (1200+800+1500)/3 = 1166.67ms = 1.17s
    const latencies = await screen.findAllByText("1.17s");
    expect(latencies.length).toBeGreaterThanOrEqual(1);
    // Total cost: 675/1000 * 0.002 = 0.00135 -> $0.00
    expect(await screen.findByText("$0.00")).toBeInTheDocument();
  });

  it("renders all metric card labels", async () => {
    mockFetchTraces(mockTraces);

    render(<AnalyticsClient orgId="org-1" />);

    expect(await screen.findByText("Total requests")).toBeInTheDocument();
    expect(await screen.findByText("Success rate")).toBeInTheDocument();
    expect(await screen.findByText("Avg. latency")).toBeInTheDocument();
    expect(await screen.findByText("Total cost")).toBeInTheDocument();
  });

  it("renders filter pills", async () => {
    mockFetchTraces(mockTraces);

    render(<AnalyticsClient orgId="org-1" />);

    expect(await screen.findByText("Last 30 days")).toBeInTheDocument();
    expect(await screen.findByText("All agents")).toBeInTheDocument();
  });

  it("renders the main Export button", async () => {
    mockFetchTraces(mockTraces);

    render(<AnalyticsClient orgId="org-1" />);

    const exportButtons = await screen.findAllByRole("button", { name: "Export" });
    expect(exportButtons.length).toBeGreaterThanOrEqual(1);
  });

  it("renders the chart with successful and failed legend", async () => {
    mockFetchTraces(mockTraces);

    render(<AnalyticsClient orgId="org-1" />);

    expect(await screen.findByText("AI Request Activity")).toBeInTheDocument();
    const successful = await screen.findAllByText("Successful");
    expect(successful.length).toBeGreaterThanOrEqual(1);
    const failed = await screen.findAllByText("Failed");
    expect(failed.length).toBeGreaterThanOrEqual(1);
  });

  it("renders error state when fetch fails", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("Network error"));
    vi.stubGlobal("fetch", fetchMock);

    render(<AnalyticsClient orgId="org-1" />);

    expect(await screen.findByText("Network error")).toBeInTheDocument();
  });

  it("renders error state when response is not ok", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Unauthorized" }),
    } as Response);
    vi.stubGlobal("fetch", fetchMock);

    render(<AnalyticsClient orgId="org-1" />);

    expect(await screen.findByText("Failed to load analytics")).toBeInTheDocument();
  });

  it("handles empty traces array", async () => {
    mockFetchTraces([]);

    render(<AnalyticsClient orgId="org-1" />);

    const zeros = await screen.findAllByText("0");
    expect(zeros.length).toBeGreaterThanOrEqual(1);
    expect(await screen.findByText("0%")).toBeInTheDocument();
    expect(await screen.findByText("0.00s")).toBeInTheDocument();
    expect(await screen.findByText("$0.00")).toBeInTheDocument();
  });

  it("renders day-of-week labels in chart", async () => {
    mockFetchTraces(mockTraces);

    render(<AnalyticsClient orgId="org-1" />);

    await screen.findAllByText("Mon");
    await screen.findAllByText("Tue");
    await screen.findAllByText("Wed");
    await screen.findAllByText("Thu");
    await screen.findAllByText("Fri");
    await screen.findAllByText("Sat");
    await screen.findAllByText("Sun");
  });
});
