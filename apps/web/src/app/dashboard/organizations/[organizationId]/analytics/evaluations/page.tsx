import { asArray, backendGet } from "@/lib/api";
import { authorizedOrganization } from "@/lib/workspace";

type EvalResult = {
  id: string;
  organization_id: string;
  case_id: string;
  agent_id: string;
  passed: boolean;
  latency_ms: number;
  created_at: string;
};

async function fetchEvaluationResults(orgId: string): Promise<EvalResult[]> {
  const d = await backendGet<unknown>(
    `/api/v1/organizations/${encodeURIComponent(orgId)}/evaluations/results`);
  return asArray<EvalResult>(d);
}

function runStatusColor(status: string) {
  if (status === "Passed")
    return "bg-emerald-50 text-emerald-700 border-emerald-200/60";
  if (status === "Failed")
    return "bg-rose-50 text-rose-700 border-rose-200/60";
  return "bg-amber-50 text-amber-700 border-amber-200/60";
}

export default async function EvaluationsPage({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;
  const org = await authorizedOrganization(organizationId);

  if (!org) {
    return null;
  }

  const results = await fetchEvaluationResults(org.id);
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  const total = results.length;
  const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;

  return (
    <div className="bg-gray-50 text-gray-900 min-h-screen p-6">
      <div className="space-y-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-base font-semibold text-gray-900 tracking-tight">
              AI Evaluations
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Measure quality and detect regressions.
            </p>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white text-xs font-medium rounded-xl transition-colors cursor-pointer shadow-sm">
            <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
            Run Evaluation
          </button>
        </div>

        {/* Metrics Row */}
        <div className="grid grid-cols-3 gap-4 mb-8 pt-2">
          <div className="bg-white border border-gray-200/80 rounded-2xl p-6 shadow-xs">
            <p className="text-xs text-gray-400 font-medium mb-1">Pass Rate</p>
            <p className="text-2xl font-bold text-gray-900 tracking-tight">{passRate}%</p>
          </div>
          <div className="bg-white border border-gray-200/80 rounded-2xl p-6 shadow-xs">
            <p className="text-xs text-gray-400 font-medium mb-1">Test Cases</p>
            <p className="text-2xl font-bold text-gray-900 tracking-tight">{total}</p>
          </div>
          <div className="bg-white border border-gray-200/80 rounded-2xl p-6 shadow-xs">
            <p className="text-xs text-gray-400 font-medium mb-1">Failed</p>
            <p className="text-2xl font-bold text-gray-900 tracking-tight">{failed}</p>
          </div>
        </div>

        {/* Recent Evaluation Runs */}
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-gray-900 tracking-tight mb-4">
            Recent Evaluation Runs
          </h3>
          <div className="space-y-3">
            {results.length > 0 ? (
              results.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between py-3 px-4 bg-white hover:bg-gray-50/60 border border-gray-200/80 rounded-xl transition-colors cursor-pointer"
                >
                  <span className="text-sm font-medium text-gray-900">
                    Agent {r.agent_id.slice(0, 8)}
                  </span>
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${runStatusColor(r.passed ? "Passed" : "Failed")}`}>
                    {r.passed ? "Passed" : "Failed"}
                  </span>
                </div>
              ))
            ) : (
              <div className="py-4 text-center text-gray-400 bg-gray-50/50 rounded-xl border border-gray-100">
                No evaluation runs available.
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-gray-100">
          <p className="text-xs text-gray-400">Example evaluation values and records.</p>
        </div>
      </div>
    </div>
  );
}


