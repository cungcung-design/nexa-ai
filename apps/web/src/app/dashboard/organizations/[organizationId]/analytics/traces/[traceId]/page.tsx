import Link from "next/link";

import { asArray, backendGet, type SpanResponse, type Trace } from "@/lib/api";
import { formatTimestamp } from "@/lib/format-time";
import { authorizedOrganization } from "@/lib/workspace";

export const instant = false;

async function fetchTrace(orgId: string, traceId: string): Promise<Trace | null> {
  return backendGet<Trace>(
    `/api/v1/organizations/${encodeURIComponent(orgId)}/analytics/traces/${encodeURIComponent(traceId)}`,
    { revalidate: 0 }
  );
}

async function fetchTraceSpans(orgId: string, traceId: string) {
  const data = await backendGet<unknown>(
    `/api/v1/organizations/${encodeURIComponent(orgId)}/analytics/traces/${encodeURIComponent(traceId)}/spans`,
    { revalidate: 0 }
  );
  return asArray<SpanResponse>(data);
}

function valueOrUnavailable(value: string | number | null | undefined): string {
  if (typeof value === "number") return String(value);
  if (typeof value === "string" && value.trim()) return value.trim();
  return "Unavailable";
}

export default async function TraceDetailPage({
  params,
}: {
  params: Promise<{ organizationId: string; traceId: string }>;
}) {
  const { organizationId, traceId } = await params;
  const org = await authorizedOrganization(organizationId);
  if (!org) return null;

  const [trace, spans] = await Promise.all([
    fetchTrace(org.id, traceId),
    fetchTraceSpans(org.id, traceId),
  ]);

  if (!trace) {
    return (
      <div className="bg-gray-50 text-gray-900 min-h-screen p-6">
        <div className="bg-white border border-gray-200/80 rounded-2xl p-12 shadow-xs text-center">
          <h2 className="text-base font-semibold text-gray-900 mb-2">Trace not found</h2>
          <p className="text-xs text-gray-500">
            This trace is not available in the current workspace.
          </p>
        </div>
      </div>
    );
  }

  const total =
    typeof trace.total_tokens === "number"
      ? trace.total_tokens
      : trace.prompt_tokens + trace.completion_tokens;
  const knowledge = spans.flatMap((span) => span.detail?.sources ?? []);
  const tools = spans.flatMap((span) =>
    span.detail?.tool_name ? [span.detail.tool_name] : []
  );

  return (
    <div className="bg-gray-50 text-gray-900 min-h-screen p-4 sm:p-6">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-6 border-b border-gray-100">
          <div>
            <h2 className="text-base font-semibold text-gray-900 tracking-tight break-all">
              Trace {trace.id}
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              Recorded {formatTimestamp(trace.created_at)}
            </p>
          </div>
          <span
            className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${
              trace.status === "success"
                ? "bg-emerald-50 text-emerald-700 border-emerald-200/60"
                : "bg-rose-50 text-rose-700 border-rose-200/60"
            }`}
          >
            {trace.status}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            ["Agent", valueOrUnavailable(trace.agent_name)],
            ["Model", valueOrUnavailable(trace.model)],
            [
              "Published version",
              trace.version_number ? `Version ${trace.version_number}` : "Unavailable",
            ],
            ["Duration", `${(trace.latency_ms / 1000).toFixed(2)}s`],
          ].map(([label, value]) => (
            <div key={label} className="bg-white border border-gray-200/80 rounded-2xl p-4 shadow-xs">
              <p className="text-xs text-gray-500 font-medium mb-1">{label}</p>
              <p className="text-sm font-medium text-gray-900 break-words">{value}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            ["Prompt tokens", valueOrUnavailable(trace.prompt_tokens)],
            ["Completion tokens", valueOrUnavailable(trace.completion_tokens)],
            ["Total tokens", String(total)],
          ].map(([label, value]) => (
            <div key={label} className="bg-white border border-gray-200/80 rounded-2xl p-4 shadow-xs">
              <p className="text-xs text-gray-500 font-medium mb-1">{label}</p>
              <p className="text-sm font-medium text-gray-900">{value}</p>
            </div>
          ))}
        </div>

        {trace.error_code ? (
          <div className="bg-white border border-rose-200 rounded-2xl p-4">
            <h3 className="text-sm font-semibold text-gray-900">Error</h3>
            <p className="text-sm text-rose-700 mt-1">{trace.error_code}</p>
          </div>
        ) : null}

        <div className="bg-white border border-gray-200/80 rounded-2xl p-6 shadow-xs">
          <h3 className="text-sm font-semibold text-gray-900 mb-6">Execution timeline</h3>
          {spans.length > 0 ? (
            <ol className="space-y-5">
              {spans.map((span, index) => (
                <li key={span.id} className="relative pl-6">
                  <span className="absolute left-0 text-xs font-semibold text-gray-400">
                    {index + 1}
                  </span>
                  <h3 className="text-sm font-semibold text-gray-900">{span.name}</h3>
                  <p className="text-xs text-gray-500 mt-1">
                    {span.duration_ms}ms · {span.status}
                    {span.detail?.model ? ` · ${span.detail.model}` : ""}
                    {span.detail?.tool_name ? ` · ${span.detail.tool_name}` : ""}
                  </p>
                  {span.error_code ? (
                    <p className="text-xs text-rose-600 mt-1">{span.error_code}</p>
                  ) : null}
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-gray-500">No execution spans were recorded.</p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white border border-gray-200/80 rounded-2xl p-6 shadow-xs">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Tool calls</h3>
            {tools.length > 0 ? (
              <ul className="text-sm text-gray-700 space-y-1">
                {tools.map((tool) => (
                  <li key={tool}>{tool}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500">No tool calls were recorded.</p>
            )}
          </div>
          <div className="bg-white border border-gray-200/80 rounded-2xl p-6 shadow-xs">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Retrieved knowledge</h3>
            {knowledge.length > 0 ? (
              <ul className="text-sm text-gray-700 space-y-1">
                {knowledge.map((source) => (
                  <li key={`${source.document_id ?? ""}-${source.filename}`}>
                    {source.filename}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500">No knowledge sources were recorded.</p>
            )}
          </div>
        </div>

        <Link
          href={`/dashboard/organizations/${org.id}/analytics/agents/${trace.agent_id}`}
          className="inline-flex text-sm text-gray-600 hover:text-blue-600"
        >
          Agent analytics
        </Link>
      </div>
    </div>
  );
}
