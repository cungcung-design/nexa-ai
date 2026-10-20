"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { secondaryButtonClass } from "@/components/team/shared";

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

export function InvitationRowActions({
  organizationId,
  invitationId,
  status,
}: {
  organizationId: string;
  invitationId: string;
  status: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const terminal = status === "ACCEPTED" || status === "REVOKED";

  async function act(action: "resend" | "revoke") {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        `/api/workspace/${organizationId}/team/invitations/${invitationId}/${action}`,
        { method: "POST" }
      );
      if (!response.ok) {
        setError(
          await readError(
            response,
            action === "resend"
              ? "The invitation could not be resent."
              : "The invitation could not be revoked."
          )
        );
        return;
      }
      router.refresh();
    } catch {
      setError("The workspace could not be reached.");
    } finally {
      setBusy(false);
    }
  }

  if (terminal) {
    return <span className="text-[12px] text-[#929292]">No actions</span>;
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => act("resend")}
          disabled={busy}
          className={secondaryButtonClass}
        >
          Resend
        </button>
        <button
          type="button"
          onClick={() => act("revoke")}
          disabled={busy}
          className="inline-flex items-center justify-center h-[36px] px-4 border border-[#f3c9c9] rounded-full bg-transparent text-[#b42318] font-sans text-[13px] font-medium cursor-pointer hover:bg-[#fff4f4] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          Revoke
        </button>
      </div>
      {error ? (
        <p className="m-0 text-[11px] text-[#b42318]">{error}</p>
      ) : null}
    </div>
  );
}
