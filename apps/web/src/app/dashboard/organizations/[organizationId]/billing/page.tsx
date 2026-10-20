import Link from "next/link";
import {
  ArrowIcon,
  BotIcon,
  CalendarIcon,
  DiamondIcon,
  SparklesIcon,
  WalletIcon,
} from "@/components/billing/icons";
import {
  BillingCard,
  BillingFooterNote,
  BillingMetric,
  StatusPill,
  UsageBar,
} from "@/components/billing/shared";
import {
  formatCompactNumber,
  formatMoney,
} from "@/components/billing/format";
import { formatShortDate } from "@/components/billing/dates";
import {
  billingSubscription,
  billingUsage,
  type BillingUsageQuota,
} from "@/lib/api";
import { authorizedOrganization } from "@/lib/workspace";

function quotaOf(
  quotas: BillingUsageQuota[],
  key: string
): BillingUsageQuota | undefined {
  return quotas.find((quota) => quota.key === key);
}

function percent(used: number, limit: number | null) {
  if (!limit || limit <= 0) return 0;
  return Math.max(0, Math.min(100, (used / limit) * 100));
}

export default async function BillingOverviewPage({
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
          Choose an organization to view its billing.
        </p>
      </BillingCard>
    );
  }

  const [subscription, usage] = await Promise.all([
    billingSubscription(org.id),
    billingUsage(org.id),
  ]);

  const quotas = usage?.quotas ?? [];
  const requests = quotaOf(quotas, "ai_requests");
  const workflows = quotaOf(quotas, "workflow_executions");
  const base = `/dashboard/organizations/${organizationId}/billing`;
  const price = subscription?.price;
  const intervalLabel = subscription?.interval === "yearly" ? "year" : "month";

  return (
    <BillingCard>
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <p className="m-[0_0_3px] text-[#777] text-[12px] leading-[17px]">
            Workspace / Billing
          </p>
          <h1 className="m-0 text-[20px] font-semibold leading-[26px]">
            Billing &amp; Subscription
          </h1>
        </div>
        <Link
          href={`${base}/plans`}
          className="inline-flex items-center justify-center gap-1.5 h-[36px] px-4 border-0 rounded-full bg-[#171717] text-white font-sans text-[13px] font-medium cursor-pointer hover:bg-black transition-colors shrink-0"
        >
          <SparklesIcon />
          View Plans
        </Link>
      </div>

      <p className="m-[0_0_16px] text-[#777] text-[12px] leading-[17px]">
        Manage your plan, usage, and payments.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
        <BillingMetric
          label="Current Plan"
          value={subscription?.plan_label ?? "Unavailable"}
          icon={<DiamondIcon />}
          iconBackground="bg-[#f5f3ff]"
          iconColor="text-[#8b5cf6]"
          href={`${base}/plans`}
        />
        <BillingMetric
          label="Current Period"
          value={
            price
              ? formatMoney(price.amount, price.currency)
              : "—"
          }
          icon={<WalletIcon />}
          iconBackground="bg-[#f0fdf4]"
          iconColor="text-[#28a745]"
          href={`${base}/subscription`}
        />
        <BillingMetric
          label="AI Requests"
          value={formatCompactNumber(usage?.request_count ?? 0)}
          icon={<BotIcon />}
          iconBackground="bg-[#f5f3ff]"
          iconColor="text-[#8b5cf6]"
          href={`${base}/usage`}
        />
        <BillingMetric
          label="Next Renewal"
          value={formatShortDate(subscription?.current_period_end)}
          icon={<CalendarIcon />}
          iconBackground="bg-[#fffbeb]"
          iconColor="text-[#d77d00]"
          href={`${base}/subscription`}
        />
      </div>

      <div className="p-5 border border-[#dedede] rounded-[11px] bg-white mb-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="m-0 text-[15px] font-semibold">Your Current Plan</h2>
          <StatusPill status={subscription?.status ?? "UNKNOWN"} />
        </div>

        <p className="m-[0_0_16px] text-[12px] text-[#777]">
          {subscription
            ? `${subscription.plan_label} · ${
                subscription.interval === "yearly" ? "Yearly" : "Monthly"
              } subscription`
            : "No subscription is available for this workspace."}
        </p>

        <div className="flex items-baseline gap-1 mb-6">
          <span className="text-[32px] font-bold tracking-tight">
            {price ? `$${(price.amount / 100).toFixed(0)}` : "—"}
          </span>
          <span className="text-[13px] text-[#777]">/ {intervalLabel}</span>
        </div>

        {requests ? (
          <div className="mb-4">
            <div className="flex justify-between items-center text-[12px] mb-1.5">
              <span className="font-medium text-[#171717]">
                {requests.label}
              </span>
              <span className="text-[#777]">
                {formatCompactNumber(requests.used)} /{" "}
                {requests.limit === null
                  ? "Unlimited"
                  : formatCompactNumber(requests.limit)}
              </span>
            </div>
            <UsageBar
              value={percent(requests.used, requests.limit)}
              label={requests.label}
            />
          </div>
        ) : null}

        {workflows ? (
          <div className="mb-6">
            <div className="flex justify-between items-center text-[12px] mb-1.5">
              <span className="font-medium text-[#171717]">
                {workflows.label}
              </span>
              <span className="text-[#777]">
                {formatCompactNumber(workflows.used)} /{" "}
                {workflows.unlimited
                  ? "Unlimited"
                  : formatCompactNumber(workflows.limit ?? 0)}
              </span>
            </div>
            <UsageBar
              value={percent(workflows.used, workflows.limit)}
              label={workflows.label}
            />
          </div>
        ) : null}

        <Link
          href={`${base}/usage`}
          className="w-full h-[40px] px-4 border border-[#dedede] rounded-full bg-white hover:bg-gray-50 text-[#171717] font-semibold text-[13px] flex items-center justify-center gap-2 cursor-pointer transition-colors"
        >
          View Usage Details
          <ArrowIcon />
        </Link>
      </div>

      <BillingFooterNote>
        Plan prices, entitlements and usage above are read from the workspace
        billing record. Usage is metered in real time for the running billing
        period and resets when the next period starts.
      </BillingFooterNote>
    </BillingCard>
  );
}
