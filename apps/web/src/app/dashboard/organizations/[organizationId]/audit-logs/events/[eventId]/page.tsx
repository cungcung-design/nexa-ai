import Link from "next/link";
import { auditEvent } from "@/lib/api";
import { authorizedOrganization } from "@/lib/workspace";
import { ChevronRightIcon, InfoIcon } from "@/components/audit-logs/icons";
import {
  AuditPageHeader,
  CategoryBadge,
  DetailRow,
  OutcomeBadge,
  categoryLabel,
  formatTimestamp,
} from "@/components/audit-logs/shared";

export default async function AuditEventDetailPage({
  params,
}: {
  params: Promise<{ organizationId: string; eventId: string }>;
}) {
  const { organizationId, eventId } = await params;
  const org = await authorizedOrganization(organizationId);
  const event = org ? await auditEvent(org.id, eventId) : null;

  if (!org) {
    return (
      <div className="space-y-6">
        <AuditPageHeader
          title="Event Details"
          description="Choose an organization to continue."
        />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="space-y-6">
        <AuditPageHeader
          title="Event Not Found"
          description="This event does not exist in the current workspace."
          backHref={`/dashboard/organizations/${organizationId}/audit-logs/events`}
          backLabel="Back to events"
        />
      </div>
    );
  }

  const details = event.details ?? {};
  const detailEntries = Object.entries(details).filter(
    ([key]) => key !== "title" && key !== "summary",
  );
  const changes = event.changes ?? null;
  const changeGroups = changes ? splitChanges(changes) : [];
  const categories = event.categories?.length ? event.categories : [event.category];

  return (
    <div className="space-y-6">
      <AuditPageHeader
        title={event.title || event.label || event.action}
        description={event.summary ?? undefined}
        backHref={`/dashboard/organizations/${organizationId}/audit-logs/events`}
        backLabel="Back to events"
        actions={<OutcomeBadge outcome={event.outcome} />}
      />

      <div className="flex flex-wrap items-center gap-2">
        {categories.map((category) => (
          <CategoryBadge key={category} category={category} />
        ))}
        {event.event_id ? (
          <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 font-mono text-[10px] font-semibold text-zinc-600">
            {event.event_id}
          </span>
        ) : null}
      </div>

      <section className="border border-zinc-200 rounded-xl overflow-hidden">
        <div className="border-b border-zinc-200 px-4 py-3 flex items-center gap-2">
          <InfoIcon className="size-4 text-[#795cff]" />
          <h3 className="text-sm font-semibold text-zinc-900">Event Summary</h3>
        </div>
        <p className="px-4 py-3 text-sm text-zinc-700">
          {event.summary ??
            `A ${event.label || event.action} event was recorded for this workspace.`}
        </p>
      </section>

      <section className="border border-zinc-200 rounded-xl overflow-hidden">
        <div className="border-b border-zinc-200 px-4 py-3">
          <h3 className="text-sm font-semibold text-zinc-900">Event Parameters</h3>
        </div>
        <div className="divide-y divide-zinc-100 px-4 py-2">
          <DetailRow label="Event Reference" value={event.event_id ?? "—"} mono />
          <DetailRow label="Event ID" value={event.id} mono />
          <DetailRow label="Action" value={event.action} mono />
          <DetailRow
            label="Category"
            value={categories.map(categoryLabel).join(", ")}
          />
          <DetailRow label="Outcome" value={event.outcome} />
          <DetailRow label="Source" value={event.source} />
          <DetailRow label="Resource Type" value={event.resource_type} />
          <DetailRow label="Resource ID" value={event.resource_id ?? "—"} mono />
          <DetailRow
            label="Resource Name"
            value={event.resource_name ?? "Unavailable resource"}
          />
          <DetailRow
            label="Resource Status"
            value={
              event.resource_available
                ? "Available in workspace"
                : "No longer available"
            }
          />
          <DetailRow label="Actor Type" value={event.actor_type} />
          <DetailRow label="Actor" value={event.actor_email ?? event.actor_name ?? "System"} />
          <DetailRow label="Actor ID" value={event.actor_user_id ?? "—"} mono />
          <DetailRow label="Organization" value={event.organization_id} mono />
          <DetailRow label="Recorded At" value={formatTimestamp(event.created_at)} />
        </div>
      </section>

      {detailEntries.length > 0 ? (
        <section className="border border-zinc-200 rounded-xl overflow-hidden">
          <div className="border-b border-zinc-200 px-4 py-3">
            <h3 className="text-sm font-semibold text-zinc-900">Recorded Details</h3>
          </div>
          <div className="divide-y divide-zinc-100 px-4 py-2">
            {detailEntries.map(([key, value]) => (
              <DetailRow
                key={key}
                label={key}
                value={renderValue(value)}
                mono={typeof value !== "string"}
              />
            ))}
          </div>
        </section>
      ) : null}

      {changeGroups.length > 0 ? (
        <section className="border border-zinc-200 rounded-xl overflow-hidden">
          <div className="border-b border-zinc-200 px-4 py-3">
            <h3 className="text-sm font-semibold text-zinc-900">Recorded Changes</h3>
          </div>
          <div className="divide-y divide-zinc-100">
            {changeGroups.map((group) => (
              <div key={group.label} className="px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                  {group.label}
                </p>
                {group.rows.length === 0 ? (
                  <p className="mt-1 font-mono text-xs text-zinc-500">
                    {renderValue(group.value)}
                  </p>
                ) : (
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
                        {group.rows.map((row) => (
                          <tr key={row.field} className="border-t border-zinc-100">
                            <td className="py-1 pr-4 font-sans text-zinc-600">
                              {row.field}
                            </td>
                            <td className="py-1 pr-4 text-rose-600">
                              {row.before ?? "—"}
                            </td>
                            <td className="py-1 text-emerald-600">
                              {row.after ?? "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-3">
        <RelatedLink
          title="Event Explorer"
          href={`/dashboard/organizations/${organizationId}/audit-logs/events`}
          label="Browse all events"
        />
        <RelatedLink
          title="Security Events"
          href={`/dashboard/organizations/${organizationId}/audit-logs/security`}
          label="View security categories"
        />
        <RelatedLink
          title="Change History"
          href={`/dashboard/organizations/${organizationId}/audit-logs/changes`}
          label="Review configuration changes"
        />
      </section>
    </div>
  );
}

type ChangeGroup = {
  label: string;
  value: unknown;
  rows: { field: string; before: string | null; after: string | null }[];
};

/**
 * Audit payloads store changes either as a flat field map or as a
 * `before`/`after` pair. Both shapes are rendered as a field diff.
 */
function splitChanges(changes: Record<string, unknown>): ChangeGroup[] {
  const before = changes.before;
  const after = changes.after;

  if (
    (isPlainObject(before) || isPlainObject(after)) &&
    (isPlainObject(before) || isPlainObject(after))
  ) {
    const beforeMap = isPlainObject(before) ? before : {};
    const afterMap = isPlainObject(after) ? after : {};
    const fields = Array.from(
      new Set([...Object.keys(beforeMap), ...Object.keys(afterMap)]),
    );
    const rows = fields.map((field) => ({
      field,
      before: formatChangeValue(beforeMap[field]),
      after: formatChangeValue(afterMap[field]),
    }));
    return [{ label: "Before / after", value: null, rows }];
  }

  return Object.entries(changes).map(([key, value]) => {
    if (isPlainObject(value)) {
      const rows = Object.entries(value).map(([field, item]) => ({
        field,
        before: null,
        after: formatChangeValue(item),
      }));
      return { label: key, value: null, rows };
    }
    return { label: key, value, rows: [] };
  });
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function formatChangeValue(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

function renderValue(value: unknown): React.ReactNode {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    return value.length === 0 ? "—" : value.map(renderValue).join(", ");
  }
  return JSON.stringify(value);
}

function RelatedLink({
  title,
  href,
  label,
}: {
  title: string;
  href: string;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="group block rounded-xl border border-zinc-200 bg-white p-4 hover:border-blue-300 transition-colors"
    >
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-semibold text-zinc-900">{title}</p>
        <ChevronRightIcon className="size-4 text-zinc-400 group-hover:text-blue-600" />
      </div>
      <p className="text-xs text-zinc-500">{label}</p>
    </Link>
  );
}
