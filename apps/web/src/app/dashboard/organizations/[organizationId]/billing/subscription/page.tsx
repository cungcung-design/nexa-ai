import Link from "next/link";
import { CalendarIcon, DiamondIcon, WalletIcon } from "@/components/billing/icons";
import {
  BillingCard,
  BillingFooterNote,
  StatusPill,
} from "@/components/billing/shared";
import { formatMoney } from "@/components/billing/format";
import { SubscriptionActions } from "@/components/billing/subscription-actions";
import { formatLongDate } from "@/components/billing/dates";
import { billingSubscription } from "@/lib/api";
import { authorizedOrganization } from "@/lib/workspace";

export default async function BillingSubscriptionPage({
  params,
  searchParams,
}: {
  params: Promise<{ organizationId: string }>;
  searchParams: Promise<{ checkout?: string }>;
}) {
  const { organizationId } = await params;
  const { checkout } = await searchParams;
  const org = await authorizedOrganization(organizationId);

  if (!org) {
    return (
      <BillingCard>
        <p className="m-0 text-[13px] text-[#777]">
          Choose an organization to view its subscription.
        </p>
      </BillingCard>
    );
  }

  const subscription = await billingSubscription(org.id);
  const base = `/dashboard/organizations/${organizationId}/billing`;
  const price = subscription?.price;
  const limits = subscription?.limits;

  const rows: { label: string; value: React.ReactNode }[] = [
    {
      label: "Plan",
      value: subscription?.plan_label ?? "—",
    },
    {
      label: "Status",
      value: (
        <StatusPill
          status={subscription?.status ?? "UNKNOWN"}
          className="inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-medium"
        />
      ),
    },
    {
      label: "Billing cycle",
      value: subscription
        ? subscription.interval === "yearly"
          ? "Yearly"
          : "Monthly"
        : "—",
    },
    {
      label: "Price",
      value: price ? formatMoney(price.amount, price.currency) : "—",
    },
    {
      label: "Current period",
      value: subscription?.current_period_start
        ? `${formatLongDate(subscription.current_period_start)} - ${formatLongDate(
            subscription.current_period_end
          )}`
        : "—",
    },
    {
      label: "Renews on",
      value: formatLongDate(subscription?.current_period_end),
    },
  ];

  return (
    <BillingCard>
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <p className="m-[0_0_3px] text-[#777] text-[12px] leading-[17px]">
            Workspace / Billing
          </p>
          <h1 className="m-0 text-[20px] font-semibold leading-[26px]">
            Subscription
          </h1>
        </div>
        <Link
          href={`${base}/plans`}
          className="inline-flex items-center justify-center gap-1.5 h-[36px] px-4 border-0 rounded-full bg-[#171717] text-white font-sans text-[13px] font-medium cursor-pointer hover:bg-black transition-colors shrink-0"
        >
          <DiamondIcon />
          Change plan
        </Link>
      </div>

      {checkout === "success" ? (
        <p
          role="status"
          className="m-0 mb-4 p-3 border border-[#cfe8cf] rounded-[11px] bg-[#f4fbf4] text-[12px] font-medium text-[#1f7a34]"
        >
          The payment was confirmed. The provider updates the subscription
          state within a few seconds, the current plan is refreshed on the next
          reload.
        </p>
      ) : null}
      {checkout === "canceled" ? (
        <p
          role="status"
          className="m-0 mb-4 p-3 border border-[#dedede] rounded-[11px] bg-[#fafafa] text-[12px] font-medium text-[#666]"
        >
          The checkout was canceled. Nothing was changed for this workspace.
        </p>
      ) : null}

      {subscription?.cancel_at_period_end ? (
        <p
          role="status"
          className="m-0 mb-4 p-3 border border-[#f3d9a8] rounded-[11px] bg-[#fffbeb] text-[12px] font-medium text-[#a36200]"
        >
          The subscription is canceled at the end of the paid period and ends
          on {formatLongDate(subscription.current_period_end)}.
        </p>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <div className="p-4 border border-[#dedede] rounded-[11px] bg-white flex items-center justify-between">
          <div>
            <p className="m-0 text-[12px] text-[#777] font-medium">Plan</p>
            <p className="m-[4px_0_0] text-[18px] font-bold tracking-tight">
              {subscription?.plan_label ?? "—"}
            </p>
          </div>
          <div className="w-8 h-8 rounded-lg bg-[#f5f3ff] text-[#8b5cf6] flex items-center justify-center">
            <DiamondIcon />
          </div>
        </div>
        <div className="p-4 border border-[#dedede] rounded-[11px] bg-white flex items-center justify-between">
          <div>
            <p className="m-0 text-[12px] text-[#777] font-medium">Price</p>
            <p className="m-[4px_0_0] text-[18px] font-bold tracking-tight">
              {price ? formatMoney(price.amount, price.currency) : "—"}
            </p>
          </div>
          <div className="w-8 h-8 rounded-lg bg-[#f0fdf4] text-[#28a745] flex items-center justify-center">
            <WalletIcon />
          </div>
        </div>
        <div className="p-4 border border-[#dedede] rounded-[11px] bg-white flex items-center justify-between">
          <div>
            <p className="m-0 text-[12px] text-[#777] font-medium">Renews on</p>
            <p className="m-[4px_0_0] text-[18px] font-bold tracking-tight">
              {formatLongDate(subscription?.current_period_end)}
            </p>
          </div>
          <div className="w-8 h-8 rounded-lg bg-[#fffbeb] text-[#d77d00] flex items-center justify-center">
            <CalendarIcon />
          </div>
        </div>
      </div>

      <div className="p-5 border border-[#dedede] rounded-[11px] bg-white mb-4">
        <h2 className="m-0 mb-3 text-[15px] font-semibold">Subscription</h2>
        <dl className="m-0">
          {rows.map((row) => (
            <div
              key={row.label}
              className="flex items-center justify-between gap-4 py-2 border-b border-[#f2f2f2] last:border-b-0"
            >
              <dt className="text-[12px] text-[#777]">{row.label}</dt>
              <dd className="m-0 text-[13px] font-medium text-[#171717]">
                {row.value}
              </dd>
            </div>
          ))}
        </dl>

        <div className="mt-4 pt-4 border-t border-[#dedede]">
          <SubscriptionActions
            organizationId={organizationId}
            canManage={org.role === "OWNER"}
            providerConfigured={subscription?.provider_configured ?? false}
            hasProviderSubscription={
              subscription?.has_provider_subscription ?? false
            }
            cancelAtPeriodEnd={subscription?.cancel_at_period_end ?? false}
          />
        </div>
      </div>

      {limits ? (
        <div className="p-5 border border-[#dedede] rounded-[11px] bg-white mb-4">
          <h2 className="m-0 mb-3 text-[15px] font-semibold">
            Plan entitlements
          </h2>
          <dl className="m-0 grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-2">
            {[
              { label: "Agents", value: limits.agents, unlimited: false },
              {
                label: "AI requests / month",
                value: limits.monthly_requests,
                unlimited: false,
              },
              {
                label: "Knowledge bases",
                value: limits.knowledge_bases,
                unlimited: false,
              },
              {
                label: "Workflow executions",
                value: limits.workflow_executions,
                unlimited: true,
              },
              {
                label: "Storage (MB)",
                value: limits.storage_mb,
                unlimited: true,
              },
              { label: "Team seats", value: limits.seats, unlimited: true },
            ].map((item) => (
              <div
                key={item.label}
                className="flex items-center justify-between gap-3 py-1"
              >
                <dt className="text-[12px] text-[#777]">{item.label}</dt>
                <dd className="m-0 text-[13px] font-medium text-[#171717]">
                  {item.unlimited && item.value <= 0
                    ? "Unlimited"
                    : item.value.toLocaleString("en-US")}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}

      <BillingFooterNote>
        The subscription is stored in the workspace billing record. Card
        changes, invoice downloads and refunds are handled by the payment
        provider in its hosted portal.
      </BillingFooterNote>
    </BillingCard>
  );
}
