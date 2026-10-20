"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export const BILLING_SECTIONS = [
  { segment: "", label: "Overview" },
  { segment: "subscription", label: "Subscription" },
  { segment: "plans", label: "Plans" },
  { segment: "usage", label: "Usage" },
  { segment: "invoices", label: "Invoices" },
  { segment: "payment-methods", label: "Payment Methods" },
  { segment: "settings", label: "Settings" },
] as const;

export function BillingNav({ organizationId }: { organizationId: string }) {
  const pathname = usePathname() ?? "";
  const base = `/dashboard/organizations/${organizationId}/billing`;

  return (
    <nav
      aria-label="Billing sections"
      className="flex flex-wrap items-center gap-1 p-1 border border-[#dedede] rounded-full bg-white w-fit"
    >
      {BILLING_SECTIONS.map((item) => {
        const href = item.segment ? `${base}/${item.segment}` : base;
        const active = item.segment
          ? pathname === href || pathname.startsWith(`${href}/`)
          : pathname === base || pathname === `${base}/`;
        return (
          <Link
            key={item.segment || "overview"}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`inline-flex items-center h-[32px] px-3.5 rounded-full text-[13px] font-medium transition-colors ${
              active
                ? "bg-[#171717] text-white"
                : "text-[#666] hover:bg-[#f4f4f4] hover:text-[#171717]"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** The white surface every billing screen is rendered on. */
export function BillingCard({
  children,
  className = "w-full max-w-[900px] mx-auto p-[20px_20px_16px] border border-[#dedede] rounded-[13px] bg-white shadow-xs",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <main className={className}>{children}</main>;
}

export function BillingMetric({
  label,
  value,
  icon,
  iconBackground,
  iconColor,
  href,
}: {
  label: string;
  value: React.ReactNode;
  icon: React.ReactNode;
  iconBackground: string;
  iconColor: string;
  href?: string;
}) {
  const content = (
    <>
      <div>
        <p className="m-0 text-[12px] text-[#777] font-medium">{label}</p>
        <p className="m-[4px_0_0] text-[22px] font-bold tracking-tight">
          {value}
        </p>
      </div>
      <div
        className={`w-8 h-8 rounded-lg ${iconBackground} ${iconColor} flex items-center justify-center`}
      >
        {icon}
      </div>
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="p-4 border border-[#dedede] rounded-[11px] bg-white flex items-center justify-between transition-colors hover:bg-[#fbfbfb]"
      >
        {content}
      </Link>
    );
  }

  return (
    <div className="p-4 border border-[#dedede] rounded-[11px] bg-white flex items-center justify-between">
      {content}
    </div>
  );
}

/** The violet progress bar used on the overview card. */
export function UsageBar({
  value,
  label,
}: {
  value: number;
  label: string;
}) {
  const percent = Math.max(0, Math.min(100, value));
  return (
    <div
      className="w-full h-2 bg-[#f2f2f2] rounded-full overflow-hidden"
      role="progressbar"
      aria-label={label}
      aria-valuenow={Math.round(percent)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full bg-[#8b5cf6] rounded-full"
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

const STATUS_TONES: Record<string, string> = {
  PAID: "bg-[#e0f2df] text-[#28a745]",
  ACTIVE: "bg-[#e0f2df] text-[#28a745]",
  TRIALING: "bg-[#e5ecff] text-[#6084ff]",
  OPEN: "bg-[#fffbeb] text-[#d77d00]",
  PENDING: "bg-[#fffbeb] text-[#d77d00]",
  DRAFT: "bg-[#f2f2f2] text-[#666]",
  PAST_DUE: "bg-[#fce5da] text-[#b42318]",
  FAILED: "bg-[#fce5da] text-[#b42318]",
  CANCELED: "bg-[#f2f2f2] text-[#666]",
  VOID: "bg-[#f2f2f2] text-[#666]",
  UNCOLLECTIBLE: "bg-[#fce5da] text-[#b42318]",
};

export function StatusPill({
  status,
  className = "px-2.5 py-0.5 rounded-full text-[11px] font-medium",
}: {
  status: string;
  className?: string;
}) {
  const tone =
    STATUS_TONES[status.toUpperCase()] ?? "bg-[#f2f2f2] text-[#666]";
  return <span className={`${className} ${tone}`}>{status}</span>;
}

/**
 * The formatters live in `@/components/billing/format` because this module is
 * a client module and a server component cannot call a client function.
 */
export { formatCompactNumber, formatMoney } from "@/components/billing/format";

export function BillingEmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="py-8 text-center">
      <p className="m-0 text-[13px] font-semibold text-[#171717]">{title}</p>
      <p className="mt-1 mb-0 text-[12px] leading-[17px] text-[#777]">
        {description}
      </p>
      {action ? <div className="mt-3 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function BillingErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="p-3 border border-[#f3c9c9] rounded-[11px] bg-[#fff4f4]"
    >
      <p className="m-0 text-[12px] font-medium text-[#b42318]">{message}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-2 h-[30px] px-3 border border-[#f3c9c9] rounded-full bg-white text-[12px] font-medium text-[#b42318] cursor-pointer hover:bg-[#fff4f4] transition-colors"
        >
          Try again
        </button>
      ) : null}
    </div>
  );
}

export function BillingNote({
  children,
  className = "m-0 text-[12px] leading-[17px] text-[#777]",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <p className={className}>{children}</p>;
}

export function BillingFooterNote({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="pt-3 border-t border-[#dedede]">
      <p className="m-0 text-[12px] leading-[17px] text-[#666]">{children}</p>
    </div>
  );
}
