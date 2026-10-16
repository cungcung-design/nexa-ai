import { asArray, backendGet, type Trace } from "@/lib/api";
import { authorizedOrganization } from "@/lib/workspace";
import Link from "next/link";

async function fetchTraces(orgId: string): Promise<Trace[]> {
  const d = await backendGet<unknown>(
    `/api/v1/organizations/${encodeURIComponent(orgId)}/analytics/traces`);
  return asArray<Trace>(d);
}

export default async function UsagePage({
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

  const totalRequests = traces.length;
  const tokenUsage = traces.reduce(
    (sum, t) => sum + t.prompt_tokens + t.completion_tokens,
    0
  );
  const inputTokens = traces.reduce((sum, t) => sum + t.prompt_tokens, 0);
  const outputTokens = traces.reduce((sum, t) => sum + t.completion_tokens, 0);
  const estCost = (tokenUsage / 1000) * 0.002;

  // Group by agent for cost by agent
  const byAgent = new Map<string, { cost: number; tokens: number }>();
  traces.forEach((t) => {
    const cur = byAgent.get(t.agent_id) ?? { cost: 0, tokens: 0 };
    cur.cost += (t.prompt_tokens + t.completion_tokens) / 1000 * 0.002;
    cur.tokens += t.prompt_tokens + t.completion_tokens;
    byAgent.set(t.agent_id, cur);
  });

  return (
    <div className="bg-gray-50 text-gray-900 min-h-screen p-6">
      <div className="space-y-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-base font-semibold text-gray-900 tracking-tight">
              Usage & Cost
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Monitor token consumption, estimated costs, and quota usage.
            </p>
          </div>
          <Link
            href={`/dashboard/organizations/${encodeURIComponent(org.id)}/billing`}
            className="flex items-center gap-2 px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white text-xs font-medium rounded-xl transition-colors cursor-pointer shadow-sm"
          >
            <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-5.5-2.5a.5.5 0 11-1 0 .5.5 0 011 0zM12 7a1 1 0 100 2 1 1 0 000-2z" />
            </svg>
            <span className="hidden sm:inline">View Billing</span>
          </Link>
        </div>

        {/* Cost breakdown panels */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <div className="bg-white border border-gray-200/80 rounded-2xl p-6 shadow-xs">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Cost by Agent</h3>
            <div className="space-y-3">
              {Array.from(byAgent.entries()).length > 0 ? (
                Array.from(byAgent.entries()).map(([agentId, data]) => (
                  <div key={agentId} className="flex items-center justify-between">
                    <span className="text-sm text-gray-700">{agentId}</span>
                    <span className="text-sm font-medium text-gray-900 text-right">
                      ${data.cost.toFixed(4)}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-xs text-gray-400 text-center py-4">No cost data available.</p>
              )}
            </div>
          </div>

          <div className="bg-white border border-gray-200/80 rounded-2xl p-6 shadow-xs">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Cost by Model</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-700">Ollama (local)</span>
                <span className="text-sm font-medium text-gray-900 text-right">
                  $0.0000
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-2">
                Locally hosted model — token usage measured without provider charges.
              </p>
            </div>
          </div>
        </div>

        {/* Daily Cost Trend */}
        <div className="bg-white border border-gray-200/80 rounded-2xl p-6 shadow-xs mb-8">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Daily Cost Trend</h3>
          <div className="relative h-64 w-full">
            <div className="absolute inset-0 flex flex-col justify-between text-xs text-gray-400 pointer-events-none pr-2">
              {[4, 3, 2, 1, 0].map((k) => (
                <div key={k} className="flex items-center justify-between border-b border-gray-100 pb-1">
                  <span>${k.toFixed(1)}</span>
                </div>
              ))}
            </div>
            <div className="absolute inset-x-8 inset-y-6 grid grid-cols-7 items-end gap-2 z-10">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day, i) => (
                <div key={day} className="flex flex-col items-center gap-1 h-full">
                  <div className="w-6 bg-blue-400 rounded-t-sm" style={{ height: `${30 + i * 10}%` }} />
                  <span className="text-[10px] text-gray-500">{day}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Summary metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white border border-gray-200/80 rounded-2xl p-6 shadow-xs">
            <p className="text-xs text-gray-500 font-medium mb-1">Input tokens</p>
            <p className="text-xl font-semibold text-gray-900 tracking-tight">{inputTokens}</p>
          </div>
          <div className="bg-white border border-gray-200/80 rounded-2xl p-6 shadow-xs">
            <p className="text-xs text-gray-500 font-medium mb-1">Output tokens</p>
            <p className="text-xl font-semibold text-gray-900 tracking-tight">{outputTokens}</p>
          </div>
          <div className="bg-white border border-gray-200/80 rounded-2xl p-6 shadow-xs">
            <p className="text-xs text-gray-500 font-medium mb-1">Total tokens</p>
            <p className="text-xl font-semibold text-gray-900 tracking-tight">{tokenUsage}</p>
          </div>
          <div className="bg-white border border-gray-200/80 rounded-2xl p-6 shadow-xs">
            <p className="text-xs text-gray-500 font-medium mb-1">Estimated cost</p>
            <p className="text-xl font-semibold text-gray-900 tracking-tight">${estCost.toFixed(4)}</p>
          </div>
          <div className="bg-white border border-gray-200/80 rounded-2xl p-6 shadow-xs">
            <p className="text-xs text-gray-500 font-medium mb-1">Total requests</p>
            <p className="text-xl font-semibold text-gray-900 tracking-tight">{totalRequests}</p>
          </div>
        </div>
      </div>
    </div>
  );
}


