import { asArray, backendGet } from "@/lib/api";
import { authorizedOrganization } from "@/lib/workspace";
import Link from "next/link";

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

export default async function EvaluationRunDetailPage({
  params,
}: {
  params: Promise<{ organizationId: string; runId: string }>;
}) {
  const { organizationId, runId } = await params;
  const org = await authorizedOrganization(organizationId);

  if (!org) {
    return null;
  }

  const results = await fetchEvaluationResults(org.id);
  const result = results.find((r) => r.id === runId);

  if (!result) {
    return (
      <div className="bg-gray-50 text-gray-900 min-h-screen p-6">
        <div className="bg-white border border-gray-200/80 rounded-2xl p-12 shadow-xs text-center">
          <h2 className="text-base font-semibold text-gray-900 mb-2">Evaluation run not found</h2>
          <p className="text-xs text-gray-500">The requested evaluation run does not exist.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 text-gray-900 min-h-screen p-6">
      <div className="space-y-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-base font-semibold text-gray-900 tracking-tight">
              Evaluation Run Detail
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Review scores, expected versus actual results, and failure reasons.
            </p>
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white border border-gray-200/80 rounded-2xl p-6 shadow-xs">
            <p className="text-xs text-gray-400 font-medium mb-1">Status</p>
            <p className={`text-2xl font-bold text-gray-900 tracking-tight ${
              result.passed ? "text-emerald-600" : "text-rose-600"
            }`}>
              {result.passed ? "Passed" : "Failed"}
            </p>
          </div>
          <div className="bg-white border border-gray-200/80 rounded-2xl p-6 shadow-xs">
            <p className="text-xs text-gray-400 font-medium mb-1">Latency</p>
            <p className="text-2xl font-bold text-gray-900 tracking-tight">
              {(result.latency_ms / 1000).toFixed(2)}s
            </p>
          </div>
          <div className="bg-white border border-gray-200/80 rounded-2xl p-6 shadow-xs">
            <p className="text-xs text-gray-400 font-medium mb-1">Agent</p>
            <p className="text-2xl font-bold text-gray-900 tracking-tight">
              {result.agent_id.slice(0, 8)}…
            </p>
          </div>
        </div>

        {/* Test Cases */}
        <div className="bg-white border border-gray-200/80 rounded-2xl p-6 shadow-xs">
          <h3 className="text-sm font-semibold text-gray-900 mb-6">Test Cases</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-100 text-xs font-medium text-gray-400">
                  <th className="py-3 font-medium">Case ID</th>
                  <th className="py-3 font-medium text-right">Result</th>
                  <th className="py-3 font-medium text-right">Latency</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 text-sm">
                <tr className="hover:bg-gray-50/50 transition-colors cursor-pointer">
                  <td className="py-4 font-mono text-xs text-gray-700">{result.case_id.slice(0, 8)}</td>
                  <td className="py-4 text-right">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${
                      result.passed
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200/60"
                        : "bg-rose-50 text-rose-700 border-rose-200/60"
                    }`}
                    >
                      {result.passed ? "Passed" : "Failed"}
                    </span>
                  </td>
                  <td className="py-4 text-right font-medium text-gray-700">
                    {(result.latency_ms / 1000).toFixed(2)}s
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex gap-4">
          <Link
            href={`/dashboard/organizations/${org.id}/analytics/agents/${result.agent_id}`}
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

        <div className="mt-6 pt-4 border-t border-gray-100">
          <p className="text-xs text-gray-400">Example evaluation details for design purposes.</p>
        </div>
      </div>
    </div>
  );
}


