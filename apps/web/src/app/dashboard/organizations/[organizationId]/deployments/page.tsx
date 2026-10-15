import { asArray, backendGet, type Agent } from "@/lib/api";
import { authorizedOrganization } from "@/lib/workspace";
import {
  DeploymentManager,
  type Deployment,
} from "@/components/deployment-manager";

export default async function DeploymentsPage({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;
  const org = await authorizedOrganization(organizationId);

  const agents = org
    ? asArray<Agent>(
        await backendGet<unknown>(
          `/api/v1/organizations/${org.id}/agents`
        )
      )
    : [];
  const deployments = org
    ? asArray<Deployment>(
        await backendGet<unknown>(
          `/api/v1/organizations/${org.id}/deployments`
        )
      )
    : [];
  const canManage = org?.role === "OWNER" || org?.role === "ADMIN";

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-violet-400">
          Distribution
        </p>
        <h1 className="mt-2 text-3xl font-bold">Agent Deployments</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Configure website chat assistants and generate embed snippets.
        </p>
      </div>
      {org ? (
        <DeploymentManager
          key={org.id}
          orgId={org.id}
          agents={agents}
          initialDeployments={deployments}
          canManage={canManage}
        />
      ) : (
        <p className="text-zinc-400">Choose an organization to continue.</p>
      )}
    </div>
  );
}
