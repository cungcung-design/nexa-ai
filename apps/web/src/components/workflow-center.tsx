"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  Check,
  Clock3,
  LoaderCircle,
  RefreshCw,
  ShieldAlert,
  Workflow,
  X,
} from "lucide-react";
import type { Agent } from "@/lib/api";

export type Approval = {
  id: string;
  agent_id: string;
  action: string;
  status: string;
  thread_id: string;
  created_at?: string;
  requested_by?: string | null;
  reviewed_by?: string | null;
};

function errorMessage(data: unknown, fallback: string) {
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    if (typeof obj.detail === "string") return obj.detail;
    if (typeof obj.error === "string") return obj.error;
  }
  return fallback;
}

export function WorkflowCenter({
  orgId,
  agents,
  initialApprovals,
  canReview,
  mode,
}: {
  orgId: string;
  agents: Agent[];
  initialApprovals: Approval[];
  canReview: boolean;
  mode: "workflows" | "approvals";
}) {
  const [approvals, setApprovals] = useState(initialApprovals);
  const [agentId, setAgentId] = useState(
    agents.find((a) => !a.is_archived)?.id ?? ""
  );
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [pendingId, setPendingId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const base = `/api/workspace/${encodeURIComponent(orgId)}/workflows`;

  async function refresh() {
    if (!canReview) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`${base}/approvals`, { cache: "no-store" });
      const data: unknown = await response.json();
      if (!response.ok)
        throw new Error(errorMessage(data, "Unable to load approvals"));
      setApprovals(Array.isArray(data) ? (data as Approval[]) : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load approvals");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    setApprovals(initialApprovals);
    setError("");
    setNotice("");
  }, [orgId, initialApprovals]);

  async function requestApproval(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!agentId || !note.trim() || note.length > 500) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`${base}/demo-action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agent_id: agentId, note: note.trim() }),
      });
      const data: unknown = await response.json();
      if (!response.ok)
        throw new Error(errorMessage(data, "Unable to request approval"));
      setNote("");
      setNotice(
        "Demo action submitted. It is awaiting review; no external action has run."
      );
      if (canReview) {
        const list = await fetch(`${base}/approvals`, { cache: "no-store" });
        if (list.ok) {
          const items: unknown = await list.json();
          if (Array.isArray(items)) setApprovals(items as Approval[]);
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  async function decide(id: string, approved: boolean) {
    if (
      !canReview ||
      !window.confirm(
        approved ? "Approve this demo action?" : "Reject this demo action?"
      )
    )
      return;
    setPendingId(id);
    setError("");
    setNotice("");
    try {
      const response = await fetch(
        `${base}/approvals/${encodeURIComponent(id)}/decision`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ approved }),
        }
      );
      const data: unknown = await response.json();
      if (!response.ok)
        throw new Error(errorMessage(data, "Unable to record decision"));
      setApprovals((current) =>
        current.map((a) =>
          a.id === id
            ? { ...a, status: approved ? "APPROVED" : "REJECTED" }
            : a
        )
      );
      setNotice(approved ? "Demo action approved." : "Demo action rejected.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Decision failed");
    } finally {
      setPendingId("");
    }
  }

  const pending = approvals.filter((a) => a.status === "PENDING");
  const history = approvals.filter((a) => a.status !== "PENDING");

  return (
    <div className="space-y-6">
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200"
        >
          {error}
        </div>
      )}
      {notice && (
        <div
          role="status"
          className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200"
        >
          {notice}
        </div>
      )}

      {mode === "workflows" && (
        <section className="rounded-2xl border border-white/10 bg-[#14131e] p-5 sm:p-7">
          <div className="mb-5 flex items-center gap-3">
            <span className="rounded-xl bg-violet-500/15 p-3 text-violet-300">
              <Workflow className="size-5" />
            </span>
            <div>
              <h2 className="text-lg font-semibold">
                Request a demo approval
              </h2>
              <p className="text-sm text-zinc-400">
                demo_create_note only — no real external side effects.
              </p>
            </div>
          </div>
          <form onSubmit={requestApproval} className="space-y-4">
            <label className="block text-sm text-zinc-300">
              Agent
              <select
                value={agentId}
                onChange={(e) => setAgentId(e.target.value)}
                className="mt-2 w-full rounded-xl border border-white/15 bg-[#0e0d16] p-3 text-zinc-100"
              >
                <option value="">Select agent</option>
                {agents
                  .filter((a) => !a.is_archived)
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
              </select>
            </label>
            <label className="block text-sm text-zinc-300">
              Demo note
              <textarea
                value={note}
                maxLength={500}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                placeholder="Write the note that needs approval..."
                className="mt-2 w-full resize-y rounded-xl border border-white/15 bg-[#0e0d16] p-3 text-zinc-100 placeholder:text-zinc-600"
              />
            </label>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-zinc-500">
                {note.length}/500 characters
              </p>
              <button
                disabled={busy || !agentId || !note.trim()}
                className="rounded-xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
              >
                {busy ? "Submitting..." : "Request approval"}
              </button>
            </div>
          </form>
        </section>
      )}

      {canReview ? (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">
                Pending approvals{" "}
                <span className="text-violet-300">({pending.length})</span>
              </h2>
              <p className="text-sm text-zinc-400">
                Review requested demo actions before they resume.
              </p>
            </div>
            <button
              disabled={busy || !!pendingId}
              onClick={refresh}
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-3 py-2 text-sm hover:bg-white/5"
            >
              <RefreshCw className="size-4" /> Refresh
            </button>
          </div>
          {pending.length === 0 && (
            <div className="rounded-2xl border border-dashed border-white/15 p-8 text-center text-zinc-400">
              <Clock3 className="mx-auto mb-3 size-7 text-violet-400" />
              No pending approvals.
            </div>
          )}
          <div className="grid gap-4 lg:grid-cols-2">
            {pending.map((a) => (
              <article
                key={a.id}
                className="min-w-0 rounded-2xl border border-violet-400/20 bg-[#14131e] p-5"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-violet-300">
                    <ShieldAlert className="size-5" />
                    <span className="text-sm font-semibold">
                      Action approval
                    </span>
                  </div>
                  <span className="rounded-full bg-amber-500/10 px-2 py-1 text-xs text-amber-300">
                    PENDING
                  </span>
                </div>
                <p className="mt-4 text-lg font-semibold">{a.action}</p>
                <p className="mt-2 break-all font-mono text-xs text-zinc-500">
                  Request {a.id}
                </p>
                <p className="mt-1 break-all font-mono text-xs text-zinc-500">
                  Thread {a.thread_id}
                </p>
                <p className="mt-3 text-xs text-zinc-400">
                  Action arguments are not returned by the current approval-list
                  schema. Review them in a trusted backend before approving
                  real actions.
                </p>
                <div className="mt-5 flex gap-2">
                  <button
                    disabled={!!pendingId}
                    onClick={() => decide(a.id, false)}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/15 px-3 py-2.5 text-sm hover:bg-white/5 disabled:opacity-50"
                  >
                    <X className="size-4" /> Reject
                  </button>
                  <button
                    disabled={!!pendingId}
                    onClick={() => decide(a.id, true)}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-violet-600 px-3 py-2.5 text-sm font-semibold hover:bg-violet-500 disabled:opacity-50"
                  >
                    {pendingId === a.id ? (
                      <LoaderCircle className="size-4 animate-spin" />
                    ) : (
                      <Check className="size-4" />
                    )}{" "}
                    Approve
                  </button>
                </div>
              </article>
            ))}
          </div>
          <h2 className="pt-4 text-xl font-semibold">Decision history</h2>
          {history.length === 0 ? (
            <p className="text-sm text-zinc-500">
              No completed decisions yet.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-white/10">
              <table className="w-full min-w-[480px] text-left text-sm">
                <thead className="bg-white/5 text-zinc-400">
                  <tr>
                    <th className="p-3">Action</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Request</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((a) => (
                    <tr
                      key={a.id}
                      className="border-t border-white/10"
                    >
                      <td className="p-3">{a.action}</td>
                      <td className="p-3">{a.status}</td>
                      <td className="p-3 font-mono text-xs">
                        {a.id.slice(0, 8)}…
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-[#14131e] p-5 text-sm text-zinc-400">
          Approval review is restricted to organization Owners and Admins. Your
          role does not permit reviewing approvals.
        </div>
      )}
    </div>
  );
}
