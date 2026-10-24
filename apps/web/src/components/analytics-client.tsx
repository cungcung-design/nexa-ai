"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Download, MessageCircle, X } from "lucide-react";

import {
  agentActivity,
  dailyActivity,
  filterTraces,
  summarizeTraces,
  type AnalyticsTrace,
} from "@/lib/analytics-metrics";
import { formatTimestamp } from "@/lib/format-time";

function formatNumber(value: number): string {
  return value.toString();
}

function latencyLabel(milliseconds: number): string {
  return `${(milliseconds / 1000).toFixed(2)}s`;
}

function exportTraces(traces: AnalyticsTrace[]) {
  const header = [
    "id",
    "agent",
    "model",
    "status",
    "recorded_at",
    "latency_ms",
    "prompt_tokens",
    "completion_tokens",
    "total_tokens",
    "error",
  ];
  const lines = traces.map((trace) =>
    [
      trace.id,
      trace.agent_name ?? "",
      trace.model ?? "",
      trace.status,
      trace.created_at,
      trace.latency_ms,
      trace.prompt_tokens,
      trace.completion_tokens,
      trace.prompt_tokens + trace.completion_tokens,
      trace.error_code ?? "",
    ]
      .map((value) => `"${String(value).replaceAll('"', '""')}"`)
      .join(",")
  );
  const blob = new Blob([[header.join(","), ...lines].join("\n")], {
    type: "text/csv",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "nexora-traces.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}

export function AnalyticsClient({ orgId }: { orgId: string }) {
  const [traces, setTraces] = useState<AnalyticsTrace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [days, setDays] = useState("30");
  const [agentId, setAgentId] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(
          `/api/workspace/${encodeURIComponent(orgId)}/analytics/traces?days=${days}`,
          { credentials: "include", cache: "no-store" }
        );
        if (!response.ok) throw new Error("Failed to load analytics");
        const body = (await response.json()) as AnalyticsTrace[];
        if (mounted) setTraces(Array.isArray(body) ? body : []);
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : "Failed to load analytics");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void load();
    return () => {
      mounted = false;
    };
  }, [orgId, days]);

  const visible = useMemo(
    () => filterTraces(traces, { agentId, status }),
    [traces, agentId, status]
  );
  const summary = summarizeTraces(visible);
  const buckets = dailyActivity(visible, Number(days) || 30, new Date());
  const agents = agentActivity(visible);
  const maxValue = Math.max(
    1,
    ...buckets.flatMap((bucket) => [bucket.successful, bucket.failed])
  );
  const hasActivity = buckets.some(
    (bucket) => bucket.successful > 0 || bucket.failed > 0
  );
  const agentOptions = agentActivity(traces);
  const labelStep = buckets.length > 14 ? Math.ceil(buckets.length / 7) : 1;

  const linePath = (key: "successful" | "failed") => {
    return buckets
      .map((bucket, index) => {
        const x = buckets.length === 1 ? 0 : (index / (buckets.length - 1)) * 700;
        const y = 224 - (bucket[key] / maxValue) * 184;
        return `${index === 0 ? "M" : "L"} ${x} ${y}`;
      })
      .join(" ");
  };

  return (
    <div className="bg-gray-50 text-gray-900 min-h-screen p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Analytics</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Monitor performance across your AI workspace
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 px-3.5 py-2 bg-white border border-gray-200/80 rounded-xl text-xs font-medium text-gray-700 shadow-2xs">
              <span className="sr-only">Date range</span>
              <select
                aria-label="Date range"
                value={days}
                onChange={(event) => setDays(event.target.value)}
                className="bg-transparent outline-none"
              >
                <option value="7">Last 7 days</option>
                <option value="30">Last 30 days</option>
              </select>
            </label>
            <label className="flex items-center gap-2 px-3.5 py-2 bg-white border border-gray-200/80 rounded-xl text-xs font-medium text-gray-700 shadow-2xs">
              <span className="sr-only">Agent</span>
              <select
                aria-label="Agent"
                value={agentId}
                onChange={(event) => setAgentId(event.target.value)}
                className="bg-transparent outline-none"
              >
                <option value="">All agents</option>
                {agentOptions.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 px-3.5 py-2 bg-white border border-gray-200/80 rounded-xl text-xs font-medium text-gray-700 shadow-2xs">
              <span className="sr-only">Status</span>
              <select
                aria-label="Status"
                value={status}
                onChange={(event) => setStatus(event.target.value)}
                className="bg-transparent outline-none"
              >
                <option value="">All statuses</option>
                <option value="success">Successful</option>
                <option value="error">Failed</option>
              </select>
            </label>
          </div>
          <button
            type="button"
            className="flex items-center gap-2 px-3.5 py-2 bg-white hover:bg-gray-50 border border-gray-200/80 rounded-xl text-xs font-medium text-gray-700 shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
            onClick={() => exportTraces(visible)}
            disabled={visible.length === 0}
          >
            <Download className="w-4 h-4 text-gray-400" />
            Export
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link
            href={`/dashboard/organizations/${encodeURIComponent(orgId)}/analytics/traces`}
            className="block"
          >
            <div className="bg-white border border-gray-200/80 rounded-2xl p-5 shadow-xs">
              <span className="text-xs font-medium text-gray-500">Total requests</span>
              <h2 className="text-2xl font-bold text-gray-900 tracking-tight mt-2">
                {formatNumber(summary.total)}
              </h2>
              <p className="text-xs text-gray-500 mt-4 pt-3 border-t border-gray-100">
                {summary.successful} successful · {summary.failed} failed
              </p>
            </div>
          </Link>
          <Link
            href={`/dashboard/organizations/${encodeURIComponent(orgId)}/analytics/traces`}
            className="block"
          >
            <div className="bg-white border border-gray-200/80 rounded-2xl p-5 shadow-xs">
              <span className="text-xs font-medium text-gray-500">Success rate</span>
              <h2 className="text-2xl font-bold text-gray-900 tracking-tight mt-2">
                {summary.successRate}%
              </h2>
              <p className="text-xs text-gray-500 mt-4 pt-3 border-t border-gray-100">
                From the requests in this range
              </p>
            </div>
          </Link>
          <Link
            href={`/dashboard/organizations/${encodeURIComponent(orgId)}/analytics/traces`}
            className="block"
          >
            <div className="bg-white border border-gray-200/80 rounded-2xl p-5 shadow-xs">
              <span className="text-xs font-medium text-gray-500">Avg. latency</span>
              <h2 className="text-2xl font-bold text-gray-900 tracking-tight mt-2">
                {latencyLabel(summary.averageLatencyMs)}
              </h2>
              <p className="text-xs text-gray-500 mt-4 pt-3 border-t border-gray-100">
                Mean duration of the recorded requests
              </p>
            </div>
          </Link>
          <Link
            href={`/dashboard/organizations/${encodeURIComponent(orgId)}/analytics/usage`}
            className="block"
          >
            <div className="bg-white border border-gray-200/80 rounded-2xl p-5 shadow-xs">
              <span className="text-xs font-medium text-gray-500">Total cost</span>
              <h2 className="text-2xl font-bold text-gray-900 tracking-tight mt-2">
                Unavailable
              </h2>
              <p className="text-xs text-gray-500 mt-4 pt-3 border-t border-gray-100">
                Token usage {formatNumber(summary.totalTokens)}. Cost is not recorded.
              </p>
            </div>
          </Link>
        </div>

        <div className="bg-white border border-gray-200/80 rounded-2xl p-6 shadow-xs">
          <h3 className="text-base font-semibold text-gray-900 tracking-tight">
            AI Request Activity
          </h3>
          <p className="text-xs text-gray-500 mt-1">
            Prompt tokens {summary.promptTokens} · Completion tokens {summary.completionTokens}
          </p>
          {loading ? (
            <div className="h-72 flex items-center justify-center text-gray-400">
              Loading requests
            </div>
          ) : error ? (
            <div className="h-72 flex flex-col items-center justify-center text-gray-400">
              <X className="size-8 mb-2" />
              <p className="text-sm">{error}</p>
            </div>
          ) : !hasActivity ? (
            <div className="h-72 flex items-center justify-center text-gray-400">
              No requests in this range.
            </div>
          ) : (
            <div className="relative h-72 w-full pt-4">
              <div className="absolute left-0 top-4 bottom-8 flex flex-col justify-between text-xs text-gray-400">
                <span>{maxValue}</span>
                <span>{Math.round(maxValue / 2)}</span>
                <span>0</span>
              </div>
              <svg
                className="w-full h-56 pl-8 overflow-visible"
                viewBox="0 0 700 240"
                role="img"
                aria-label="Request activity"
              >
                <path d={linePath("successful")} fill="none" stroke="#60a5fa" strokeWidth={2.5} />
                <path d={linePath("failed")} fill="none" stroke="#4ade80" strokeWidth={2} />
              </svg>
              <div className="grid text-xs text-gray-500 font-medium pl-8 text-center"
                style={{ gridTemplateColumns: `repeat(${buckets.length}, minmax(0, 1fr))` }}
              >
                {buckets.map((bucket, index) => (
                  <span key={bucket.key}>
                    {index % labelStep === 0 ? bucket.label : ""}
                  </span>
                ))}
              </div>
              <div className="flex items-center justify-center gap-6 mt-4 pt-4 border-t border-gray-100">
                <span className="text-xs font-medium text-gray-700">Successful</span>
                <span className="text-xs font-medium text-gray-700">Failed</span>
              </div>
            </div>
          )}
        </div>

        <div>
          <h3 className="text-sm font-bold text-gray-900 mb-4">Agent activity</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-100 text-xs font-medium text-gray-400">
                  <th className="py-3 font-medium">Agent</th>
                  <th className="py-3 font-medium text-right">Requests</th>
                  <th className="py-3 font-medium text-right">Success</th>
                  <th className="py-3 font-medium text-right">Latency</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 text-sm">
                {agents.length > 0 ? (
                  agents.map((agent) => (
                    <tr key={agent.id}>
                      <td className="py-4">
                        <span className="inline-flex items-center gap-3 font-medium text-gray-900">
                          <MessageCircle className="w-4 h-4 text-gray-500" />
                          {agent.name}
                        </span>
                      </td>
                      <td className="py-4 text-right">{agent.requests}</td>
                      <td className="py-4 text-right">{agent.successRate}%</td>
                      <td className="py-4 text-right">
                        {latencyLabel(agent.averageLatencyMs)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="py-8 text-center text-gray-400" colSpan={4}>
                      No requests in this range.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-bold text-gray-900 mb-4">Recent failed requests</h3>
          {visible.some((trace) => trace.status !== "success") ? (
            <div className="space-y-3">
              {visible
                .filter((trace) => trace.status !== "success")
                .slice(0, 5)
                .map((trace) => (
                  <Link
                    key={trace.id}
                    href={`/dashboard/organizations/${encodeURIComponent(orgId)}/analytics/traces/${trace.id}`}
                    className="flex flex-wrap items-center justify-between gap-3 p-4 bg-white border border-gray-200/80 rounded-xl"
                  >
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900">
                        {trace.agent_name?.trim() || "Unavailable"}
                      </h3>
                      <p className="text-xs text-gray-400 font-mono mt-0.5">{trace.id}</p>
                      <p className="text-xs text-rose-600 mt-1">
                        {trace.error_code || "Error details unavailable"}
                      </p>
                    </div>
                    <div className="text-right text-xs text-gray-600">
                      <p>{latencyLabel(trace.latency_ms)}</p>
                      <p>{formatTimestamp(trace.created_at)}</p>
                    </div>
                  </Link>
                ))}
            </div>
          ) : (
            <div className="p-8 text-center text-gray-400 bg-gray-50/50 rounded-xl border border-gray-100">
              No failed requests in the selected period.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
