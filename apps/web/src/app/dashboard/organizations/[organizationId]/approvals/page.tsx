import { asArray, backendGet, type Agent } from "@/lib/api";
import { authorizedOrganization } from "@/lib/workspace";
import {
  WorkflowCenter,
  type Approval,
} from "@/components/workflow-center";

export default async function ApprovalsPage({
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
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-violet-400">
          Agent Operations
        </p>
        <h1 className="mt-2 text-3xl font-bold">Approval Center</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Review pending agent actions and audit approval decisions.
        </p>
      </div>
      {org ? (
        <WorkflowCenter
          key={org.id}
          orgId={org.id}
          agents={agents}
          initialApprovals={approvals}
          canReview={canReview}
          mode="approvals"
        />
      ) : (
        <p className="text-zinc-400">Choose an organization to continue.</p>
      )}
    </div>
  );
}
