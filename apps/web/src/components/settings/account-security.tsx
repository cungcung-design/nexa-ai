"use client";

import { useState } from "react";
import {
  SettingsBanner,
  SettingsButton,
  SettingsCard,
  SettingsChip,
  SettingsField,
  SettingsInput,
} from "@/components/settings/design";
import { changePassword } from "@/lib/api/settings";

/**
 * The account security screen.
 *
 * Only the password can be changed: multi factor authentication and the
 * session list are not implemented by the backend, so they are shown as
 * unavailable instead of pretending to work.
 */
export function AccountSecurityForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);
  const [validation, setValidation] = useState<string | null>(null);

  const ready =
    currentPassword.length > 0 &&
    newPassword.length > 0 &&
    confirmation.length > 0;

  async function submit() {
    setMessage(null);
    setValidation(null);
    if (newPassword !== confirmation) {
      setValidation("The new password and its confirmation do not match.");
      return;
    }
    if (newPassword.length < 12) {
      setValidation(
        "The new password needs at least 12 characters, the same rule the account uses."
      );
      return;
    }
    setSaving(true);
    const result = await changePassword({
      current_password: currentPassword,
      new_password: newPassword,
    });
    setSaving(false);
    if (result.ok) {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmation("");
      setMessage({
        tone: "success",
        text: result.data?.message ?? "Your password was changed.",
      });
      return;
    }
    setMessage({
      tone: "error",
      text: result.error ?? "Your password could not be changed.",
    });
  }

  return (
    <div className="grid gap-4">
      <SettingsCard
        title="Password"
        description="The password is stored hashed and is never shown again."
        chip={<SettingsChip>For you</SettingsChip>}
        bodyClassName="divide-y divide-[#eeeeee]"
        footer={
          <SettingsButton
            onClick={() => void submit()}
            disabled={!ready || saving}
          >
            {saving ? "Updating…" : "Update password"}
          </SettingsButton>
        }
      >
        <SettingsField label="Current password" htmlFor="current-password">
          <SettingsInput
            id="current-password"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={setCurrentPassword}
            className="max-w-[420px]"
          />
        </SettingsField>

        <SettingsField
          label="New password"
          htmlFor="new-password"
          description="At least 12 characters."
        >
          <SettingsInput
            id="new-password"
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={setNewPassword}
            className="max-w-[420px]"
          />
        </SettingsField>

        <SettingsField
          label="Confirm new password"
          htmlFor="confirm-password"
        >
          <SettingsInput
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            value={confirmation}
            onChange={setConfirmation}
            className="max-w-[420px]"
          />
        </SettingsField>
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

      <SettingsCard
        title="Sign-in protection"
        description="The features the backend supports today."
      >
        <ul className="m-0 grid list-none gap-3 p-0">
          <li className="flex items-start gap-2.5 text-[13px] leading-[19px] text-[#555]">
            <span className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border border-[#dedede] text-[9px] text-[#666]">
              –
            </span>
            Multi factor authentication is not implemented by the backend, so
            it cannot be enabled here.
          </li>
          <li className="flex items-start gap-2.5 text-[13px] leading-[19px] text-[#555]">
            <span className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border border-[#dedede] text-[9px] text-[#666]">
              –
            </span>
            Access tokens are stateless: there is no session list to review
            and changing the password does not end a running session.
          </li>
        </ul>
      </SettingsCard>
    </div>
  );
}
