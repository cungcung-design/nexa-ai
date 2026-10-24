"use client";

import { useState } from "react";
import { primaryButtonClass } from "@/components/team/shared";

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

export function InvitationAccept({
  token,
  organizationId,
}: {
  token: string;
  organizationId: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function accept() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/invitations/${token}/accept`, {
        method: "POST",
      });
      if (!response.ok) {
        setError(
          await readError(response, "The invitation could not be accepted.")
        );
        return;
      }
      document.cookie = `nexa_active_org=${encodeURIComponent(
        organizationId
      )};path=/;max-age=31536000;samesite=lax`;
      window.location.assign(
        `/dashboard/organizations/${encodeURIComponent(organizationId)}/team`
      );
    } catch {
      setError("The workspace could not be reached.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={accept}
        disabled={busy}
        className={`${primaryButtonClass} w-full`}
      >
        {busy ? "Accepting..." : "Accept invitation"}
      </button>
      {error ? (
        <p className="m-[10px_0_0] text-[12px] font-medium text-[#b42318]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
