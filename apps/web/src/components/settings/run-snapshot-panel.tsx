"use client";

import Link from "next/link";
import {
  ConfigList,
  EmptyState,
  SettingsBanner,
  SettingsCard,
  SettingsSkeleton,
} from "@/components/settings/design";
import { useResource } from "@/components/settings/use-resource";
import { getRunSnapshots, type RunSnapshot } from "@/lib/api/settings";

/**
 * The configuration the recent runs were executed with.
 *
 * Every snapshot is frozen when the run starts, so a later settings change
 * never rewrites it.
 */
export function RunSnapshotPanel({
  organizationId,
}: {
  organizationId: string;
}) {
  const { data, loading, error } = useResource<{
    items: RunSnapshot[];
  }>(() => getRunSnapshots(organizationId), null);

  return (
    <SettingsCard
      title="Recent runs"
      description="The resolved configuration of the latest runs. A snapshot is written when a run starts and is never changed again."
      bodyClassName="divide-y divide-[#eeeeee]"
    >
      {loading ? (
        <div className="px-6 py-4">
          <SettingsSkeleton label="Loading the runs" />
        </div>
      ) : null}

      {error ? (
        <div className="px-6 py-4">
          <SettingsBanner tone="error" title="The runs could not be loaded">
            {error}
          </SettingsBanner>
        </div>
      ) : null}

      {data && data.items.length === 0 ? (
        <div className="px-6 py-4">
          <EmptyState
            title="No run recorded yet"
            description="The configuration of a run is stored here as soon as the run starts."
          />
        </div>
      ) : null}

      {(data?.items ?? []).map((snapshot) => (
        <div key={snapshot.id} className="px-6 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="m-0 text-[14px] font-medium leading-[20px] text-[#171717]">
              {snapshot.workflow_key ?? "Agent run"}
            </p>
            <span className="text-[12px] text-[#666]">
              {new Date(snapshot.created_at).toLocaleString()}
            </span>
          </div>

          <div className="mt-2">
            <ConfigList
              entries={Object.entries(snapshot.resolved_config).map(
                ([key, value]) => [
                  key,
                  <span key={key}>
                    <span className="font-mono">{String(value ?? "—")}</span>
                    <span className="ml-2 text-[#666]">
                      {snapshot.sources?.[key] ?? "resolved"}
                    </span>
                  </span>,
                ]
              )}
            />
          </div>

          <div className="mt-3 flex justify-end">
            <Link
              href={`/dashboard/organizations/${organizationId}/analytics/traces`}
              className="inline-flex h-9 items-center justify-center rounded-lg border border-[#dedede] bg-white px-3.5 text-[13px] font-medium text-[#374151] no-underline transition-colors hover:bg-[#f7f7f8]"
            >
              Open analytics
            </Link>
          </div>
        </div>
      ))}
    </SettingsCard>
  );
}
