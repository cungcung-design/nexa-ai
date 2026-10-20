import Link from "next/link";
import {
  auditActivity,
  auditCategories,
  auditEvents,
  auditStats,
} from "@/lib/api";
import { authorizedOrganization } from "@/lib/workspace";
import {
  ActivityIcon,
  DownloadIcon,
  FailedIcon,
  ScrollIcon,
  ShieldIcon,
  UsersIcon,
} from "@/components/audit-logs/icons";
import {
  AuditEventRow,
  AuditPageHeader,
  CATEGORY_TONES,
  EmptyState,
  MetricCard,
  categoryLabel,
  formatTimestamp,
} from "@/components/audit-logs/shared";

export default async function AuditOverviewPage({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;
  const org = await authorizedOrganization(organizationId);

  if (!org) {
    return (
      <div className="space-y-6">
        <AuditPageHeader
          title="Audit Logs"
          description="Choose an organization to continue."
        />
      </div>
    );
  }

  const [stats, activity, categories, recent] = await Promise.all([
    auditStats(org.id),
    auditActivity(org.id, { days: 7 }),
    auditCategories(org.id),
    auditEvents(org.id, { limit: 8 }),
  ]);

  const points = activity?.points ?? [];
  const maxCount = Math.max(1, ...points.map((point) => point.count));
  const recentEvents = recent?.items ?? [];
  const newestEvent = recentEvents[0];
  const totalEvents = stats?.total_events ?? 0;

  const securityCategories = categories.filter((category) =>
    ["authentication", "permissions_roles", "credentials_api_keys", "sensitive_operations", "integration_security"].includes(
      category.id,
    ),
  );

  return (
    <div className="space-y-6">
      <AuditPageHeader
        title="Audit Logs"
        description="Monitor security events and investigate workspace activity."
        actions={
          <Link
            href={`/dashboard/organizations/${organizationId}/audit-logs/events`}
            className="inline-flex items-center gap-2 rounded-xl bg-[#4265db] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#3654c0] transition-colors"
          >
            Open Event Explorer
          </Link>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <MetricCard
          label="Total Events"
          value={totalEvents}
          icon={<ScrollIcon className="text-[#795cff]" size={16} />}
          tone="text-[#795cff] bg-[#f3efff] border-[#e0d8ff]"
        />
        <MetricCard
          label="Security Events"
          value={stats?.security_events ?? 0}
          icon={<ShieldIcon className="text-[#f07836]" size={16} />}
          tone="text-[#f07836] bg-[#fff5eb] border-[#ffe2c8]"
        />
        <MetricCard
          label="Failed Actions"
          value={stats?.failed_actions ?? 0}
          icon={<FailedIcon className="text-[#f02030]" size={16} />}
          tone="text-[#f02030] bg-[#fff2f3] border-[#ffd6d9]"
        />
        <MetricCard
          label="Active Actors"
          value={stats?.active_actors ?? 0}
          icon={<UsersIcon className="text-[#48b953]" size={16} />}
          tone="text-[#48b953] bg-[#effdf1] border-[#cef5d7]"
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <section className="xl:col-span-2 border border-zinc-200 rounded-xl overflow-hidden">
          <div className="border-b border-zinc-200 px-4 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <ActivityIcon className="size-4 text-[#4265db]" />
              <h2 className="text-sm font-semibold text-zinc-900">Audit Activity</h2>
            </div>
            <span className="px-2.5 py-0.5 rounded-full bg-zinc-100 text-[10px] font-semibold text-zinc-600">
              Last {activity?.days ?? 7} days
            </span>
          </div>
          {points.length === 0 ? (
            <EmptyState
              title="No activity recorded yet"
              description="Events appear here as soon as workspace activity is logged."
            />
          ) : (
            <div className="p-4">
              <div className="flex h-40 items-end gap-2">
                {points.map((point) => {
                  const height = Math.round((point.count / maxCount) * 100);
                  return (
                    <div
                      key={point.date}
                      className="flex flex-1 flex-col items-center justify-end gap-2"
                      title={`${point.date}: ${point.count} events`}
                    >
                      <span className="text-[10px] font-semibold text-zinc-500">
                        {point.count}
                      </span>
                      <div
                        className="w-full rounded-t-md bg-[#dbe4ff] transition-all"
                        style={{ height: `${Math.max(height, 2)}%` }}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="mt-2 flex gap-2">
                {points.map((point) => (
                  <span
                    key={point.date}
                    className="flex-1 text-center text-[10px] text-zinc-500"
                  >
                    {point.label}
                  </span>
                ))}
              </div>
            </div>
          )}
        </section>

        <section className="border border-zinc-200 rounded-xl overflow-hidden">
          <div className="border-b border-zinc-200 px-4 py-3 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-zinc-900">Security Categories</h2>
            <Link
              href={`/dashboard/organizations/${organizationId}/audit-logs/security`}
              className="text-xs text-blue-600 hover:underline"
            >
              View all
            </Link>
          </div>
          {securityCategories.length === 0 ? (
            <EmptyState title="No security categories available" />
          ) : (
            <ul className="divide-y divide-zinc-100">
              {securityCategories.map((category) => (
                <li key={category.id}>
                  <Link
                    href={`/dashboard/organizations/${organizationId}/audit-logs/security?category=${category.id}`}
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-zinc-50 transition-colors"
                  >
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${CATEGORY_TONES[category.id] ?? CATEGORY_TONES.other}`}
                    >
                      {categoryLabel(category.id)}
                    </span>
                    <span className="ml-auto text-xs font-semibold text-zinc-700">
                      {category.event_count}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="border border-zinc-200 rounded-xl overflow-hidden">
        <div className="border-b border-zinc-200 px-4 py-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-zinc-900">Recent Events</h2>
          <Link
            href={`/dashboard/organizations/${organizationId}/audit-logs/events`}
            className="text-xs text-blue-600 hover:underline"
          >
            View all
          </Link>
        </div>
        {recentEvents.length === 0 ? (
          <EmptyState
            title="No events recorded yet"
            description="Activity in this workspace will appear here automatically."
          />
        ) : (
          <div className="divide-y divide-zinc-100">
            {recentEvents.map((event) => (
              <AuditEventRow
                key={event.id}
                event={event}
                href={`/dashboard/organizations/${organizationId}/audit-logs/events/${event.id}`}
              />
            ))}
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <ShortcutCard
          href={`/dashboard/organizations/${organizationId}/audit-logs/events`}
          title="Event Explorer"
          description="Search and filter every recorded event."
          icon={<ScrollIcon className="size-4 text-[#795cff]" size={16} />}
        />
        <ShortcutCard
          href={`/dashboard/organizations/${organizationId}/audit-logs/changes`}
          title="Change History"
          description="Review before/after configuration changes."
          icon={<ActivityIcon className="size-4 text-[#0e9f6e]" size={16} />}
        />
        <ShortcutCard
          href={`/dashboard/organizations/${organizationId}/audit-logs/exports`}
          title="Exports"
          description="Export audit records for compliance review."
          icon={<DownloadIcon className="size-4 text-[#4265db]" size={16} />}
        />
      </div>

      <p className="text-center text-[11px] text-zinc-400">
        Audit records are scoped to this workspace. Secret values are redacted
        before they are stored or exported.
        {newestEvent ? (
          <>
            {" "}
            Most recent event: {formatTimestamp(newestEvent.created_at)}.
          </>
        ) : null}
      </p>
    </div>
  );
}

function ShortcutCard({
  href,
  title,
  description,
  icon,
}: {
  href: string;
  title: string;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group rounded-xl border border-zinc-200 bg-white p-4 transition-colors hover:border-blue-300"
    >
      <div className="flex items-center gap-2">
        <span className="rounded-lg bg-zinc-50 p-2">{icon}</span>
        <p className="text-sm font-semibold text-zinc-900">{title}</p>
      </div>
      <p className="mt-2 text-xs text-zinc-500">{description}</p>
    </Link>
  );
}
