import { asArray, backendGet, type Trace } from "@/lib/api";
import { authorizedOrganization } from "@/lib/workspace";

async function fetchTraces(orgId: string): Promise<Trace[]> {
  const d = await backendGet<unknown>(
    `/api/v1/organizations/${encodeURIComponent(orgId)}/analytics/traces`);
  return asArray<Trace>(d);
}

function agentStats(traces: Trace[]) {
  const byAgent = new Map<string, Trace[]>();
  traces.forEach((t) => {
    const arr = byAgent.get(t.agent_id) ?? [];
    arr.push(t);
    byAgent.set(t.agent_id, arr);
  });
  return Array.from(byAgent.entries()).map(([agentId, agentTraces]) => {
    const total = agentTraces.length;
    const successful = agentTraces.filter((t) => t.status === "success").length;
    const successRate = total > 0 ? Math.round((successful / total) * 100) : 0;
    const avgLatencyMs =
      total > 0
        ? Math.round(
            agentTraces.reduce((sum, t) => sum + t.latency_ms, 0) / total
          )
        : 0;
    return {
      agentId,
      name: agentId,
      total,
      successful,
      successRate,
      avgLatencyMs,
      avgLatency: (avgLatencyMs / 1000).toFixed(2),
    };
  });
}

export default async function AgentsPage({
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
  const agents = agentStats(traces);

  return (
    <div className="bg-gray-50 text-gray-900 min-h-screen p-6">
      <div className="space-y-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-base font-semibold text-gray-900 tracking-tight">
              Agent Performance
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Compare reliability, latency, and usage.
            </p>
          </div>
          <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-xl transition-colors cursor-pointer border border-gray-200/60" aria-label="Filter options">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707v3.172a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586a1 1 0 00-.293-.707L.293 7.293A1 1 0 010 6.586V4z" />
            </svg>
          </button>
        </div>

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
                agents.map((a) => (
                  <tr key={a.agentId} className="hover:bg-gray-50/50 transition-colors">
                    <td className="py-4 flex items-center gap-3">
                      <span className="w-8 h-8 rounded-lg bg-gray-50 border border-gray-200/60 flex items-center justify-center text-gray-600">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                        </svg>
                      </span>
                      <span className="font-medium text-gray-900">{a.name}</span>
                    </td>
                    <td className="py-4 text-right font-medium text-gray-700">{a.total}</td>
                    <td className="py-4 text-right font-medium text-gray-700">{a.successRate}%</td>
                    <td className="py-4 text-right font-medium text-gray-700">{a.avgLatency}s</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="py-8 text-center text-gray-400" colSpan={4}>
                    No agent data available for the selected period.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-6 pt-4 border-t border-gray-100">
          <p className="text-xs text-gray-400">
            Example agent records and metrics for design purposes.
          </p>
        </div>
      </div>
    </div>
  );
}


