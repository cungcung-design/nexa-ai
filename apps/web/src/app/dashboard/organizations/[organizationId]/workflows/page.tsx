import { asArray, backendGet, type Agent } from "@/lib/api";
import { authorizedOrganization } from "@/lib/workspace";
import { WorkflowBuilder } from "@/components/workflow-builder";
import { type Approval } from "@/components/workflow-center";
import { Suspense } from "react";

async function WorkflowsContent({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;
  const org = await authorizedOrganization(organizationId);
  const canReview = org?.role === "OWNER" || org?.role === "ADMIN";

  const agents = org
    ? asArray<Agent>(
        await backendGet<unknown>(
          `/api/v1/organizations/${org.id}/agents`
        )
      )
    : [];
  const approvals =
    org && canReview
      ? asArray<Approval>(
          await backendGet<unknown>(
            `/api/v1/organizations/${org.id}/workflows/approvals`
          )
        )
      : [];

  return (
    <WorkflowBuilder
      org={org}
      orgId={org.id}
      agents={agents}
      initialApprovals={approvals}
      canReview={canReview}
    />
  );
}

export default async function WorkflowsPage({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  return (
    <Suspense fallback={<div className="text-zinc-400">Loading...</div>}>
      <WorkflowsContent params={params} />
    </Suspense>
  );
}

  return (
    <WorkflowBuilder
      org={org}
      orgId={org.id}
      agents={agents}
      initialApprovals={approvals}
      canReview={canReview}
    />
  );
}
