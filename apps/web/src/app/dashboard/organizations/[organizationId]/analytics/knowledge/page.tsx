import { asArray, backendGet, type Trace } from "@/lib/api";
import { authorizedOrganization } from "@/lib/workspace";

async function fetchTraces(orgId: string): Promise<Trace[]> {
  const d = await backendGet<unknown>(
    `/api/v1/organizations/${encodeURIComponent(orgId)}/analytics/traces`);
  return asArray<Trace>(d);
}

export default async function KnowledgePage({
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
  const retrievalRequests = traces.length;
  const noResultQueries = traces.filter((t) => t.status !== "success").length;
  const avgRetrievalTimeMs =
    retrievalRequests > 0
      ? Math.round(
          traces.reduce((sum, t) => sum + t.latency_ms, 0) / retrievalRequests
        )
      : 0;

  return (
    <div className="bg-gray-50 text-gray-900 min-h-screen p-6">
      <div className="space-y-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-base font-semibold text-gray-900 tracking-tight">
              Knowledge Retrieval Performance
            </h2>
          </div>
        </div>

        {/* Metrics 2x2 Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-12 mb-6">
          <div className="flex items-start justify-between p-4 bg-gray-50/50 border border-gray-100 rounded-xl">
            <div>
              <p className="text-xs text-gray-500 font-medium mb-1">Retrieval Requests</p>
              <p className="text-2xl font-bold text-gray-900 tracking-tight">{retrievalRequests}</p>
            </div>
            <span className="text-gray-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
          </div>

          <div className="flex items-start justify-between p-4 bg-gray-50/50 border border-gray-100 rounded-xl">
            <div>
              <p className="text-xs text-gray-500 font-medium mb-1">Avg. Retrieval Time</p>
              <p className="text-2xl font-bold text-gray-900 tracking-tight">
                {(avgRetrievalTimeMs / 1000).toFixed(2)}s
              </p>
            </div>
            <span className="text-gray-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </span>
          </div>

          <div className="flex items-start justify-between p-4 bg-gray-50/50 border border-gray-100 rounded-xl">
            <div>
              <p className="text-xs text-gray-500 font-medium mb-1">No-result Queries</p>
              <p className="text-2xl font-bold text-gray-900 tracking-tight">{noResultQueries}</p>
            </div>
            <span className="text-gray-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </span>
          </div>

          <div className="flex items-start justify-between p-4 bg-gray-50/50 border border-gray-100 rounded-xl">
            <div>
              <p className="text-xs text-gray-500 font-medium mb-1">Documents Used</p>
              <p className="text-2xl font-bold text-gray-900 tracking-tight">
                {new Set(traces.map((t) => t.agent_id)).size}
              </p>
            </div>
            <span className="text-gray-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
              </svg>
            </span>
          </div>
        </div>

        {/* Knowledge Documents */}
        <div className="bg-white border border-gray-200/80 rounded-2xl p-6 shadow-xs mb-8">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Frequently Retrieved Documents</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-100 text-xs font-medium text-gray-400">
                  <th className="py-3 font-medium">Document</th>
                  <th className="py-3 font-medium text-right">Retrievals</th>
                  <th className="py-3 font-medium text-right">Avg. Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 text-sm">
                <tr className="hover:bg-gray-50/50 transition-colors cursor-pointer">
                  <td className="py-4 font-medium text-gray-900">Knowledge Base Article</td>
                  <td className="py-4 text-right font-medium text-gray-700">1,240</td>
                  <td className="py-4 text-right font-medium text-gray-700">0.92</td>
                </tr>
                <tr className="hover:bg-gray-50/50 transition-colors cursor-pointer">
                  <td className="py-4 font-medium text-gray-900">API Documentation</td>
                  <td className="py-4 text-right font-medium text-gray-700">890</td>
                  <td className="py-4 text-right font-medium text-gray-700">0.87</td>
                </tr>
                <tr className="hover:bg-gray-50/50 transition-colors cursor-pointer">
                  <td className="py-4 font-medium text-gray-900">FAQ Sheet</td>
                  <td className="py-4 text-right font-medium text-gray-700">650</td>
                  <td className="py-4 text-right font-medium text-gray-700">0.91</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Retrieval Latency Trend */}
        <div className="bg-white border border-gray-200/80 rounded-2xl p-6 shadow-xs mb-8">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Retrieval Latency Trends</h3>
          <div className="relative h-64 w-full">
            <div className="absolute inset-0 flex flex-col justify-between text-xs text-gray-400 pointer-events-none pr-2">
              {[4, 3, 2, 1, 0].map((k) => (
                <div key={k} className="flex items-center justify-between border-b border-gray-100 pb-1">
                  <span>{k}K</span>
                </div>
              ))}
            </div>
            <div className="absolute inset-x-8 inset-y-6 grid grid-cols-7 items-end gap-2 z-10">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day, i) => (
                <div key={day} className="flex flex-col items-center gap-1 h-full">
                  <div className="w-6 bg-blue-400 rounded-t-sm" style={{ height: `${35 + i * 9}%` }} />
                  <span className="text-[10px] text-gray-500">{day}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-gray-100">
          <p className="text-xs text-gray-400">
            Example values; requires retrieval instrumentation in the actual backend.
          </p>
        </div>
      </div>
    </div>
  );
}


