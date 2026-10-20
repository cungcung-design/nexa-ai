import { notFound } from "next/navigation";
import { backendGet, asArray, type Agent, type AgentVersion } from "@/lib/api";
import { authorizedOrganization } from "@/lib/workspace";
import { AgentStudio } from "@/components/agent-studio";

export default async function StudioInstructionsPage({
  params,
}: {
  params: Promise<{ organizationId: string; agentId: string }>;
}) {
  const { organizationId, agentId } = await params;
  const org = await authorizedOrganization(organizationId);
  if (!org) notFound();

  const agent = await backendGet<Agent>(
    `/api/v1/organizations/${org.id}/agents/${encodeURIComponent(agentId)}`
  );
  if (!agent || agent.id !== agentId) notFound();

  const versions = asArray<AgentVersion>(
    await backendGet<unknown>(
      `/api/v1/organizations/${org.id}/agents/${encodeURIComponent(agentId)}/versions`
    )
  );

  return <AgentStudio agent={agent} versions={versions} />;
}
