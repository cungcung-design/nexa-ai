import { asArray, backendGet, type WorkspaceConnection } from "@/lib/api";
import { authorizedOrganization } from "@/lib/workspace";
import Link from "next/link";

export default async function ConnectedAppsPage({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;
  const org = await authorizedOrganization(organizationId);
  if (!org) return <p className="p-6 text-gray-500">Choose an organization.</p>;

  const connections = asArray<WorkspaceConnection>(
    await backendGet<unknown>(
      `/api/v1/organizations/${org.id}/integrations/connections`
    )
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
            Connected Apps
          </p>
          <h2 className="mt-1 text-xl font-bold text-gray-900">
            Manage connections
          </h2>
          <p className="text-sm text-gray-500">
            View and manage your workspace connections.
          </p>
        </div>
      </div>

      {connections.length === 0 ? (
        <div className="rounded-xl border border-gray-200/80 p-12 text-center">
          <p className="text-gray-500">No connected apps yet.</p>
          <p className="text-xs text-gray-400 mt-2">
            Start from the Marketplace to connect a provider.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {connections.map((c) => (
            <ConnectionCard key={c.id} connection={c} orgId={org.id} />
          ))}
        </div>
      )}
    </div>
  );
}

function statusVariant(status: string) {
  switch (status) {
    case "connected":
      return "bg-emerald-50 text-emerald-700 border-emerald-200/60";
    case "pending":
      return "bg-amber-50 text-amber-700 border-amber-200/60";
    case "needs_reauthorization":
      return "bg-amber-50 text-amber-700 border-amber-200/60";
    case "unhealthy":
      return "bg-rose-50 text-rose-700 border-rose-200/60";
    case "disabled":
      return "bg-gray-50 text-gray-700 border-gray-200/60";
    default:
      return "bg-gray-50 text-gray-500 border-gray-200/60";
  }
}

function ConnectionCard({
  connection,
  orgId,
}: {
  connection: WorkspaceConnection;
  orgId: string;
}) {
  const variant = statusVariant(connection.status);
  return (
    <Link
      href={`/dashboard/organizations/${orgId}/integrations/connections/${connection.id}`}
      className="flex flex-col gap-3 p-4 rounded-xl border border-gray-200/80 bg-white hover:border-gray-300 transition-colors"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-600">
            <span className="text-xs">{connection.provider_slug
              ?.split("-")
              .map((w) => w.charAt(0).toUpperCase())
              .join("")}</span>
          </div>
          <span className={`text-xs font-medium px-2 py-0.5 rounded ${variant}`}>
            {connection.status.replace(/_/g, " ")}
          </span>
        </div>
      </div>
      <h3 className="text-sm font-semibold text-gray-900">{connection.name}</h3>
      <p className="text-xs text-gray-500">{connection.provider_name}</p>
      <div className="mt-auto flex items-center justify-between text-xs">
        <span className="text-gray-400">{connection.auth_type}</span>
        <span className="text-gray-500">
          {connection.scopes.length} scope{connection.scopes.length !== 1 ? "s" : ""}
        </span>
      </div>
    </Link>
  );
}
