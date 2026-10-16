import { asArray, backendGet, type Trace } from "@/lib/api";
import { authorizedOrganization } from "@/lib/workspace";
import Link from "next/link";

async function fetchTraces(orgId: string): Promise<Trace[]> {
  const d = await backendGet<unknown>(
    `/api/v1/organizations/${encodeURIComponent(orgId)}/analytics/traces`);
  return asArray<Trace>(d);
}

export default async function AgentDetailPage({
  params,
}: {
  params: Promise<{ organizationId: string; agentId: string }>;
}) {
  const { organizationId, agentId } = await params;
  const org = await authorizedOrganization(organizationId);

  if (!org) {
    return null;
  }

  const traces = await fetchTraces(org.id);
  const agentTraces = traces.filter((t) => t.agent_id === agentId);

  const total = agentTraces.length;
  const successful = agentTraces.filter((t) => t.status === "success").length;
  const failed = total - successful;
  const successRate = total > 0 ? Math.round((successful / total) * 100) : 0;
  const avgLatencyMs =
    total > 0
      ? Math.round(
          agentTraces.reduce((sum, t) => sum + t.latency_ms, 0) / total
        )
      : 0;
  const tokenUsage = agentTraces.reduce(
    (sum, t) => sum + t.prompt_tokens + t.completion_tokens,
    0
  );
  const estCost = (tokenUsage / 1000) * 0.002;

  return (
    <div className="bg-gray-50 text-gray-900 min-h-screen p-6">
      <div className="space-y-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-base font-semibold text-gray-900 tracking-tight">
              Agent Analytics
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Request history, latency trends, error breakdown, and evaluations.
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href={`/dashboard/organizations/${org.id}/agents`}
              className="flex items-center gap-2 px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white text-xs font-medium rounded-xl transition-colors cursor-pointer shadow-sm"
            >
              <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                <path d="M3 12h18M3 12l4-4M3 12l4 4M21 12l-4-4M21 12l-4 4" />
              </svg>
              <span className="hidden sm:inline">Open Agent Studio</span>
            </Link>
            <button className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium rounded-xl transition-colors cursor-pointer">
              <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
              <span className="hidden sm:inline">Test in Playground</span>
            </button>
          </div>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white border border-gray-200/80 rounded-2xl p-6 shadow-xs">
            <p className="text-xs text-gray-400 font-medium mb-1">Total Requests</p>
            <p className="text-2xl font-bold text-gray-900 tracking-tight">{total}</p>
          </div>
          <div className="bg-white border border-gray-200/80 rounded-2xl p-6 shadow-xs">
            <p className="text-xs text-gray-400 font-medium mb-1">Success Rate</p>
            <p className="text-2xl font-bold text-gray-900 tracking-tight">{successRate}%</p>
          </div>
          <div className="bg-white border border-gray-200/80 rounded-2xl p-6 shadow-xs">
            <p className="text-xs text-gray-400 font-medium mb-1">Avg. Latency</p>
            <p className="text-2xl font-bold text-gray-900 tracking-tight">
              {(avgLatencyMs / 1000).toFixed(2)}s
            </p>
          </div>
          <div className="bg-white border border-gray-200/80 rounded-2xl p-6 shadow-xs">
            <p className="text-xs text-gray-400 font-medium mb-1">Token Usage</p>
            <p className="text-2xl font-bold text-gray-900 tracking-tight">{tokenUsage}</p>
          </div>
          <div className="bg-white border border-gray-200/80 rounded-2xl p-6 shadow-xs">
            <p className="text-xs text-gray-400 font-medium mb-1">Est. Cost</p>
            <p className="text-2xl font-bold text-gray-900 tracking-tight">${estCost.toFixed(2)}</p>
          </div>
          <div className="bg-white border border-gray-200/80 rounded-2xl p-6 shadow-xs">
            <p className="text-xs text-gray-400 font-medium mb-1">Failed</p>
            <p className="text-2xl font-bold text-gray-900 tracking-tight">{failed}</p>
          </div>
        </div>

        {/* Recent Traces */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-100 text-xs font-medium text-gray-400">
                <th className="py-3 font-medium">Trace ID</th>
                <th className="py-3 font-medium text-right">Status</th>
                <th className="py-3 font-medium text-right">Latency</th>
                <th className="py-3 font-medium text-right">Tokens</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 text-sm">
              {agentTraces.length > 0 ? (
                agentTraces.slice(0, 10).map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50/50 transition-colors cursor-pointer">
                    <td className="py-4 font-mono text-xs text-gray-700">{t.id}</td>
                    <td className="py-4 text-right">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${
                        t.status === "success"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200/60"
                          : "bg-rose-50 text-rose-700 border-rose-200/60"
                      }`}
                      >
                        {t.status === "success" ? "Success" : "Failed"}
                      </span>
                    </td>
                    <td className="py-4 text-right font-medium text-gray-700">
                      {(t.latency_ms / 1000).toFixed(2)}s
                    </td>
                    <td className="py-4 text-right font-medium text-gray-700">
                      {t.prompt_tokens + t.completion_tokens}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="py-8 text-center text-gray-400" colSpan={4}>
                    No traces for this agent.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}


