import { asArray, backendGet, type Agent } from "@/lib/api";
import { authorizedOrganization } from "@/lib/workspace";
import { AgentsGrid } from "@/components/agents-grid";

export default async function AgentsPage({
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

  if (!org) {
    return <p className="p-6 text-zinc-400">Choose an organization to continue.</p>;
  }

  return <AgentsGrid agents={agents} />;
}
