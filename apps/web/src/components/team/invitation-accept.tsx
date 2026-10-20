"use client";

import { useRouter } from "next/navigation";
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
  const router = useRouter();
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
      router.push(`/dashboard/organizations/${organizationId}/team`);
      router.refresh();
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
