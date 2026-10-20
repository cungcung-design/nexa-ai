import Link from "next/link";
import { auditCategories, auditEvents } from "@/lib/api";
import { authorizedOrganization } from "@/lib/workspace";
import { SearchIcon } from "@/components/audit-logs/icons";
import {
  AuditEventRow,
  AuditPageHeader,
  EmptyState,
  Pagination,
  SECURITY_CATEGORY_IDS,
} from "@/components/audit-logs/shared";

const PAGE_SIZE = 20;

const OUTCOME_OPTIONS = [
  { value: "", label: "Any outcome" },
  { value: "success", label: "Success" },
  { value: "failed", label: "Failed" },
  { value: "denied", label: "Denied" },
];

export default async function AuditEventsPage({
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
          title="Event Explorer"
          description="Choose an organization to continue."
        />
      </div>
    );
  }

  const first = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value[0] ?? "" : value ?? "";

  const search = first(query.search).trim();
  const category = first(query.category).trim();
  const outcome = first(query.outcome).trim();
  const resourceType = first(query.resource_type).trim();
  const dateFrom = first(query.date_from).trim();
  const dateTo = first(query.date_to).trim();
  const offset = Math.max(0, Number(first(query.offset)) || 0);

  const [events, categories] = await Promise.all([
    auditEvents(org.id, {
      limit: PAGE_SIZE,
      offset,
      search: search || undefined,
      category: category || undefined,
      outcome: outcome || undefined,
      resource_type: resourceType || undefined,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
    }),
    auditCategories(org.id),
  ]);

  const items = events?.items ?? [];
  const total = events?.total ?? 0;
  const page = events?.page ?? 1;
  const pageCount = events?.page_count ?? 0;

  const buildHref = (next: { limit: number; offset: number }) => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (category) params.set("category", category);
    if (outcome) params.set("outcome", outcome);
    if (resourceType) params.set("resource_type", resourceType);
    if (dateFrom) params.set("date_from", dateFrom);
    if (dateTo) params.set("date_to", dateTo);
    params.set("limit", String(next.limit));
    params.set("offset", String(next.offset));
    return `/dashboard/organizations/${organizationId}/audit-logs/events?${params.toString()}`;
  };

  const selectableCategories = categories.filter(
    (entry) => entry.event_count > 0 || SECURITY_CATEGORY_IDS.includes(entry.id as never),
  );

  return (
    <div className="space-y-6">
      <AuditPageHeader
        title="Event Explorer"
        description="Investigate workspace activity and security events."
        backHref={`/dashboard/organizations/${organizationId}/audit-logs`}
        backLabel="Back to overview"
      />

      <form
        method="get"
        action={`/dashboard/organizations/${organizationId}/audit-logs/events`}
        className="space-y-3"
      >
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
          <input
            type="search"
            name="search"
            defaultValue={search}
            placeholder="Search event, reference, actor or resource..."
            className="w-full h-10 pl-9 pr-3 rounded-xl border border-zinc-200 bg-white text-sm focus:border-blue-400 focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              Category
            </span>
            <select
              name="category"
              defaultValue={category}
              className="h-9 px-3 rounded-xl border border-zinc-200 bg-white text-sm focus:border-blue-400 focus:outline-none"
            >
              <option value="">All categories</option>
              {selectableCategories.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.name} ({entry.event_count})
                </option>
              ))}
            </select>
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
              {OUTCOME_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              From
            </span>
            <input
              type="date"
              name="date_from"
              defaultValue={dateFrom}
              className="h-9 px-3 rounded-xl border border-zinc-200 bg-white text-sm focus:border-blue-400 focus:outline-none"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              To
            </span>
            <input
              type="date"
              name="date_to"
              defaultValue={dateTo}
              className="h-9 px-3 rounded-xl border border-zinc-200 bg-white text-sm focus:border-blue-400 focus:outline-none"
            />
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="submit"
            className="inline-flex h-9 items-center rounded-xl bg-[#4265db] px-3.5 text-xs font-semibold text-white hover:bg-[#3654c0] transition-colors"
          >
            Apply filters
          </button>
          {(search || category || outcome || resourceType || dateFrom || dateTo) && (
            <Link
              href={`/dashboard/organizations/${organizationId}/audit-logs/events`}
              className="inline-flex h-9 items-center rounded-xl border border-zinc-200 px-3.5 text-xs font-semibold text-zinc-600 hover:bg-zinc-50"
            >
              Clear
            </Link>
          )}
          <span className="text-xs text-zinc-400">
            {total} matching {total === 1 ? "event" : "events"}
          </span>
        </div>
      </form>

      <section className="border border-zinc-200 rounded-xl overflow-hidden">
        {items.length === 0 ? (
          <EmptyState
            title="No matching events"
            description="Adjust the filters or widen the date range to see more activity."
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
        Filters are applied on the server. Click an event to view full details.
      </p>
    </div>
  );
}
