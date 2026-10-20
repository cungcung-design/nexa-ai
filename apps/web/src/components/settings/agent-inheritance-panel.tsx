"use client";

import Link from "next/link";
import { useState } from "react";
import { BotIcon } from "@/components/settings/icons";
import {
  ConfigList,
  EmptyState,
  SettingsBanner,
  SettingsButton,
  SettingsCard,
  SourceChip,
} from "@/components/settings/design";
import { useResource } from "@/components/settings/use-resource";
import {
  getAgentConfigs,
  getEffectiveConfig,
  resetAgentOverride,
  type AgentConfigSummary,
  type EffectiveConfig,
} from "@/lib/api/settings";

/**
 * The agents of the workspace and the configuration they use.
 *
 * The panel shows whether an agent inherits the workspace default or
 * overrides it, and it opens the effective configuration of an agent.
 */
export function AgentInheritancePanel({
  organizationId,
}: {
  organizationId: string;
}) {
  const { data, loading, error, reload, setData } = useResource<{
    items: AgentConfigSummary[];
  }>(() => getAgentConfigs(organizationId), null);

  const [openAgent, setOpenAgent] = useState<string | null>(null);
  const [effective, setEffective] = useState<EffectiveConfig | null>(null);
  const [effectiveError, setEffectiveError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function open(agent: AgentConfigSummary) {
    if (!agent.published_version_id) return;
    setOpenAgent(agent.id);
    setEffective(null);
    setEffectiveError(null);
    const result = await getEffectiveConfig(
      organizationId,
      agent.id,
      agent.published_version_id
    );
    if (!result.ok || !result.data) {
      setEffectiveError(result.error ?? "The configuration could not be loaded.");
      return;
    }
    setEffective(result.data);
  }

  async function reset(agent: AgentConfigSummary) {
    if (!agent.published_version_id) return;
    setBusy(true);
    const result = await resetAgentOverride(
      organizationId,
      agent.id,
      agent.published_version_id
    );
    setBusy(false);
    if (!result.ok) {
      setEffectiveError(
        result.error ?? "The override could not be reset."
      );
      return;
    }
    setEffectiveError(null);
    const refreshed = await getAgentConfigs(organizationId);
    if (refreshed.ok && refreshed.data) setData(refreshed.data);
    setOpenAgent(null);
    setEffective(null);
  }

  return (
    <SettingsCard
      icon={<BotIcon className="size-4" />}
      title="Agent configuration"
      description="The agents of this workspace and the configuration they run with."
      bodyClassName="divide-y divide-[#eeeeee]"
    >
      {loading ? (
        <p className="m-0 px-6 py-4 text-[13px] text-[#666]">
          Loading the agents…
        </p>
      ) : null}

      {error ? (
        <div className="px-6 py-4">
          <SettingsBanner tone="error" title="The agents could not be loaded">
            {error}
          </SettingsBanner>
        </div>
      ) : null}

      {data && data.items.length === 0 ? (
        <div className="px-6 py-4">
          <EmptyState
            title="No agents yet"
            description="Create an agent to see the configuration it inherits from the workspace."
          />
        </div>
      ) : null}

      {(data?.items ?? []).map((agent) => (
        <div key={agent.id} className="px-6 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="m-0 text-[14px] font-medium leading-[20px] text-[#171717]">
                {agent.name}
              </p>
              <p className="m-0 mt-0.5 text-[12px] text-[#666]">
                {agent.published_version_id
                  ? `Published version v${agent.version_number}`
                  : "No published version"}
              </p>
            </div>
            <SourceChip inherited={agent.inherited} />
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
            <SettingsButton
              variant="secondary"
              onClick={() => void open(agent)}
              disabled={!agent.published_version_id}
            >
              Effective configuration
            </SettingsButton>
            <SettingsButton
              variant="secondary"
              onClick={() => void reset(agent)}
              disabled={busy || agent.inherited}
            >
              Reset to inherited
            </SettingsButton>
            <Link
              href={`/dashboard/organizations/${organizationId}/agents/${agent.id}`}
              className="inline-flex h-9 items-center justify-center rounded-lg border border-[#dedede] bg-white px-3.5 text-[13px] font-medium text-[#374151] no-underline transition-colors hover:bg-[#f7f7f8]"
            >
              Open agent
            </Link>
          </div>

          {openAgent === agent.id ? (
            <div className="mt-3 border-t border-[#eeeeee] pt-3">
              {effectiveError ? (
                <SettingsBanner tone="error">{effectiveError}</SettingsBanner>
              ) : null}
              {effective ? (
                <ConfigList
                  entries={Object.entries(effective.settings).map(
                    ([key, setting]) => [
                      key,
                      <span key={key}>
                        <span className="font-mono">
                          {String(setting.value ?? "—")}
                        </span>
                        <span className="ml-2 text-[#666]">
                          {setting.source_label}
                          {setting.locked_by_policy
                            ? " (locked by the workspace policy)"
                            : ""}
                        </span>
                      </span>,
                    ]
                  )}
                />
              ) : null}
            </div>
          ) : null}
        </div>
      ))}
    </SettingsCard>
  );
}
