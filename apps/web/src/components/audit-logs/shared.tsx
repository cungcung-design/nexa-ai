import Link from "next/link";
import { ChevronRightIcon, EventIcon } from "@/components/audit-logs/icons";
import { RelativeTime } from "@/components/audit-logs/relative-time";

export type AuditEventItem = {
  id: string;
  event_id: string | null;
  organization_id: string;
  actor_user_id: string | null;
  actor_type: string;
  actor_name: string | null;
  actor_email: string | null;
  action: string;
  title: string;
  label: string;
  summary: string | null;
  category: string;
  categories: string[];
  outcome: string;
  resource_type: string;
  resource_id: string | null;
  resource_name: string | null;
  resource_available: boolean;
  source: string;
  details: Record<string, unknown> | null;
  changes: Record<string, unknown> | null;
  created_at: string;
};

export const CATEGORY_LABELS: Record<string, string> = {
  authentication: "Authentication",
  permissions_roles: "Permissions & Roles",
  credentials_api_keys: "Credentials & API Keys",
  sensitive_operations: "Sensitive Operations",
  integration_security: "Integration Security",
  agents: "AI Agents",
  workflows: "Workflows",
  integrations: "Integrations",
  approvals: "Approvals",
  knowledge: "Knowledge Base",
  access: "Access & Roles",
  billing: "Billing",
  other: "Other",
};

export const SECURITY_CATEGORY_IDS = [
  "authentication",
  "permissions_roles",
  "credentials_api_keys",
  "sensitive_operations",
  "integration_security",
] as const;

export const CATEGORY_TONES: Record<string, string> = {
  authentication: "bg-[#f1f5ff] text-[#4265db] border-[#dbe4ff]",
  permissions_roles: "bg-[#faf3ff] text-[#a033ff] border-[#f0dcff]",
  credentials_api_keys: "bg-[#fff8ed] text-[#ed6500] border-[#ffe4c2]",
  sensitive_operations: "bg-[#fff2f3] text-[#f02030] border-[#ffd6d9]",
  integration_security: "bg-[#eefdf5] text-[#2da467] border-[#c9f2dd]",
  agents: "bg-[#f3efff] text-[#795cff] border-[#e0d8ff]",
  workflows: "bg-[#f1f5ff] text-[#4265db] border-[#dbe4ff]",
  integrations: "bg-[#fff5eb] text-[#f07836] border-[#ffe2c8]",
  approvals: "bg-[#effdf1] text-[#48b953] border-[#cef5d7]",
  knowledge: "bg-[#eefdf5] text-[#0e9f6e] border-[#c6f2e2]",
  access: "bg-[#faf3ff] text-[#a033ff] border-[#f0dcff]",
  billing: "bg-[#f1f5f9] text-[#64748b] border-[#e2e8f0]",
  other: "bg-[#f3f4f6] text-[#6b7280] border-[#e5e7eb]",
};

export function categoryLabel(category: string | null | undefined): string {
  if (!category) return "Other";
  return CATEGORY_LABELS[category] ?? category.replace(/_/g, " ");
}

export function formatTimestamp(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatRelative(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const seconds = Math.round((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.round(months / 12)}y ago`;
}

export function OutcomeBadge({ outcome }: { outcome: string }) {
  const tone =
    outcome === "success"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : outcome === "denied"
        ? "bg-amber-50 text-amber-700 border-amber-200"
        : "bg-rose-50 text-rose-700 border-rose-200";
  return (
    <span
      className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold border capitalize ${tone}`}
    >
      {outcome}
    </span>
  );
}

export function CategoryBadge({ category }: { category: string }) {
  return (
    <span
      className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
        CATEGORY_TONES[category] ?? CATEGORY_TONES.other
      }`}
    >
      {categoryLabel(category)}
    </span>
  );
}

export function AuditPageHeader({
  eyebrow,
  title,
  description,
  backHref,
  backLabel,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  backHref?: string;
  backLabel?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        {backHref ? (
          <Link
            href={backHref}
            className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:underline mb-2"
          >
            ← {backLabel ?? "Back"}
          </Link>
        ) : null}
        <p className="text-xs font-semibold uppercase tracking-widest text-violet-400">
          {eyebrow ?? "Security & Compliance"}
        </p>
        <h1 className="mt-2 text-3xl font-bold text-gray-900 tracking-tight">{title}</h1>
        {description ? (
          <p className="mt-2 text-sm text-gray-500">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function MetricCard({
  label,
  value,
  hint,
  icon,
  tone,
}: {
  label: string;
  value: number | string;
  hint?: string;
  icon: React.ReactNode;
  tone: string;
}) {
  return (
    <div className={`rounded-xl border p-4 ${tone}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-zinc-500">{label}</p>
          <p className="mt-1 text-2xl font-bold text-zinc-900">{value}</p>
          {hint ? <p className="mt-0.5 text-[11px] text-zinc-500">{hint}</p> : null}
        </div>
        <div className="shrink-0 rounded-lg bg-white/70 p-2">{icon}</div>
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="p-10 text-center">
      <EventIcon className="mx-auto mb-3 size-7 text-zinc-300" />
      <p className="text-sm font-medium text-zinc-700">{title}</p>
      {description ? (
        <p className="mt-1 text-xs text-zinc-500">{description}</p>
      ) : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function AuditEventRow({
  event,
  href,
  showCategory = true,
}: {
  event: AuditEventItem;
  href: string;
  showCategory?: boolean;
}) {
  return (
    <Link
      href={href}
      className="block px-4 py-3 hover:bg-zinc-50 transition-colors"
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-zinc-900 truncate">
              {event.title || event.label || event.action}
            </p>
            {showCategory ? <CategoryBadge category={event.category} /> : null}
            <OutcomeBadge outcome={event.outcome} />
          </div>
          <p className="mt-0.5 text-xs text-zinc-500 truncate">
            {event.event_id ? `${event.event_id} · ` : ""}
            {event.actor_email ?? event.actor_name ?? "System"} ·{" "}
            {event.resource_name ?? event.resource_type} ·{" "}
            <RelativeTime iso={event.created_at} />
          </p>
        </div>
        <ChevronRightIcon className="mt-1 size-4 text-zinc-300 shrink-0" />
      </div>
    </Link>
  );
}

export function Pagination({
  page,
  pageCount,
  total,
  limit,
  offset,
  buildHref,
}: {
  page: number;
  pageCount: number;
  total: number;
  limit: number;
  offset: number;
  buildHref: (params: { limit: number; offset: number }) => string;
}) {
  if (total === 0) return null;

  const from = total === 0 ? 0 : offset + 1;
  const to = Math.min(offset + limit, total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 px-4 py-3">
      <p className="text-xs text-zinc-500">
        Showing <span className="font-semibold text-zinc-700">{from}</span>–
        <span className="font-semibold text-zinc-700">{to}</span> of{" "}
        <span className="font-semibold text-zinc-700">{total}</span> events
      </p>
      <div className="flex items-center gap-2">
        <Link
          href={buildHref({ limit, offset: Math.max(0, offset - limit) })}
          aria-disabled={page <= 1}
          className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium ${
            page <= 1
              ? "pointer-events-none border-zinc-100 text-zinc-300"
              : "border-zinc-200 text-zinc-600 hover:bg-zinc-50"
          }`}
        >
          Previous
        </Link>
        <span className="text-xs text-zinc-500">
          Page {page} of {Math.max(pageCount, 1)}
        </span>
        <Link
          href={buildHref({ limit, offset: offset + limit })}
          aria-disabled={page >= pageCount}
          className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium ${
            page >= pageCount
              ? "pointer-events-none border-zinc-100 text-zinc-300"
              : "border-zinc-200 text-zinc-600 hover:bg-zinc-50"
          }`}
        >
          Next
        </Link>
      </div>
    </div>
  );
}

export function DetailRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-3 py-1.5">
      <span className="text-xs font-medium text-zinc-500">{label}</span>
      <span
        className={`text-sm text-zinc-900 text-right break-all ${
          mono ? "font-mono text-xs" : ""
        }`}
      >
        {value}
      </span>
    </div>
  );
}
