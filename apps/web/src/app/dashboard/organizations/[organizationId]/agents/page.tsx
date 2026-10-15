import { asArray, backendGet, type Agent } from "@/lib/api";
import { authorizedOrganization } from "@/lib/workspace";
import { AgentCreateForm } from "@/components/agent-create-form";
import { AgentCatalog } from "@/components/agents/AgentCatalog";

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

  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-violet-400">
            Agent Studio
          </p>
          <h1 className="mt-2 text-3xl font-bold">AI Agents</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Manage your agents and test published versions.
          </p>
        </div>
        {org && <AgentCreateForm orgId={org.id} />}
      </div>

      {!org ? (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-5 text-sm">
          Create or join an organization to manage agents.
        </p>
      ) : (
        <AgentCatalog key={org.id} orgId={org.id} agents={agents} />
      )}
    </div>
  );
}
