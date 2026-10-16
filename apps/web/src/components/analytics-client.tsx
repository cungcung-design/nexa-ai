"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Download,
  MessageCircle,
  X,
} from "lucide-react";

type Trace = {
  id: string;
  organization_id: string;
  agent_id: string;
  status: string;
  error_code: string | null;
  latency_ms: number;
  prompt_tokens: number;
  completion_tokens: number;
  created_at: string;
};

type DayStats = {
  day: string;
  successful: number;
  failed: number;
};

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function dayOfWeekIndex(dateStr: string): number {
  return new Date(dateStr).getUTCDay();
}

export function AnalyticsClient({
  orgId,
}: {
  orgId: string;
}) {
  const [traces, setTraces] = useState<Trace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const r = await fetch(
          `/api/workspace/${encodeURIComponent(orgId)}/analytics/traces`,
          {
            credentials: "include",
          }
        );
        if (!r.ok) throw new Error("Failed to load analytics");
        const d = (await r.json()) as Trace[];
        if (mounted) setTraces(Array.isArray(d) ? d : []);
      } catch (err) {
        if (mounted)
          setError(
            err instanceof Error ? err.message : "Failed to load analytics"
          );
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void load();
    return () => {
      mounted = false;
    };
  }, [orgId]);

  const totalRequests = traces.length;
  const successfulRequests = traces.filter((t) => t.status === "success").length;
  const failedRequests = traces.filter((t) => t.status !== "success").length;
  const successRate =
    totalRequests > 0 ? Math.round((successfulRequests / totalRequests) * 100) : 0;
  const avgLatencyMs =
    totalRequests > 0
      ? Math.round(
          traces.reduce((sum, t) => sum + t.latency_ms, 0) / totalRequests
        )
      : 0;
  const avgLatency = (avgLatencyMs / 1000).toFixed(2);
  const tokenUsage = traces.reduce(
    (sum, t) => sum + t.prompt_tokens + t.completion_tokens,
    0
  );
  const estCost = (tokenUsage / 1000) * 0.002;

  const dayStats: DayStats[] = DAYS.map((day) => ({ day, successful: 0, failed: 0 }));
  traces.forEach((t) => {
    const idx = dayOfWeekIndex(t.created_at);
    const chartIdx = idx === 0 ? 6 : idx - 1;
    if (t.status === "success") {
      dayStats[chartIdx].successful += 1;
    } else {
      dayStats[chartIdx].failed += 1;
    }
  });

  const maxValue = Math.max(...dayStats.flatMap((d) => [d.successful, d.failed]), 1);

  const xCoords = [0, 116.66, 233.33, 350, 466.66, 583.33, 700];
  const chartTop = 40;
  const chartBottom = 224;
  const chartHeight = chartBottom - chartTop;

  const successfulPoints = dayStats.map((d, i) => {
    const y = chartBottom - (d.successful / maxValue) * chartHeight;
    return { x: xCoords[i], y };
  });
  const failedPoints = dayStats.map((d, i) => {
    const y = chartBottom - (d.failed / maxValue) * chartHeight;
    return { x: xCoords[i], y };
  });

  const linePath = (points: { x: number; y: number }[]) => {
    return points
      .map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`))
      .join(" ");
  };

  const formatNumber = (n: number): string => {
    if (n >= 1000) return (n / 1000).toFixed(1) + "K";
    return n.toString();
  };

  return (
    <div className="bg-gray-50 text-gray-900 min-h-screen p-6">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Page Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            Analytics
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Monitor performance across your AI workspace
          </p>
        </div>

        {/* Filter & Action Bar */}
        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 px-3.5 py-2 bg-white hover:bg-gray-50 border border-gray-200/80 rounded-xl text-xs font-medium text-gray-700 shadow-2xs transition-colors cursor-pointer">
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Last 30 days
              <svg className="w-3.5 h-3.5 text-gray-400 ml-1" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <button className="flex items-center gap-2 px-3.5 py-2 bg-white hover:bg-gray-50 border border-gray-200/80 rounded-xl text-xs font-medium text-gray-700 shadow-2xs transition-colors cursor-pointer">
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              All agents
              <svg className="w-3.5 h-3.5 text-gray-400 ml-1" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
          <button className="flex items-center gap-2 px-3.5 py-2 bg-white hover:bg-gray-50 border border-gray-200/80 rounded-xl text-xs font-medium text-gray-700 shadow-2xs transition-colors cursor-pointer">
            <Download className="w-4 h-4 text-gray-400" />
            Export
            <svg className="w-3.5 h-3.5 text-gray-400 ml-1" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>

        {/* 4 Metrics Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link
            href={`/dashboard/organizations/${encodeURIComponent(orgId)}/analytics/traces`}
            className="block"
          >
            <div className="bg-white border border-gray-200/80 rounded-2xl p-5 shadow-xs relative flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-gray-500">Total requests</span>
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="flex items-baseline justify-between">
                  <h2 className="text-2xl font-bold text-gray-900 tracking-tight">
                    {formatNumber(totalRequests)}
                  </h2>
                  <div className="flex items-end gap-1 h-8">
                    <div className="w-2 bg-blue-200 rounded-t-xs" style={{ height: "30%" }} />
                    <div className="w-2 bg-blue-300 rounded-t-xs" style={{ height: "50%" }} />
                    <div className="w-2 bg-blue-400 rounded-t-xs" style={{ height: "70%" }} />
                    <div className="w-2 bg-blue-500 rounded-t-xs" style={{ height: "100%" }} />
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5 mt-4 pt-3 border-t border-gray-100 text-xs">
                <span className="flex items-center font-semibold text-emerald-600">
                  <svg className="w-3.5 h-3.5 mr-0.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
                  </svg>
                  12%
                </span>
                <span className="text-gray-400">vs. previous 30 days</span>
              </div>
            </div>
          </Link>

          <Link
            href={`/dashboard/organizations/${encodeURIComponent(orgId)}/analytics/traces`}
            className="block"
          >
            <div className="bg-white border border-gray-200/80 rounded-2xl p-5 shadow-xs relative flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-gray-500">Success rate</span>
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="flex items-baseline justify-between">
                  <h2 className="text-2xl font-bold text-gray-900 tracking-tight">
                    {successRate}%
                  </h2>
                  <div className="h-8 w-16 flex items-center">
                    <svg className="w-full h-full overflow-visible" viewBox="0 0 60 30">
                      <path
                        d="M 0 25 L 10 20 L 20 22 L 30 15 L 40 18 L 50 8 L 60 5"
                        fill="none"
                        stroke="#22c55e"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5 mt-4 pt-3 border-t border-gray-100 text-xs">
                <span className="flex items-center font-semibold text-emerald-600">
                  <svg className="w-3.5 h-3.5 mr-0.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
                  </svg>
                  0.8%
                </span>
                <span className="text-gray-400">vs. previous 30 days</span>
              </div>
            </div>
          </Link>

          <Link
            href={`/dashboard/organizations/${encodeURIComponent(orgId)}/analytics/traces`}
            className="block"
          >
            <div className="bg-white border border-gray-200/80 rounded-2xl p-5 shadow-xs relative flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-gray-500">Avg. latency</span>
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="flex items-baseline justify-between">
                  <h2 className="text-2xl font-bold text-gray-900 tracking-tight">
                    {avgLatency}s
                  </h2>
                  <div className="h-8 w-16 flex items-center">
                    <svg className="w-full h-full overflow-visible" viewBox="0 0 60 30">
                      <path
                        d="M 0 10 L 10 15 L 20 22 L 30 12 L 40 20 L 50 18 L 60 5"
                        fill="none"
                        stroke="#a855f7"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5 mt-4 pt-3 border-t border-gray-100 text-xs">
                <span className="flex items-center font-semibold text-emerald-600">
                  <svg className="w-3.5 h-3.5 mr-0.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                  </svg>
                  18%
                </span>
                <span className="text-gray-400">vs. previous 30 days</span>
              </div>
            </div>
          </Link>

          <Link
            href={`/dashboard/organizations/${encodeURIComponent(orgId)}/analytics/usage`}
            className="block"
          >
            <div className="bg-white border border-gray-200/80 rounded-2xl p-5 shadow-xs relative flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-gray-500">Total cost</span>
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="flex items-baseline justify-between">
                  <h2 className="text-2xl font-bold text-gray-900 tracking-tight">
                    ${estCost.toFixed(2)}
                  </h2>
                  <div className="flex items-end gap-1 h-8">
                    <div className="w-2 bg-blue-100 rounded-t-xs" style={{ height: "25%" }} />
                    <div className="w-2 bg-blue-200 rounded-t-xs" style={{ height: "45%" }} />
                    <div className="w-2 bg-blue-300 rounded-t-xs" style={{ height: "65%" }} />
                    <div className="w-2 bg-blue-400 rounded-t-xs" style={{ height: "90%" }} />
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5 mt-4 pt-3 border-t border-gray-100 text-xs">
                <span className="flex items-center font-semibold text-emerald-600">
                  <svg className="w-3.5 h-3.5 mr-0.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
                  </svg>
                  6%
                </span>
                <span className="text-gray-400">vs. previous 30 days</span>
              </div>
            </div>
          </Link>
        </div>

        <hr className="border-gray-100" />

        {/* Main Charts Section */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-gray-900">Main charts</h3>

          <div className="bg-white border border-gray-200/80 rounded-2xl p-6 relative shadow-xs">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-base font-semibold text-gray-900 tracking-tight">
                  AI Request Activity
                </h3>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-400 font-medium">
                  Illustrative 7-day data
                </span>
                <div className="flex items-center gap-1 bg-gray-50 border border-gray-200/60 rounded-full p-1">
                  <button
                    type="button"
                    aria-label="Export"
                    className="p-1.5 text-gray-500 hover:text-gray-700 rounded-full hover:bg-white transition-colors cursor-pointer"
                  >
                    <svg
                      className="size-4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                      />
                    </svg>
                  </button>
                  <button
                    type="button"
                    aria-label="More options"
                    className="p-1.5 text-gray-500 hover:text-gray-700 rounded-full hover:bg-white transition-colors cursor-pointer"
                  >
                    <svg className="size-4" fill="currentColor" viewBox="0 0 24 24">
                      <circle cx="5" cy="12" r="1.5" />
                      <circle cx="12" cy="12" r="1.5" />
                      <circle cx="19" cy="12" r="1.5" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            {loading ? (
              <div className="h-72 flex items-center justify-center text-gray-400">
                <X className="size-8 animate-spin" />
              </div>
            ) : error ? (
              <div className="h-72 flex flex-col items-center justify-center text-gray-400">
                <X className="size-8 mb-2" />
                <p className="text-sm">{error}</p>
              </div>
            ) : (
              <div className="relative h-72 w-full pt-4 pb-2 group">
                <div className="absolute inset-0 flex flex-col justify-between text-xs text-gray-400 pointer-events-none pr-2">
                  {[4, 3, 2, 1, 0].map((k) => (
                    <div
                      key={k}
                      className="flex items-center justify-between border-b border-gray-100 pb-1"
                    >
                      <span>{k}K</span>
                    </div>
                  ))}
                </div>

                <div className="absolute inset-x-8 inset-y-6 grid grid-cols-7 z-10">
                  {DAYS.map((day, i) => (
                    <div
                      key={day}
                      className="relative group/col flex justify-center cursor-pointer"
                    >
                      <div
                        className="absolute inset-y-0 w-full group-hover/col:border-l group-hover/col:border-dashed group-hover/col:border-gray-300 group-hover/col:bg-gray-50/20"
                      />
                      <div
                        className="absolute left-3 bottom-full mb-2 hidden group-hover/col:block bg-white border border-gray-200/80 rounded-xl shadow-lg p-3.5 w-44 pointer-events-none z-30"
                      >
                        <div className="text-xs font-semibold text-gray-900 mb-2">
                          {day}
                        </div>
                        <div className="space-y-1.5 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="flex items-center gap-1.5 text-gray-600">
                              <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                              Successful
                            </span>
                            <span className="font-semibold text-gray-900">
                              {formatNumber(dayStats[i].successful)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="flex items-center gap-1.5 text-gray-600">
                              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                              Failed
                            </span>
                            <span className="font-semibold text-gray-900">
                              {formatNumber(dayStats[i].failed)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="absolute inset-x-8 inset-y-6 pointer-events-none z-20">
                  <svg
                    className="w-full h-full overflow-visible"
                    viewBox="0 0 700 240"
                    preserveAspectRatio="none"
                  >
                    <path
                      d={linePath(successfulPoints)}
                      fill="none"
                      stroke="#60a5fa"
                      strokeWidth={2.5}
                      strokeLinecap="round"
                      strokeLinejoin="miter"
                    />
                    <path
                      d={linePath(failedPoints)}
                      fill="none"
                      stroke="#4ade80"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="miter"
                    />
                    {successfulPoints.map((p, i) => (
                      <circle
                        key={`s-${i}`}
                        cx={p.x}
                        cy={p.y}
                        r={4}
                        fill="#60a5fa"
                        className="stroke-white stroke-2"
                      />
                    ))}
                    {failedPoints.map((p, i) => (
                      <circle
                        key={`f-${i}`}
                        cx={p.x}
                        cy={p.y}
                        r={3.5}
                        fill="#4ade80"
                        className="stroke-white stroke-2"
                      />
                    ))}
                  </svg>
                </div>

                <div className="grid grid-cols-7 text-xs text-gray-500 font-medium px-8 mt-2 text-center">
                  {DAYS.map((d) => (
                    <span key={d}>{d}</span>
                  ))}
                </div>

                <div className="flex items-center justify-center gap-6 mt-8 pt-4 border-t border-gray-100">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-400" />
                    <span className="text-xs font-medium text-gray-700">Successful</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                    <span className="text-xs font-medium text-gray-700">Failed</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Agent Performance Table */}
        <div className="mt-8">
          <h3 className="text-sm font-bold text-gray-900 mb-4">Top Agents</h3>
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
                {traces.length > 0 ? (
                  <tr className="hover:bg-gray-50/50 transition-colors">
                    <td className="py-4 flex items-center gap-3">
                      <span className="w-8 h-8 rounded-lg bg-gray-50 border border-gray-200/60 flex items-center justify-center text-gray-600">
                        <MessageCircle className="w-4 h-4" />
                      </span>
                      <span className="font-medium text-gray-900">Traced Agents</span>
                    </td>
                    <td className="py-4 text-right font-medium text-gray-700">
                      {formatNumber(totalRequests)}
                    </td>
                    <td className="py-4 text-right font-medium text-gray-700">
                      {successRate}%
                    </td>
                    <td className="py-4 text-right font-medium text-gray-700">
                      {avgLatency}s
                    </td>
                  </tr>
                ) : (
                  <tr>
                    <td className="py-8 text-center text-gray-400" colSpan={4}>
                      No trace data available for the selected period.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Failed Requests */}
        <div className="mt-8">
          <h3 className="text-sm font-bold text-gray-900 mb-4">Recent Failed Requests</h3>
          {failedRequests > 0 ? (
            <div className="space-y-3">
              {traces
                .filter((t) => t.status !== "success")
                .slice(0, 5)
                .map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between p-4 bg-white hover:bg-gray-50/60 border border-gray-200/80 rounded-xl transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3.5">
                      <span className="text-rose-500 flex-shrink-0">
                        <X className="w-5 h-5" />
                      </span>
                      <div>
                        <h3 className="text-sm font-semibold text-gray-900 tracking-tight">
                          {t.agent_id}
                        </h3>
                        <p className="text-xs text-gray-400 font-mono mt-0.5">
                          {t.id}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-xs font-medium text-gray-900">
                          {(t.latency_ms / 1000).toFixed(2)}s
                        </p>
                        <p className="text-xs font-medium text-rose-600 mt-0.5">
                          Failed
                        </p>
                      </div>
                      <svg
                        className="w-4 h-4 text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
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
