import Link from "next/link";
import { auditChanges } from "@/lib/api";
import { authorizedOrganization } from "@/lib/workspace";
import { ActivityIcon } from "@/components/audit-logs/icons";
import {
  AuditPageHeader,
  EmptyState,
  OutcomeBadge,
  formatTimestamp,
} from "@/components/audit-logs/shared";

export default async function AuditChangesPage({
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
          title="Change History"
          description="Choose an organization to continue."
        />
      </div>
    );
  }

  const first = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value[0] ?? "" : value ?? "";

  const search = first(query.search).trim();
  const resourceType = first(query.resource_type).trim();
  const dateFrom = first(query.date_from).trim();
  const dateTo = first(query.date_to).trim();

  const changes = await auditChanges(org.id, {
    limit: 200,
    search: search || undefined,
    resource_type: resourceType || undefined,
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
  });

  const groups = changes?.groups ?? [];

  return (
    <div className="space-y-6">
      <AuditPageHeader
        title="Change History"
        description="Review recorded before/after changes for workspace resources."
        backHref={`/dashboard/organizations/${organizationId}/audit-logs`}
        backLabel="Back to overview"
      />

      <form
        method="get"
        action={`/dashboard/organizations/${organizationId}/audit-logs/changes`}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3"
      >
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
            Search
          </span>
          <input
            type="search"
            name="search"
            defaultValue={search}
            placeholder="Search changes..."
            className="h-9 px-3 rounded-xl border border-zinc-200 bg-white text-sm focus:border-blue-400 focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
            Resource type
          </span>
          <input
            type="text"
            name="resource_type"
            defaultValue={resourceType}
            placeholder="agent, integration..."
            className="h-9 px-3 rounded-xl border border-zinc-200 bg-white text-sm focus:border-blue-400 focus:outline-none"
          />
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
        <div className="flex items-center gap-2 sm:col-span-2 lg:col-span-4">
          <button
            type="submit"
            className="h-9 rounded-xl bg-[#4265db] px-3.5 text-xs font-semibold text-white hover:bg-[#3654c0] transition-colors"
          >
            Apply filters
          </button>
          {(search || resourceType || dateFrom || dateTo) && (
            <Link
              href={`/dashboard/organizations/${organizationId}/audit-logs/changes`}
              className="h-9 inline-flex items-center rounded-xl border border-zinc-200 px-3.5 text-xs font-semibold text-zinc-600 hover:bg-zinc-50"
            >
              Clear
            </Link>
          )}
          <span className="text-xs text-zinc-400">
            {changes?.total ?? 0} recorded{" "}
            {(changes?.total ?? 0) === 1 ? "change" : "changes"}
          </span>
        </div>
      </form>

      {groups.length === 0 ? (
        <section className="border border-zinc-200 rounded-xl overflow-hidden">
          <EmptyState
            title="No change history recorded yet"
            description="Updates that record a before/after difference are grouped here per resource."
          />
        </section>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => (
            <section
              key={`${group.resource_type}-${group.resource_id ?? "none"}`}
              className="border border-zinc-200 rounded-xl overflow-hidden"
            >
              <div className="border-b border-zinc-200 px-4 py-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <ActivityIcon className="size-4 text-[#0e9f6e]" />
                  <div>
                    <p className="text-sm font-semibold text-zinc-900">
                      {group.resource_name ?? group.resource_type}
                    </p>
                    <p className="text-[11px] text-zinc-500">
                      {group.resource_type}
                      {group.resource_id ? ` · ${group.resource_id}` : ""}
                    </p>
                  </div>
                </div>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                    group.resource_available
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : "bg-zinc-50 text-zinc-500 border-zinc-200"
                  }`}
                >
                  {group.resource_available ? "Available" : "Removed"}
                </span>
              </div>

              <ol className="divide-y divide-zinc-100">
                {group.events.map((event) => (
                  <li key={event.id} className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/dashboard/organizations/${organizationId}/audit-logs/events/${event.id}`}
                        className="text-sm font-semibold text-zinc-900 hover:text-blue-600"
                      >
                        {event.title || event.label || event.action}
                      </Link>
                      <OutcomeBadge outcome={event.outcome} />
                      <span className="ml-auto text-[11px] text-zinc-500">
                        {formatTimestamp(event.created_at)}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-zinc-500">
                      {event.actor_email ?? event.actor_name ?? "System"}
                    </p>
                    <ChangeTable changes={event.changes} />
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>
      )}

      <p className="text-center text-[11px] text-zinc-400">
        Secret values are redacted before changes are recorded.
      </p>
    </div>
  );
}

function ChangeTable({ changes }: { changes: Record<string, unknown> | null }) {
  if (!changes || Object.keys(changes).length === 0) return null;

  const before = isPlainObject(changes.before) ? changes.before : null;
  const after = isPlainObject(changes.after) ? changes.after : null;

  if (before || after) {
    const fields = Array.from(
      new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]),
    );
    if (fields.length === 0) return null;
    return (
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="text-zinc-500">
              <th className="py-1 pr-4 font-medium">Field</th>
              <th className="py-1 pr-4 font-medium">Before</th>
              <th className="py-1 font-medium">After</th>
            </tr>
          </thead>
          <tbody className="font-mono">
            {fields.map((field) => (
              <tr key={field} className="border-t border-zinc-100">
                <td className="py-1 pr-4 font-sans text-zinc-600">{field}</td>
                <td className="py-1 pr-4 text-rose-600">
                  {formatValue(before?.[field])}
                </td>
                <td className="py-1 text-emerald-600">
                  {formatValue(after?.[field])}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="mt-2 space-y-1">
      {Object.entries(changes).map(([key, value]) => (
        <div key={key} className="flex flex-wrap items-baseline gap-2 text-xs">
          <span className="font-medium text-zinc-500">{key}</span>
          <span className="font-mono text-zinc-800">
            {isPlainObject(value)
              ? Object.entries(value)
                  .map(([field, item]) => `${field}: ${formatValue(item)}`)
                  .join(", ")
              : formatValue(value)}
          </span>
        </div>
      ))}
    </div>
  );
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function formatValue(value: unknown): string {
  if (value === undefined || value === null) return "—";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    return value.length === 0 ? "—" : value.map((item) => formatValue(item)).join(", ");
  }
  return JSON.stringify(value);
}
