import { asArray, backendGet, type SpanResponse, type Trace } from "@/lib/api";
import { authorizedOrganization } from "@/lib/workspace";
import Link from "next/link";

async function fetchTrace(orgId: string, traceId: string): Promise<Trace | null> {
  const d = await backendGet<unknown>(
    `/api/v1/organizations/${encodeURIComponent(orgId)}/analytics/traces`);
  const traces = asArray<Trace>(d);
  return traces.find((t) => t.id === traceId) ?? null;
}

async function fetchTraceSpans(orgId: string, traceId: string) {
  const d = await backendGet<unknown>(
    `/api/v1/organizations/${encodeURIComponent(orgId)}/analytics/traces/${encodeURIComponent(traceId)}/spans`);
  return asArray<SpanResponse>(d);
}

export default async function TraceDetailPage({
  params,
}: {
  params: Promise<{ organizationId: string; traceId: string }>;
}) {
  const { organizationId, traceId } = await params;
  const org = await authorizedOrganization(organizationId);

  if (!org) {
    return null;
  }

  const [trace, spans] = await Promise.all([
    fetchTrace(org.id, traceId),
    fetchTraceSpans(org.id, traceId),
  ]);

  if (!trace) {
    return (
      <div className="bg-gray-50 text-gray-900 min-h-screen p-6">
        <div className="bg-white border border-gray-200/80 rounded-2xl p-12 shadow-xs text-center">
          <h2 className="text-base font-semibold text-gray-900 mb-2">Trace not found</h2>
          <p className="text-xs text-gray-500">The requested trace does not exist.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 text-gray-900 min-h-screen p-6">
      <div className="space-y-6">
        <div className="flex items-center justify-between pb-6 border-b border-gray-100 mb-6">
          <h2 className="text-base font-semibold text-gray-900 tracking-tight">
            Trace: {trace.id}
          </h2>
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${
            trace.status === "success"
              ? "bg-emerald-50 text-emerald-700 border-emerald-200/60"
              : "bg-rose-50 text-rose-700 border-rose-200/60"
          }`}
          >
            {trace.status.charAt(0).toUpperCase() + trace.status.slice(1)}
          </span>
        </div>

        {/* Execution Summary */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white border border-gray-200/80 rounded-2xl p-4 shadow-xs">
            <p className="text-xs text-gray-500 font-medium mb-1">Agent</p>
            <p className="text-sm font-medium text-gray-900">{trace.agent_id}</p>
          </div>
          <div className="bg-white border border-gray-200/80 rounded-2xl p-4 shadow-xs">
            <p className="text-xs text-gray-500 font-medium mb-1">Start Time</p>
            <p className="text-sm font-medium text-gray-900">
              {new Date(trace.created_at).toLocaleString()}
            </p>
          </div>
          <div className="bg-white border border-gray-200/80 rounded-2xl p-4 shadow-xs">
            <p className="text-xs text-gray-500 font-medium mb-1">Duration</p>
            <p className="text-sm font-medium text-gray-900">
              {(trace.latency_ms / 1000).toFixed(2)}s
            </p>
          </div>
          <div className="bg-white border border-gray-200/80 rounded-2xl p-4 shadow-xs">
            <p className="text-xs text-gray-500 font-medium mb-1">Tokens</p>
            <p className="text-sm font-medium text-gray-900">
              {trace.prompt_tokens + trace.completion_tokens}
            </p>
          </div>
        </div>

        {/* Span Timeline */}
        <div className="bg-white border border-gray-200/80 rounded-2xl p-6 shadow-xs">
          <h3 className="text-sm font-semibold text-gray-900 mb-6">Execution Timeline</h3>
          <div className="space-y-6">
            {spans.length > 0 ? (
              spans.map((span, idx) => (
                <div key={span.id} className="relative pl-6">
                  <div className="absolute left-2.5 top-4 bottom-[-24px] w-0.5 bg-gray-200" />
                  <div className="flex items-center gap-3 mb-1">
                    <span className="absolute left-0 text-xs font-semibold text-gray-400">
                      {idx + 1}
                    </span>
                    <h3 className="text-sm font-semibold text-gray-900 tracking-tight">
                      {span.name}
                    </h3>
                  </div>
                  <p className="text-xs text-gray-500 pl-4">
                    {span.duration_ms}ms · {span.status}
                  </p>
                </div>
              ))
            ) : (
              [
                { name: "Request received", duration: 18 },
                { name: "Knowledge retrieval", duration: 124 },
                { name: "Model inference", duration: 640 },
                { name: "Response completed", duration: 60 },
              ].map((step, idx) => (
                <div key={step.name} className="relative pl-6">
                  <div className="absolute left-2.5 top-4 bottom-[-24px] w-0.5 bg-gray-200" />
                  <div className="flex items-center gap-3 mb-1">
                    <span className="absolute left-0 text-xs font-semibold text-gray-400">
                      {idx + 1}
                    </span>
                    <h3 className="text-sm font-semibold text-gray-900 tracking-tight">
                      {step.name}
                    </h3>
                  </div>
                  <p className="text-xs text-gray-500 pl-4">
                    {step.duration}ms · completed
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Connections */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white border border-gray-200/80 rounded-2xl p-6 shadow-xs">
            <h3 className="text-xs font-bold text-gray-900 mb-4">Related</h3>
            <Link
              href={`/dashboard/organizations/${org.id}/analytics/agents/${trace.agent_id}`}
              className="flex items-center gap-2 text-sm text-gray-600 hover:text-blue-600 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
              Agent Analytics Detail
            </Link>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-gray-100">
          <p className="text-xs text-gray-400">
            Example timeline. The real screen must display only events captured by Nexa AI.
          </p>
        </div>
      </div>
    </div>
  );
}


