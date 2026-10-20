import Link from "next/link";
import { auditCategories, auditEvents } from "@/lib/api";
import { authorizedOrganization } from "@/lib/workspace";
import {
  AuthIcon,
  CredentialsIcon,
  IntegrationIcon,
  PermissionsIcon,
  SensitiveIcon,
} from "@/components/audit-logs/icons";
import {
  AuditEventRow,
  AuditPageHeader,
  EmptyState,
  Pagination,
  SECURITY_CATEGORY_IDS,
  categoryLabel,
} from "@/components/audit-logs/shared";

const PAGE_SIZE = 20;

const SECURITY_ICON_MAP: Record<string, React.ComponentType<{ className?: string; size?: number }>> = {
  authentication: AuthIcon,
  permissions_roles: PermissionsIcon,
  credentials_api_keys: CredentialsIcon,
  sensitive_operations: SensitiveIcon,
  integration_security: IntegrationIcon,
};

export default async function AuditSecurityPage({
  params,
  searchParams,
}: {
  params: Promise<{ organizationId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { organizationId } = await params;
  const query = await searchParams;
  const org = await authorizedOrganization(organizationId);

  if (!org) {
    return (
      <div className="space-y-6">
        <AuditPageHeader
          title="Security Events"
          description="Choose an organization to continue."
        />
      </div>
    );
  }

  const first = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value[0] ?? "" : value ?? "";

  const selected = first(query.category).trim();
  const outcome = first(query.outcome).trim();
  const search = first(query.search).trim();
  const offset = Math.max(0, Number(first(query.offset)) || 0);

  const [categories, events] = await Promise.all([
    auditCategories(org.id),
    auditEvents(org.id, {
      limit: PAGE_SIZE,
      offset,
      category: selected || SECURITY_CATEGORY_IDS.join(","),
      outcome: outcome || undefined,
      search: search || undefined,
    }),
  ]);

  const items = events?.items ?? [];
  const total = events?.total ?? 0;
  const page = events?.page ?? 1;
  const pageCount = events?.page_count ?? 0;
  const securityCategories = categories.filter((entry) =>
    SECURITY_CATEGORY_IDS.includes(entry.id as never),
  );

  const buildHref = (next: { limit: number; offset: number }) => {
    const params = new URLSearchParams();
    if (selected) params.set("category", selected);
    if (outcome) params.set("outcome", outcome);
    if (search) params.set("search", search);
    params.set("limit", String(next.limit));
    params.set("offset", String(next.offset));
    return `/dashboard/organizations/${organizationId}/audit-logs/security?${params.toString()}`;
  };

  return (
    <div className="space-y-6">
      <AuditPageHeader
        title="Security Events"
        description="Browse security event categories and investigate matching records."
        backHref={`/dashboard/organizations/${organizationId}/audit-logs`}
        backLabel="Back to overview"
      />

      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {securityCategories.map((category) => {
          const Icon = SECURITY_ICON_MAP[category.id] ?? SensitiveIcon;
          const active = selected === category.id;
          const href = active
            ? `/dashboard/organizations/${organizationId}/audit-logs/security`
            : `/dashboard/organizations/${organizationId}/audit-logs/security?category=${category.id}`;
          return (
            <Link
              key={category.id}
              href={href}
              className={`rounded-xl border p-4 transition-colors ${
                active
                  ? "border-[#4265db] bg-[#f1f5ff]"
                  : "border-zinc-200 bg-white hover:border-blue-300"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <span
                  className="flex size-11 items-center justify-center rounded-xl"
                  style={{ backgroundColor: category.bg, color: category.color }}
                >
                  <Icon className="size-6" size={22} />
                </span>
                <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-xs font-semibold text-zinc-700">
                  {category.event_count}
                </span>
              </div>
              <p className="mt-3 text-sm font-semibold text-zinc-900">
                {category.name}
              </p>
              <p className="mt-1 text-xs text-zinc-500">{category.description}</p>
            </Link>
          );
        })}
      </section>

      <form
        method="get"
        action={`/dashboard/organizations/${organizationId}/audit-logs/security`}
        className="flex flex-wrap items-end gap-3"
      >
        {selected ? <input type="hidden" name="category" value={selected} /> : null}
        <label className="flex flex-1 min-w-[220px] flex-col gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
            Search
          </span>
          <input
            type="search"
            name="search"
            defaultValue={search}
            placeholder="Search security events..."
            className="h-9 px-3 rounded-xl border border-zinc-200 bg-white text-sm focus:border-blue-400 focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
            Outcome
          </span>
          <select
            name="outcome"
            defaultValue={outcome}
            className="h-9 px-3 rounded-xl border border-zinc-200 bg-white text-sm focus:border-blue-400 focus:outline-none"
          >
            <option value="">Any outcome</option>
            <option value="success">Success</option>
            <option value="failed">Failed</option>
            <option value="denied">Denied</option>
          </select>
        </label>
        <button
          type="submit"
          className="h-9 rounded-xl bg-[#4265db] px-3.5 text-xs font-semibold text-white hover:bg-[#3654c0] transition-colors"
        >
          Apply
        </button>
        {selected ? (
          <Link
            href={`/dashboard/organizations/${organizationId}/audit-logs/security`}
            className="h-9 inline-flex items-center rounded-xl border border-zinc-200 px-3.5 text-xs font-semibold text-zinc-600 hover:bg-zinc-50"
          >
            Clear category
          </Link>
        ) : null}
        <span className="text-xs text-zinc-400">
          {total} matching {total === 1 ? "event" : "events"}
        </span>
      </form>

      <section className="border border-zinc-200 rounded-xl overflow-hidden">
        {items.length === 0 ? (
          <EmptyState
            title="No security events recorded yet"
            description="Sign-ins, permission changes, credential updates and other protected actions appear here."
          />
        ) : (
          <div className="divide-y divide-zinc-100">
            {items.map((event) => (
              <AuditEventRow
                key={event.id}
                event={event}
                href={`/dashboard/organizations/${organizationId}/audit-logs/events/${event.id}`}
              />
            ))}
          </div>
        )}
        <Pagination
          page={page}
          pageCount={pageCount}
          total={total}
          limit={PAGE_SIZE}
          offset={offset}
          buildHref={buildHref}
        />
      </section>

      <p className="text-center text-[11px] text-zinc-400">
        Security events are filtered server-side across{" "}
        {securityCategories.map((entry) => categoryLabel(entry.id)).join(", ")}.
      </p>
    </div>
  );
}
