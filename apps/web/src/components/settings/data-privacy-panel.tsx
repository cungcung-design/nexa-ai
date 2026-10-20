"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { DatabaseIcon } from "@/components/settings/icons";
import {
  SaveBar,
  SettingsBanner,
  SettingsButton,
  SettingsCard,
  SettingsChip,
  SettingsField,
  SettingsInput,
  SettingsRow,
  SettingsSkeleton,
  SettingsSwitch,
  useUnsavedChanges,
} from "@/components/settings/design";
import { useResource } from "@/components/settings/use-resource";
import {
  getWorkspaceSettings,
  saveWorkspaceSettings,
  type WorkspaceSettings,
} from "@/lib/api/settings";

/**
 * The data and privacy policy of the workspace.
 */
export function DataPrivacyPanel({
  organizationId,
  initial,
}: {
  organizationId: string;
  initial: WorkspaceSettings | null;
}) {
  const { data, loading, error, reload, setData } =
    useResource<WorkspaceSettings>(
      () => getWorkspaceSettings(organizationId),
      initial
    );

  const [retention, setRetention] = useState<string | null>(null);
  const [allowExport, setAllowExport] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);
  const [validation, setValidation] = useState<string | null>(null);

  const currentRetention = retention ?? String(data?.data.retention_days ?? 365);
  const currentAllowExport = allowExport ?? data?.data.allow_data_export ?? true;

  const dirty = useMemo(() => {
    if (!data) return false;
    return (
      Number(currentRetention) !== data.data.retention_days ||
      currentAllowExport !== data.data.allow_data_export
    );
  }, [data, currentRetention, currentAllowExport]);

  useUnsavedChanges(dirty && !saving);

  if (loading) {
    return <SettingsSkeleton label="Loading the data policy" />;
  }

  if (error && !data) {
    return (
      <div className="grid gap-4">
        <SettingsBanner tone="error" title="The policy could not be loaded">
          {error}
        </SettingsBanner>
        <div>
          <SettingsButton variant="secondary" onClick={() => void reload()}>
            Try again
          </SettingsButton>
        </div>
      </div>
    );
  }

  const canManage = data?.can_manage ?? false;

  function discard() {
    setRetention(null);
    setAllowExport(null);
    setValidation(null);
    setMessage(null);
  }

  async function save() {
    if (!data) return;
    setMessage(null);
    setValidation(null);
    const days = Number(currentRetention);
    if (!Number.isInteger(days) || days < 1 || days > 3650) {
      setValidation("The retention window has to be between 1 and 3650 days.");
      return;
    }
    setSaving(true);
    const result = await saveWorkspaceSettings(organizationId, {
      data: { retention_days: days, allow_data_export: currentAllowExport },
    });
    setSaving(false);
    if (result.ok && result.data) {
      setData(result.data);
      setRetention(null);
      setAllowExport(null);
      setMessage({
        tone: "success",
        text: "The data policy was saved.",
      });
      return;
    }
    setMessage({
      tone: "error",
      text: result.error ?? "The data policy could not be saved.",
    });
  }

  return (
    <div className="grid gap-4">
      {!canManage ? (
        <SettingsBanner tone="warning" title="Read only">
          Your role cannot change the data policy of the workspace.
        </SettingsBanner>
      ) : null}

      <SettingsCard
        icon={<DatabaseIcon className="size-4" />}
        title="Data policy"
        chip={<SettingsChip>For your team</SettingsChip>}
        description="How long the workspace keeps its records and what may be exported."
        bodyClassName="divide-y divide-[#eeeeee]"
      >
        <SettingsField
          label="Retention window"
          htmlFor="retention-days"
          description="How long the workspace keeps its audit records."
        >
          <SettingsInput
            id="retention-days"
            type="number"
            min={1}
            max={3650}
            value={currentRetention}
            disabled={!canManage}
            onChange={setRetention}
            className="max-w-[220px]"
          />
        </SettingsField>

        <SettingsRow
          label="Allow the workspace to export its data"
          description="The export is the audit log export of the workspace."
          htmlFor="allow-export"
        >
          <SettingsSwitch
            id="allow-export"
            label="Allow the workspace to export its data"
            checked={currentAllowExport}
            disabled={!canManage}
            onChange={setAllowExport}
          />
        </SettingsRow>
      </SettingsCard>

      {validation ? (
        <SettingsBanner tone="error" title="Check the form">
          {validation}
        </SettingsBanner>
      ) : null}

      {message ? (
        <SettingsBanner
          tone={message.tone === "success" ? "success" : "error"}
        >
          {message.text}
        </SettingsBanner>
      ) : null}

      <SaveBar
        dirty={dirty}
        saving={saving}
        disabled={!canManage}
        onSave={() => void save()}
        onDiscard={discard}
        saveLabel="Save policy"
      />

      <SettingsCard
        title="Exports and account deletion"
        description="Where the records of the workspace leave the platform."
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="m-0 max-w-[52ch] text-[13px] leading-[19px] text-[#666]">
            {data?.data.note ??
              "The export screen collects the records of the workspace."}
          </p>
          <Link
            href={`/dashboard/organizations/${organizationId}/audit-logs/exports`}
            className="inline-flex h-9 items-center justify-center rounded-lg border border-[#dedede] bg-white px-3.5 text-[13px] font-medium text-[#374151] no-underline transition-colors hover:bg-[#f7f7f8]"
          >
            Open the export screen
          </Link>
        </div>
        <p className="m-0 mt-3 text-[12px] leading-[17px] text-[#666]">
          A personal account cannot be deleted from here. Deleting the account
          and deleting the workspace are different actions: the workspace
          lifecycle lives under Advanced.
        </p>
      </SettingsCard>
    </div>
  );
}
