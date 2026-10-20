"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/api/client";
import { DecisionCheckIcon, DecisionRejectIcon } from "@/components/approvals/icons";

type DecisionButtonsProps = {
  orgId: string;
  approvalId: string;
  status: string;
  onDecision: (status: "APPROVED" | "REJECTED") => void;
};

export function DecisionButtons({
  orgId,
  approvalId,
  status,
  onDecision,
}: DecisionButtonsProps) {
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<"approved" | "rejected" | null>(null);

  const decided = status !== "PENDING";

  async function handleDecision(approved: boolean) {
    if (busy || decided) return;
    setBusy(approvalId);
    setResult(null);
    try {
      const response = await apiFetch(
        `/api/v1/organizations/${orgId}/approvals/${encodeURIComponent(approvalId)}/decision`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ approved }),
        }
      );
      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(text || "Decision failed");
      }
      setResult(approved ? "approved" : "rejected");
      onDecision(approved ? "APPROVED" : "REJECTED");
    } catch {
      // Error handled by parent or shown inline
    } finally {
      setBusy(null);
    }
  }

  if (decided) {
    return (
      <div className="flex items-center gap-2">
        {result === "approved" ? (
          <DecisionCheckIcon className="text-emerald-500" />
        ) : (
          <DecisionRejectIcon className="text-rose-500" />
        )}
        <span className="text-xs font-medium text-zinc-500">
          Decision already recorded
        </span>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      <button
        disabled={busy === approvalId}
        onClick={() => handleDecision(false)}
        className="flex items-center justify-center gap-2 h-10 border border-zinc-200 rounded-xl text-zinc-600 font-semibold text-sm hover:bg-zinc-50 disabled:opacity-50"
      >
        {busy === approvalId ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <DecisionRejectIcon className="size-4" />
        )}
        Reject
      </button>
      <button
        disabled={busy === approvalId}
        onClick={() => handleDecision(true)}
        className={`flex items-center justify-center gap-2 h-10 rounded-xl font-semibold text-sm disabled:opacity-50 ${
          busy === approvalId
            ? "bg-zinc-200 text-zinc-400 border-zinc-200"
            : "bg-blue-600 text-white hover:bg-blue-700 border-transparent"
        }`}
      >
        {busy === approvalId ? (
          <Loader2 className="size-4 animate-spin text-white" />
        ) : (
          <DecisionCheckIcon className="size-4" />
        )}
        Approve
      </button>
    </div>
  );
}
