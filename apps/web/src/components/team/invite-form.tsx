"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  FieldLabel,
  primaryButtonClass,
  inputClass,
  selectClass,
  textareaClass,
} from "@/components/team/shared";
import type { TeamInvitation, TeamRoleSummary } from "@/lib/api";

async function readError(response: Response, fallback: string) {
  try {
    const payload = await response.json();
    const detail =
      payload?.detail ?? payload?.error ?? payload?.message ?? undefined;
    if (typeof detail === "string" && detail.trim()) return detail;
  } catch {
    // The upstream did not return a JSON body.
  }
  return fallback;
}

export function InviteForm({
  organizationId,
  roles,
}: {
  organizationId: string;
  roles: TeamRoleSummary[];
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState(roles[roles.length - 1]?.role ?? "VIEWER");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<TeamInvitation | null>(null);
  const [copied, setCopied] = useState(false);

  const selectedRole = useMemo(
    () => roles.find((entry) => entry.role === role) ?? roles[0],
    [role, roles]
  );

  const inviteLink = created?.invite_token
    ? `${typeof window === "undefined" ? "" : window.location.origin}/invitations/${created.invite_token}`
    : "";

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setCopied(false);
    try {
      const response = await fetch(
        `/api/workspace/${organizationId}/team/invitations`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: email.trim(),
            role,
            message: message.trim() || undefined,
          }),
        }
      );
      if (!response.ok) {
        setError(
          await readError(response, "The invitation could not be created.")
        );
        return;
      }
      const payload = (await response.json()) as TeamInvitation;
      setCreated(payload);
      setEmail("");
      setMessage("");
      router.refresh();
    } catch {
      setError("The workspace could not be reached.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <FieldLabel htmlFor="invite-email">Email address</FieldLabel>
          <input
            id="invite-email"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="teammate@company.com"
            className={inputClass}
          />
        </div>
        <div>
          <FieldLabel htmlFor="invite-role">Workspace role</FieldLabel>
          <select
            id="invite-role"
            value={role}
            onChange={(event) => setRole(event.target.value)}
            className={selectClass}
          >
            {roles.map((entry) => (
              <option key={entry.role} value={entry.role}>
                {entry.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <FieldLabel htmlFor="invite-message">
          Message <span className="text-[#929292]">(optional)</span>
        </FieldLabel>
        <textarea
          id="invite-message"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Add a short note for the person you are inviting."
          className={textareaClass}
        />
      </div>

      {selectedRole ? (
        <div className="p-3 border border-[#dedede] rounded-[11px] bg-[#fafafa]">
          <p className="m-0 text-[12px] font-semibold text-[#171717]">
            {selectedRole.label} permissions
          </p>
          <p className="m-[2px_0_0] text-[12px] text-[#777]">
            {selectedRole.description}
          </p>
          <ul className="m-[8px_0_0] p-0 list-none grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1">
            {selectedRole.permission_labels.map((label) => (
              <li
                key={label}
                className="flex items-center gap-1.5 text-[12px] text-[#444]"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#6366f1]" />
                {label}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {error ? (
        <p className="m-0 text-[12px] font-medium text-[#b42318]">{error}</p>
      ) : null}

      {created ? (
        <div className="p-3 border border-[#cfe8cf] rounded-[11px] bg-[#f4fbf4]">
          <p className="m-0 text-[12px] font-semibold text-[#1f7a34]">
            Invitation created for {created.email}
          </p>
          <p className="m-[2px_0_0] text-[12px] text-[#4a7c4f]">
            This workspace has no outbound mail provider, so share the link
            below with the recipient. It expires on{" "}
            {new Date(created.expires_at).toLocaleDateString()}.
          </p>
          {inviteLink ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <input
                readOnly
                value={inviteLink}
                aria-label="Invitation link"
                className="flex-1 min-w-[220px] h-[34px] px-3 border border-[#dedede] rounded-full bg-white text-[12px] text-[#171717] outline-none"
              />
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(inviteLink);
                    setCopied(true);
                  } catch {
                    setCopied(false);
                  }
                }}
                className="inline-flex items-center justify-center h-[34px] px-3 border border-[#dedede] rounded-full bg-white text-[12px] font-medium text-[#666] cursor-pointer hover:bg-gray-50 transition-colors"
              >
                {copied ? "Copied" : "Copy link"}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      <button type="submit" disabled={busy} className={primaryButtonClass}>
        {busy ? "Sending..." : "Send Invitation"}
      </button>
    </form>
  );
}
