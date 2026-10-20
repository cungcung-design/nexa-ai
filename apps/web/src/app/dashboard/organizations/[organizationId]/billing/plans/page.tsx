import { PlansGrid } from "@/components/billing/plans-grid";
import { BillingCard } from "@/components/billing/shared";
import { billingCatalog, billingSubscription } from "@/lib/api";
import { authorizedOrganization } from "@/lib/workspace";

export default async function BillingPlansPage({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;
  const org = await authorizedOrganization(organizationId);

  if (!org) {
    return (
      <BillingCard className="w-full max-w-[922px] mx-auto p-[17px_14px_15px] border border-[#e0e0e0] rounded-[21px] bg-white shadow-xs">
        <p className="m-0 text-[13px] text-[#777]">
          Choose an organization to view its plans.
        </p>
      </BillingCard>
    );
  }

  const [catalog, subscription] = await Promise.all([
    billingCatalog(org.id),
    billingSubscription(org.id),
  ]);

  return (
    <BillingCard className="w-full max-w-[922px] mx-auto p-[17px_14px_15px] border border-[#e0e0e0] rounded-[21px] bg-white shadow-xs">
      <div className="mb-4">
        <h1 className="m-0 text-[23px] font-semibold leading-[30px]">
          Choose Your Plan
        </h1>
        <p className="m-[7px_0_16px] text-[14px] text-[#666] tracking-[0.1px]">
          Select a plan that fits your workspace.
        </p>
      </div>

      <PlansGrid
        organizationId={organizationId}
        plans={catalog?.plans ?? []}
        canManage={org.role === "OWNER"}
        currentPlan={subscription?.plan ?? "FREE"}
        providerConfigured={catalog?.provider_configured ?? false}
      />

      <p className="note m-[16px_0_0] text-[#707070] text-[16px] leading-[22px]">
        Prices, features and quotas come from the workspace pricing catalog.
        The yearly selection shows the monthly equivalent of the annual price;
        the amount charged per year is listed on the plan.
      </p>
    </BillingCard>
  );
}
