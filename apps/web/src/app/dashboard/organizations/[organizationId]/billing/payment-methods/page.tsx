import {
  BillingCard,
  BillingFooterNote,
} from "@/components/billing/shared";
import { PaymentMethodsList } from "@/components/billing/payment-methods-list";
import { billingPaymentMethods } from "@/lib/api";
import { authorizedOrganization } from "@/lib/workspace";

export default async function BillingPaymentMethodsPage({
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
          Choose an organization to view its payment methods.
        </p>
      </BillingCard>
    );
  }

  const paymentMethods = await billingPaymentMethods(org.id);

  return (
    <BillingCard>
      <PaymentMethodsList
        organizationId={organizationId}
        methods={paymentMethods?.items ?? []}
        canManage={org.role === "OWNER"}
        providerConfigured={paymentMethods?.provider_configured ?? false}
      />

      <BillingFooterNote>
        Cards are collected by the payment provider in its own secure form.
        Nexa-AI never receives the full card number, and the workspace only
        keeps the provider reference and the masked card details.
      </BillingFooterNote>
    </BillingCard>
  );
}
