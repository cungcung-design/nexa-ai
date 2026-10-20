"use client";

import { useMemo, useState } from "react";
import { LockIcon } from "@/components/settings/icons";
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
 * The security policy of the workspace.
 *
 * Only the policies the backend enforces are editable. Multi factor
 * authentication and single sign on are shown as unavailable because the
 * backend does not implement them.
 */
export function WorkspaceSecurityForm({
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

  const [timeout, setTimeoutValue] = useState<number | null>(null);
  const [requireApproval, setRequireApproval] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);

  const currentTimeout =
    timeout ?? data?.security.session_timeout_minutes ?? 480;
  const currentRequireApproval =
    requireApproval ?? data?.security.require_tool_approval ?? false;

  const dirty = useMemo(() => {
    if (!data) return false;
    return (
      currentTimeout !== data.security.session_timeout_minutes ||
      currentRequireApproval !== data.security.require_tool_approval
    );
  }, [data, currentTimeout, currentRequireApproval]);

  useUnsavedChanges(dirty && !saving);

  if (loading) {
    return <SettingsSkeleton label="Loading the security policy" />;
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

  async function save() {
    if (!data) return;
    setMessage(null);
    setSaving(true);
    const result = await saveWorkspaceSettings(organizationId, {
      security: {
        session_timeout_minutes: currentTimeout,
        require_tool_approval: currentRequireApproval,
      },
    });
    setSaving(false);
    if (result.ok && result.data) {
      setData(result.data);
      setTimeoutValue(null);
      setRequireApproval(null);
      setMessage({
        tone: "success",
        text: "The security policy was saved.",
      });
      return;
    }
    setMessage({
      tone: "error",
      text: result.error ?? "The security policy could not be saved.",
    });
  }

  return (
    <div className="grid gap-4">
      {!canManage ? (
        <SettingsBanner tone="warning" title="Read only">
          Your role cannot change the security policy of the workspace.
        </SettingsBanner>
      ) : null}

      <SettingsCard
        icon={<LockIcon className="size-4" />}
        title="Access policy"
        description="How the members of the workspace sign in and what they are allowed to run."
        chip={<SettingsChip>For your team</SettingsChip>}
        bodyClassName="divide-y divide-[#eeeeee]"
      >
        <SettingsField
          label="Session timeout"
          htmlFor="session-timeout"
          description="Stored as the session policy of the workspace."
        >
          <SettingsInput
            id="session-timeout"
            type="number"
            min={5}
            max={10080}
            value={currentTimeout}
            disabled={!canManage}
            onChange={(value) => setTimeoutValue(Number(value) || 0)}
            className="max-w-[220px]"
          />
        </SettingsField>

        <SettingsRow
          label="Require approval for every tool call"
          description="A mandatory workspace policy. Agents, workflows and runs cannot weaken it."
          htmlFor="require-tool-approval"
        >
          <SettingsSwitch
            id="require-tool-approval"
            label="Require approval for every tool call"
            checked={currentRequireApproval}
            disabled={!canManage}
            onChange={setRequireApproval}
          />
        </SettingsRow>
      </SettingsCard>

      <SettingsCard
        title="Not available yet"
        description="The following controls are not implemented by the backend."
      >
        <ul className="m-0 grid list-none gap-3 p-0">
          <li className="flex items-start gap-2.5 text-[13px] leading-[19px] text-[#555]">
            <span className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border border-[#dedede] text-[9px] text-[#666]">
              –
            </span>
            Multi factor authentication is not implemented by the backend.
          </li>
          <li className="flex items-start gap-2.5 text-[13px] leading-[19px] text-[#555]">
            <span className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border border-[#dedede] text-[9px] text-[#666]">
              –
            </span>
            Single sign on is not available either.
          </li>
        </ul>
      </SettingsCard>

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
        onDiscard={() => {
          setTimeoutValue(null);
          setRequireApproval(null);
          setMessage(null);
        }}
        saveLabel="Save policy"
      />

      {data?.security.sessions_note ? (
        <p className="m-0 text-[12px] leading-[17px] text-[#666]">
          {data.security.sessions_note}
        </p>
      ) : null}
    </div>
  );
}
