import { asArray, backendGet, type Trace } from "@/lib/api";
import { authorizedOrganization } from "@/lib/workspace";

async function fetchTraces(orgId: string): Promise<Trace[]> {
  const d = await backendGet<unknown>(
    `/api/v1/organizations/${encodeURIComponent(orgId)}/analytics/traces`);
  return asArray<Trace>(d);
}

export default async function WorkflowsPage({
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
  const totalRuns = traces.length;
  const completed = traces.filter((t) => t.status === "success").length;
  const failed = traces.filter((t) => t.status !== "success").length;
  const completionRate = totalRuns > 0 ? Math.round((completed / totalRuns) * 100) : 0;
  const failureRate = totalRuns > 0 ? Math.round((failed / totalRuns) * 100) : 0;
  const avgDurationMs =
    totalRuns > 0
      ? Math.round(
          traces.reduce((sum, t) => sum + t.latency_ms, 0) / totalRuns
        )
      : 0;

  // Group by agent as workflow proxy
  const byAgent = new Map<string, { runs: number; success: number }>();
  traces.forEach((t) => {
    const cur = byAgent.get(t.agent_id) ?? { runs: 0, success: 0 };
    cur.runs += 1;
    if (t.status === "success") cur.success += 1;
    byAgent.set(t.agent_id, cur);
  });

  return (
    <div className="bg-gray-50 text-gray-900 min-h-screen p-6">
      <div className="space-y-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-base font-semibold text-gray-900 tracking-tight">
              Workflow Analytics
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Monitor workflow executions, completion rates, and human reviews.
            </p>
          </div>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white border border-gray-200/80 rounded-2xl p-6 shadow-xs">
            <p className="text-xs text-gray-400 font-medium mb-1">Workflow executions</p>
            <p className="text-2xl font-bold text-gray-900 tracking-tight">{totalRuns}</p>
          </div>
          <div className="bg-white border border-gray-200/80 rounded-2xl p-6 shadow-xs">
            <p className="text-xs text-gray-400 font-medium mb-1">Completion rate</p>
            <p className="text-2xl font-bold text-gray-900 tracking-tight">{completionRate}%</p>
          </div>
          <div className="bg-white border border-gray-200/80 rounded-2xl p-6 shadow-xs">
            <p className="text-xs text-gray-400 font-medium mb-1">Failure rate</p>
            <p className="text-2xl font-bold text-gray-900 tracking-tight">{failureRate}%</p>
          </div>
          <div className="bg-white border border-gray-200/80 rounded-2xl p-6 shadow-xs">
            <p className="text-xs text-gray-400 font-medium mb-1">Average duration</p>
            <p className="text-2xl font-bold text-gray-900 tracking-tight">
              {(avgDurationMs / 1000).toFixed(2)}s
            </p>
          </div>
          <div className="bg-white border border-gray-200/80 rounded-2xl p-6 shadow-xs">
            <p className="text-xs text-gray-400 font-medium mb-1">Human review rate</p>
            <p className="text-2xl font-bold text-gray-900 tracking-tight">0%</p>
          </div>
        </div>

        {/* Workflow Ranking */}
        <div className="bg-white border border-gray-200/80 rounded-2xl p-6 shadow-xs mb-8">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Workflow Ranking</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-100 text-xs font-medium text-gray-400">
                  <th className="py-3 font-medium">Workflow / Agent</th>
                  <th className="py-3 font-medium text-right">Runs</th>
                  <th className="py-3 font-medium text-right">Success Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 text-sm">
                {Array.from(byAgent.entries()).length > 0 ? (
                  Array.from(byAgent.entries()).map(([agentId, data]) => {
                    const rate = data.runs > 0 ? Math.round((data.success / data.runs) * 100) : 0;
                    return (
                      <tr
                        key={agentId}
                        className="hover:bg-gray-50/50 transition-colors cursor-pointer"
                      >
                        <td className="py-4 font-medium text-gray-900">{agentId}</td>
                        <td className="py-4 text-right font-medium text-gray-700">{data.runs}</td>
                        <td className="py-4 text-right font-medium text-gray-700">{rate}%</td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td className="py-8 text-center text-gray-400" colSpan={3}>
                      No workflow data available.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Execution Trends */}
        <div className="bg-white border border-gray-200/80 rounded-2xl p-6 shadow-xs mb-8">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Execution Trends</h3>
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
                  <div className="w-6 bg-blue-400 rounded-t-sm" style={{ height: `${40 + i * 8}%` }} />
                  <span className="text-[10px] text-gray-500">{day}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-center gap-6 mt-4 pt-4 border-t border-gray-100">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-400" />
              <span className="text-xs font-medium text-gray-700">Successful</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-400" />
              <span className="text-xs font-medium text-gray-700">Failed</span>
            </div>
          </div>
        </div>

        {/* Recent Runs */}
        <div className="bg-white border border-gray-200/80 rounded-2xl p-6 shadow-xs">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Recent Runs</h3>
          <div className="space-y-3">
            {traces.slice(0, 10).map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between p-4 bg-white hover:bg-gray-50/60 border border-gray-200/80 rounded-xl transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <span className="text-gray-400 flex-shrink-0">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                    </svg>
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 tracking-tight">{t.agent_id}</h3>
                    <p className="text-xs text-gray-400 font-mono mt-0.5">{t.id}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-medium text-gray-900">
                    {(t.latency_ms / 1000).toFixed(2)}s
                  </p>
                  <p className="text-xs font-medium text-gray-600 mt-0.5">
                    {t.status === "success" ? "Completed" : "Failed"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-gray-100">
          <p className="text-xs text-gray-400">Example workflow records and metrics.</p>
        </div>
      </div>
    </div>
  );
}


