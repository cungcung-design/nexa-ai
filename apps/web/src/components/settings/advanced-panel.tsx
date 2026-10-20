"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { WarningIcon } from "@/components/settings/icons";
import {
  DangerCard,
  SettingsBanner,
  SettingsButton,
  SettingsField,
  SettingsInput,
  SettingsSelect,
  SettingsSkeleton,
} from "@/components/settings/design";
import { useResource } from "@/components/settings/use-resource";
import {
  deleteWorkspace,
  getWorkspaceSettings,
  listTeamMembers,
  transferOwnership,
  type TeamMemberSummary,
  type WorkspaceSettings,
} from "@/lib/api/settings";

/**
 * The workspace lifecycle actions.
 *
 * Both actions are irreversible, so they need an explicit confirmation and
 * they report the scope and the consequences before they run.
 */
export function AdvancedPanel({
  organizationId,
  initial,
}: {
  organizationId: string;
  initial: WorkspaceSettings | null;
}) {
  const router = useRouter();
  const { data, loading, error, reload } = useResource<WorkspaceSettings>(
    () => getWorkspaceSettings(organizationId),
    initial
  );

  const members = useResource<{ items: TeamMemberSummary[] }>(
    () => listTeamMembers(organizationId),
    null
  );

  const [target, setTarget] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);

  const isOwner = data?.role === "OWNER";
  const workspaceName = data?.organization.name ?? "";

  async function transfer() {
    setMessage(null);
    if (!target) {
      setMessage({
        tone: "error",
        text: "Choose the member that becomes the owner.",
      });
      return;
    }
    setBusy(true);
    const result = await transferOwnership(organizationId, target);
    setBusy(false);
    if (!result.ok) {
      setMessage({
        tone: "error",
        text: result.error ?? "The ownership could not be transferred.",
      });
      return;
    }
    setMessage({
      tone: "success",
      text: result.data?.message ?? "The ownership was transferred.",
    });
    setTarget("");
    await reload();
  }

  async function remove() {
    setMessage(null);
    if (confirmation.trim() !== workspaceName) {
      setMessage({
        tone: "error",
        text: `Type the exact workspace name “${workspaceName}” to confirm.`,
      });
      return;
    }
    setBusy(true);
    const result = await deleteWorkspace(organizationId, confirmation.trim());
    setBusy(false);
    if (!result.ok) {
      setMessage({
        tone: "error",
        text: result.error ?? "The workspace could not be deleted.",
      });
      return;
    }
    setMessage({
      tone: "success",
      text: result.data?.message ?? "The workspace was deleted.",
    });
    router.push("/dashboard");
  }

  if (loading) {
    return <SettingsSkeleton label="Loading the workspace" />;
  }

  return (
    <div className="grid gap-4">
      {error ? (
        <SettingsBanner tone="error" title="The workspace could not be loaded">
          {error}
        </SettingsBanner>
      ) : null}

      {message ? (
        <SettingsBanner
          tone={message.tone === "success" ? "success" : "error"}
        >
          {message.text}
        </SettingsBanner>
      ) : null}

      <DangerCard
        title="Transfer workspace ownership"
        description="Transfer primary ownership to another eligible member. The workspace keeps at least one owner, so it is never left without one."
      >
        {isOwner ? (
          <div className="grid gap-3">
            <SettingsField
              label="New owner"
              htmlFor="ownership-target"
              description="Only active members of the workspace can become the owner."
            >
              <SettingsSelect
                id="ownership-target"
                value={target}
                onChange={setTarget}
                className="max-w-[420px]"
                options={[
                  { value: "", label: "Choose a member" },
                  ...(members.data?.items ?? [])
                    .filter(
                      (member) =>
                        member.status === "ACTIVE" &&
                        member.email !== data?.current_user_email
                    )
                    .map((member) => ({
                      value: member.id,
                      label: `${member.email} — ${member.role_label}`,
                    })),
                ]}
              />
            </SettingsField>
            <div className="flex justify-end">
              <SettingsButton
                onClick={() => void transfer()}
                disabled={busy || !target}
              >
                {busy ? "Transferring…" : "Transfer ownership"}
              </SettingsButton>
            </div>
          </div>
        ) : (
          <p className="m-0 text-[13px] leading-[19px] text-[#666]">
            Only the owner of the workspace can transfer the ownership.
          </p>
        )}
      </DangerCard>

      <DangerCard
        title="Delete workspace"
        description="Permanently remove the workspace according to the supported deletion and retention policy. Every agent, workflow and audit record of the workspace is removed with it."
      >
        {isOwner ? (
          <div className="grid gap-3">
            <SettingsField
              label={`Type “${workspaceName}” to confirm`}
              htmlFor="delete-confirmation"
              description="The workspace is only deleted when the name matches exactly."
            >
              <SettingsInput
                id="delete-confirmation"
                value={confirmation}
                onChange={setConfirmation}
                placeholder={workspaceName}
                className="max-w-[420px]"
              />
            </SettingsField>
            <div className="flex justify-end">
              <SettingsButton
                variant="danger"
                onClick={() => void remove()}
                disabled={busy || confirmation.trim() !== workspaceName}
              >
                {busy ? "Deleting…" : "Delete workspace"}
              </SettingsButton>
            </div>
          </div>
        ) : (
          <p className="m-0 text-[13px] leading-[19px] text-[#666]">
            Only the owner of the workspace can delete it. Deleting your own
            account is a different action and is not available here.
          </p>
        )}
      </DangerCard>

      <p className="m-0 flex items-start gap-2 text-[12px] leading-[17px] text-[#666]">
        <WarningIcon className="mt-0.5 size-3.5 shrink-0" />
        Destructive actions need the owner role, an explicit confirmation and
        a verified backend response.
      </p>
    </div>
  );
}
