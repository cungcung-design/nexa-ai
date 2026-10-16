import { notFound } from "next/navigation";
import { backendGet } from "@/lib/api";
import { authorizedOrganization } from "@/lib/workspace";

type Deployment = {
  id: string;
  agent_id: string;
  public_id: string;
  name: string;
  allowed_origins: string[];
  is_active: boolean;
};

export default async function AgentDeploymentsPage({
  params,
}: {
  params: Promise<{ organizationId: string; agentId: string }>;
}) {
  const { organizationId, agentId } = await params;
  const org = await authorizedOrganization(organizationId);
  if (!org) notFound();

  const deployments = (await backendGet<Deployment[]>(
    `/api/v1/organizations/${org.id}/deployments?agent_id=${encodeURIComponent(agentId)}`
  )) ?? [];

  return (
    <div className="w-full max-w-4xl bg-white border border-gray-200/80 rounded-2xl p-6 shadow-xs">
      <div className="mb-6">
        <h2 className="text-base font-semibold text-gray-900 tracking-tight">
          Deployments
        </h2>
        <p className="text-xs text-gray-500 mt-0.5">
          Configure published API/widget access for this agent.
        </p>
      </div>

      {deployments.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200/80 bg-gray-50 p-12 text-center">
          <p className="text-xs text-gray-400">No deployments configured.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {deployments.map((d) => (
            <div
              key={d.id}
              className="p-4 bg-white border border-gray-200/80 rounded-xl shadow-xs"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{d.name}</p>
                    <p className="text-xs text-gray-500 font-mono">{d.public_id}</p>
                  </div>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                  d.is_active
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                    : "bg-gray-100 text-gray-600 border border-gray-200/60"
                }`}>
                  {d.is_active ? "Active" : "Disabled"}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                {d.allowed_origins.length} allowed origins
              </p>
              <div className="mt-3 space-y-1">
                {d.allowed_origins.map((o) => (
                  <p key={o} className="text-[10px] font-mono text-gray-400 break-all">
                    {o}
                  </p>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-8 pt-4 border-t border-gray-100">
        <p className="text-xs text-gray-400 text-center">
          Deployment configuration for published agent versions.
        </p>
      </div>
    </div>
  );
}
