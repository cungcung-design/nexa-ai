import { asArray, backendGet, type Trace } from "@/lib/api";
import { authorizedOrganization } from "@/lib/workspace";
import Link from "next/link";

async function fetchTraces(orgId: string): Promise<Trace[]> {
  const d = await backendGet<unknown>(
    `/api/v1/organizations/${encodeURIComponent(orgId)}/analytics/traces`);
  return asArray<Trace>(d);
}

function statusColor(status: string) {
  if (status === "success")
    return "bg-emerald-50 text-emerald-700 border-emerald-200/60";
  if (status === "failed" || status === "error")
    return "bg-rose-50 text-rose-700 border-rose-200/60";
  return "bg-amber-50 text-amber-700 border-amber-200/60";
}

export default async function TracesPage({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;
  const org = await authorizedOrganization(organizationId);

  if (!org) {
    return null;
  }

  const traces = await fetchTraces(org.id);

  return (
    <div className="bg-gray-50 text-gray-900 min-h-screen p-6">
      <div className="space-y-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900 tracking-tight">
              Execution Traces
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Investigate requests, failures, and AI behavior.
            </p>
          </div>
          <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-xl transition-colors cursor-pointer border border-gray-200/60" aria-label="Search traces">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2 mb-6 text-xs font-medium text-gray-700">
          <button className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200/70 rounded-full transition-colors cursor-pointer border border-gray-200/60">
            All statuses
            <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          <button className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200/70 rounded-full transition-colors cursor-pointer border border-gray-200/60">
            All agents
            <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          <button className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200/70 rounded-full transition-colors cursor-pointer border border-gray-200/60">
            Last 7 days
            <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>

        {/* Trace List */}
        <div className="space-y-3">
          {traces.length > 0 ? (
            traces.map((t) => (
              <Link
                key={t.id}
                href={`/dashboard/organizations/${org.id}/analytics/traces/${t.id}`}
                className="block"
              >
                <div className="flex items-center justify-between p-4 bg-white hover:bg-gray-50/60 border border-gray-200/80 rounded-xl transition-colors cursor-pointer">
                  <div className="flex items-center gap-3.5">
                    <span className={statusColor(t.status) + " flex-shrink-0 p-1.5 rounded-lg"}>
                      {t.status === "success" ? (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                      )}
                    </span>
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900 tracking-tight">
                        {t.agent_id}
                      </h3>
                      <p className="text-xs text-gray-400 font-mono mt-0.5">{t.id}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-xs font-medium text-gray-900">
                        {(t.latency_ms / 1000).toFixed(2)}s
                      </p>
                      <p className="text-xs font-medium text-gray-600 mt-0.5">
                        {t.prompt_tokens + t.completion_tokens} tokens
                      </p>
                    </div>
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </Link>
            ))
          ) : (
            <div className="p-8 text-center text-gray-400 bg-gray-50/50 rounded-xl border border-gray-100">
              No traces available for the selected period.
            </div>
          )}
        </div>

        <div className="mt-6 pt-4 border-t border-gray-100">
          <p className="text-xs text-gray-400">Illustrative trace records.</p>
        </div>
      </div>
    </div>
  );
}


