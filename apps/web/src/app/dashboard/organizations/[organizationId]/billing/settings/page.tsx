import {
  BillingCard,
  BillingFooterNote,
} from "@/components/billing/shared";
import { BillingSettingsForm } from "@/components/billing/billing-settings-form";
import { billingSettings } from "@/lib/api";
import { authorizedOrganization } from "@/lib/workspace";

export default async function BillingSettingsPage({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;
  const org = await authorizedOrganization(organizationId);

  if (!org) {
    return (
      <BillingCard>
        <p className="m-0 text-[13px] text-[#777]">
          Choose an organization to view its billing settings.
        </p>
      </BillingCard>
    );
  }

  const settings = await billingSettings(org.id);

  return (
    <BillingCard>
      <div className="mb-5">
        <h1 className="m-0 text-[16px] font-semibold leading-[22px]">
          Billing Information
        </h1>
        <p className="m-[6px_0_0] text-[13px] leading-[19px] text-[#666]">
          These details appear on the invoices of this workspace and are sent
          to the payment provider when a checkout is started.
        </p>
      </div>

      <div className="p-5 border border-[#dedede] rounded-[11px] bg-white mb-4">
        <BillingSettingsForm
          organizationId={organizationId}
          settings={settings}
          canManage={org.role === "OWNER"}
        />
      </div>

      <BillingFooterNote>
        The billing information is stored with the workspace billing profile.
        Changes are recorded in the audit log.
      </BillingFooterNote>
    </BillingCard>
  );
}
