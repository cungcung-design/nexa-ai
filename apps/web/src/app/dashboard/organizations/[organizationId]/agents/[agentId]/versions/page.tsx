import { notFound } from "next/navigation";
import { backendGet, asArray, type AgentVersion } from "@/lib/api";
import { authorizedOrganization } from "@/lib/workspace";

export default async function AgentVersionsPage({
  params,
}: {
  params: Promise<{ organizationId: string; agentId: string }>;
}) {
  const { organizationId, agentId } = await params;
  const org = await authorizedOrganization(organizationId);
  if (!org) notFound();

  const versions = asArray<AgentVersion>(
    await backendGet<unknown>(
      `/api/v1/organizations/${org.id}/agents/${encodeURIComponent(agentId)}/versions`
    )
  );

  return (
    <div className="w-full max-w-4xl bg-white border border-gray-200/80 rounded-2xl p-6 shadow-xs">
      <div className="mb-6">
        <h2 className="text-base font-semibold text-gray-900 tracking-tight">
          Version History
        </h2>
      </div>

      <div className="space-y-6">
        {versions.length > 0 ? (
          versions.map((v, idx) => {
            const isLast = idx === versions.length - 1;
            const status = idx === 0 ? "Draft" : "Previous version";
            const statusColor = idx === 0 ? "bg-amber-50 text-amber-700 border border-amber-200/60" : "bg-gray-100 text-gray-600 border border-gray-200/60";

            return (
              <div
                key={v.id}
                className={`relative pl-6 ${!isLast ? "pb-6" : ""}`}
              >
                {!isLast && (
                  <div className="absolute left-2.5 top-6 bottom-[-24px] w-0.5 bg-gray-200" />
                )}
                <div className="flex items-center gap-3 mb-1">
                  <span
                    className={`absolute left-0 -top-0.5 w-2 h-2 rounded-full bg-gray-400 ${
                      idx === 0 ? "bg-amber-500" : "bg-gray-400"
                    }`}
                  />
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-gray-900 tracking-tight">
                      v{v.version_number}
                    </h3>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusColor}`}>
                      {status}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-gray-500 pl-4">
                  {idx === 0
                    ? "Updated instructions and retrieval settings"
                    : idx === 1
                      ? "Currently used by the production deployment"
                      : "Available for comparison"}
                </p>
              </div>
            );
          })
        ) : (
          <div className="text-center py-12">
            <p className="text-xs text-gray-400">No versions saved yet.</p>
          </div>
        )}
      </div>

      <div className="mt-8 pt-4 border-t border-gray-100">
        <p className="text-xs text-gray-400 text-center">
          Illustrative version history.
        </p>
      </div>
    </div>
  );
}
