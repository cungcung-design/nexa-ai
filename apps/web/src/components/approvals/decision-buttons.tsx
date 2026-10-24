"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { DecisionCheckIcon, DecisionRejectIcon } from "@/components/approvals/icons";

type DecisionButtonsProps = {
  orgId: string;
  approvalId: string;
  status: string;
};

function decisionError(data: unknown, fallback: string) {
  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;
    if (typeof record.detail === "string") return record.detail;
    if (typeof record.error === "string") return record.error;
  }
  return fallback;
}

export function DecisionButtons({
  orgId,
  approvalId,
  status,
}: DecisionButtonsProps) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<"approved" | "rejected" | null>(null);
  const [error, setError] = useState("");

  const decided = status !== "PENDING" || result !== null;

  async function handleDecision(approved: boolean) {
    if (busy || decided) return;
    setBusy(approvalId);
    setResult(null);
    setError("");
    try {
      const response = await fetch(
        `/api/workspace/${encodeURIComponent(orgId)}/workflows/approvals/${encodeURIComponent(approvalId)}/decision`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ approved }),
        }
      );
      const data: unknown = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(decisionError(data, "Decision failed"));
      }
      setResult(approved ? "approved" : "rejected");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Decision failed");
    } finally {
      setBusy(null);
    }
  }

  if (decided) {
    const approved = result === "approved" || status === "APPROVED";
    return (
      <div className="flex items-center gap-2">
        {approved ? (
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
    <div>
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
      {error ? (
        <p role="alert" className="mt-3 text-xs text-rose-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
