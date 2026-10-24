import { asArray, backendGet, type Agent } from "@/lib/api";
import { authorizedOrganization } from "@/lib/workspace";
import {
  WorkflowConsole,
  type WorkflowDefinition,
  type WorkflowExecution,
} from "@/components/workflow-console";
import { Suspense } from "react";

export const instant = false;

async function WorkflowsContent({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;
  const org = await authorizedOrganization(organizationId);
  if (!org) {
    return <p className="text-sm text-slate-500">Choose an organization to continue.</p>;
  }

  const agents = asArray<Agent>(
    await backendGet<unknown>(`/api/v1/organizations/${org.id}/agents`, {
      revalidate: 0,
    })
  );
  const definitions = asArray<WorkflowDefinition>(
    await backendGet<unknown>(
      `/api/v1/organizations/${org.id}/workflows/definitions`,
      { revalidate: 0 }
    )
  );
  const executions = asArray<WorkflowExecution>(
    await backendGet<unknown>(
      `/api/v1/organizations/${org.id}/workflows/executions`,
      { revalidate: 0 }
    )
  );

  return (
    <WorkflowConsole
      orgId={org.id}
      role={org.role}
      agents={agents}
      definitions={definitions}
      initialExecutions={executions}
    />
  );
}

export default async function WorkflowsPage({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  return (
    <Suspense fallback={<p className="text-sm text-slate-500">Loading workflows...</p>}>
      <WorkflowsContent params={params} />
    </Suspense>
  );
}
