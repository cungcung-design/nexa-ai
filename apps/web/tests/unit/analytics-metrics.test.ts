import { describe, expect, it } from "vitest";

import {
  dailyActivity,
  filterTraces,
  summarizeTraces,
  type AnalyticsTrace,
} from "@/lib/analytics-metrics";
import { formatTimestamp } from "@/lib/format-time";

const traces: AnalyticsTrace[] = [
  {
    id: "trace-1",
    agent_id: "agent-1",
    agent_name: "Support",
    status: "success",
    latency_ms: 1000,
    prompt_tokens: 10,
    completion_tokens: 5,
    created_at: "2026-10-20T10:00:00Z",
  },
  {
    id: "trace-2",
    agent_id: "agent-1",
    agent_name: "Support",
    status: "error",
    error_code: "AGENT_EXECUTION_FAILED",
    latency_ms: 500,
    prompt_tokens: 20,
    completion_tokens: 0,
    created_at: "2026-10-21T10:00:00Z",
  },
  {
    id: "trace-3",
    agent_id: "agent-2",
    status: "success",
    latency_ms: 1500,
    prompt_tokens: 30,
    completion_tokens: 15,
    created_at: "2026-09-01T10:00:00Z",
  },
];

describe("analytics calculations", () => {
  it("summarizes the supplied requests", () => {
    const summary = summarizeTraces(traces);
    expect(summary).toMatchObject({
      total: 3,
      successful: 2,
      failed: 1,
      successRate: 67,
      averageLatencyMs: 1000,
      promptTokens: 60,
      completionTokens: 20,
      totalTokens: 80,
    });
  });

  it("returns an empty summary without inventing a cost", () => {
    const summary = summarizeTraces([]);
    expect(summary.total).toBe(0);
    expect(summary.successRate).toBe(0);
    expect(summary.totalTokens).toBe(0);
  });

  it("filters by agent and status", () => {
    expect(filterTraces(traces, { agentId: "agent-1" })).toHaveLength(2);
    expect(filterTraces(traces, { status: "error" })).toHaveLength(1);
  });

  it("counts only days inside the selected range", () => {
    const buckets = dailyActivity(
      traces,
      7,
      new Date("2026-10-22T12:00:00Z")
    );
    const counted = buckets.reduce(
      (sum, bucket) => sum + bucket.successful + bucket.failed,
      0
    );
    expect(counted).toBe(2);
    expect(buckets.find((bucket) => bucket.key === "2026-10-20")?.successful).toBe(1);
    expect(buckets.find((bucket) => bucket.key === "2026-09-01")).toBeUndefined();
  });
});

describe("timestamp formatting", () => {
  it("renders the same UTC text for one instant", () => {
    const first = formatTimestamp("2026-10-22T09:15:00.000Z");
    const second = formatTimestamp("2026-10-22T09:15:00.000Z");
    expect(first).toBe("22 Oct 2026, 09:15 UTC");
    expect(second).toBe(first);
  });

  it("keeps an invalid value unchanged", () => {
    expect(formatTimestamp("not-a-date")).toBe("not-a-date");
    expect(formatTimestamp(null)).toBe("—");
  });
});
