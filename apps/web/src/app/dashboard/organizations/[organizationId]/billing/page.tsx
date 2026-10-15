import { backendGet } from "@/lib/api";
import { authorizedOrganization } from "@/lib/workspace";
import {
  BillingDashboard,
  type BillingPlan,
} from "@/components/billing-dashboard";

export default async function BillingPage({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;
  const org = await authorizedOrganization(organizationId);

  const plan = org
    ? await backendGet<BillingPlan>(
        `/api/v1/organizations/${encodeURIComponent(org.id)}/billing/plan`
      )
    : null;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-violet-400">
          Workspace / Finance
        </p>
        <h1 className="mt-2 text-3xl font-bold">Billing & Subscription</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Manage your plan and review entitlements for this organization.
        </p>
      </div>
      {org ? (
        <BillingDashboard
          key={org.id}
          orgId={org.id}
          plan={plan}
          canManage={org.role === "OWNER"}
        />
      ) : (
        <div className="rounded-xl border border-white/10 p-6 text-zinc-400">
          Choose an organization to view billing.
        </div>
      )}
    </div>
  );
}
