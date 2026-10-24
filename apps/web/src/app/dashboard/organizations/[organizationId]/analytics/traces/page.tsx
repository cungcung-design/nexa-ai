import Link from "next/link";

import { asArray, backendGet, type Trace } from "@/lib/api";
import { formatTimestamp } from "@/lib/format-time";
import { authorizedOrganization } from "@/lib/workspace";

export const instant = false;

function one(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function readDays(value: string): number {
  if (value === "30") return 30;
  if (value === "0") return 0;
  return 7;
}

async function fetchTraces(
  orgId: string,
  days: number,
  status: string
): Promise<Trace[]> {
  const params = new URLSearchParams();
  params.set("days", String(days));
  if (status) params.set("status", status);
  const data = await backendGet<unknown>(
    `/api/v1/organizations/${encodeURIComponent(orgId)}/analytics/traces?${params.toString()}`,
    { revalidate: 0 }
  );
  return asArray<Trace>(data);
}

function tokenText(value: number | null | undefined): string {
  return typeof value === "number" ? String(value) : "Unavailable";
}

export default async function TracesPage({
  params,
  searchParams,
}: {
  params: Promise<{ organizationId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { organizationId } = await params;
  const query = await searchParams;
  const org = await authorizedOrganization(organizationId);
  if (!org) return null;

  const days = readDays(one(query.days));
  const status = one(query.status);
  const traces = await fetchTraces(org.id, days, status);
  const base = `/dashboard/organizations/${org.id}/analytics/traces`;

  return (
    <div className="bg-gray-50 text-gray-900 min-h-screen p-4 sm:p-6">
      <div className="space-y-6">
        <div>
          <h2 className="text-base font-semibold text-gray-900 tracking-tight">
            Execution Traces
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Persisted AI requests for this workspace.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-gray-700">
          {[
            ["7", "Last 7 days"],
            ["30", "Last 30 days"],
            ["0", "All recorded"],
          ].map(([value, label]) => (
            <Link
              key={value}
              href={`${base}?days=${value}${status ? `&status=${status}` : ""}`}
              className={`px-3 py-1.5 rounded-full border ${
                String(days) === value
                  ? "bg-white border-gray-900 text-gray-900"
                  : "bg-gray-100 border-gray-200/60"
              }`}
              aria-current={String(days) === value ? "page" : undefined}
            >
              {label}
            </Link>
          ))}
          {[
            ["", "All statuses"],
            ["success", "Successful"],
            ["error", "Failed"],
          ].map(([value, label]) => (
            <Link
              key={label}
              href={`${base}?days=${days}${value ? `&status=${value}` : ""}`}
              className={`px-3 py-1.5 rounded-full border ${
                status === value
                  ? "bg-white border-gray-900 text-gray-900"
                  : "bg-gray-100 border-gray-200/60"
              }`}
            >
              {label}
            </Link>
          ))}
        </div>

        <div className="space-y-3">
          {traces.length > 0 ? (
            traces.map((trace) => {
              const total =
                typeof trace.total_tokens === "number"
                  ? trace.total_tokens
                  : trace.prompt_tokens + trace.completion_tokens;
              return (
                <Link
                  key={trace.id}
                  href={`${base}/${trace.id}`}
                  className="block bg-white hover:bg-gray-50/60 border border-gray-200/80 rounded-xl p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-gray-900">
                        {trace.agent_name?.trim() || "Unavailable"}
                      </h3>
                      <p className="text-xs text-gray-400 font-mono mt-0.5 break-all">
                        {trace.id}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {trace.model?.trim() || "Model unavailable"} · {trace.status}
                      </p>
                    </div>
                    <div className="text-xs text-gray-600 text-left sm:text-right">
                      <p>{formatTimestamp(trace.created_at)}</p>
                      <p className="mt-0.5">{(trace.latency_ms / 1000).toFixed(2)}s</p>
                      <p className="mt-0.5">
                        Prompt {tokenText(trace.prompt_tokens)} · Completion{" "}
                        {tokenText(trace.completion_tokens)} · Total {total}
                      </p>
                      {trace.error_code ? (
                        <p className="mt-0.5 text-rose-600">{trace.error_code}</p>
                      ) : null}
                    </div>
                  </div>
                </Link>
              );
            })
          ) : (
            <div className="p-8 text-center text-gray-400 bg-white rounded-xl border border-gray-100">
              No traces available for the selected period.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
