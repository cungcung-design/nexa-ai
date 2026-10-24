"use client";

import { FormEvent, useRef, useState } from "react";
import Link from "next/link";
import type { Agent } from "@/lib/api";

export type WorkflowInputField = {
  name: string;
  type: string;
  required: boolean;
  min_length?: number | null;
  max_length?: number | null;
};

export type WorkflowDefinition = {
  key: string;
  name: string;
  description: string;
  requires_approval: boolean;
  inputs: WorkflowInputField[];
};

export type WorkflowExecution = {
  id: string;
  workflow_key: string;
  workflow_name: string;
  thread_id: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  display_status:
    | "waiting_for_approval"
    | "running"
    | "completed"
    | "rejected"
    | "failed";
  agent_id: string;
  agent_name: string | null;
  arguments: { note?: string };
  result: { note?: string; error?: string } | null;
  checkpoint_error: string | null;
  created_at: string;
  completed_at: string | null;
};

const STATUS_LABEL: Record<WorkflowExecution["display_status"], string> = {
  waiting_for_approval: "Waiting for approval",
  running: "Running",
  completed: "Completed",
  rejected: "Rejected",
  failed: "Failed",
};

function errorMessage(data: unknown, fallback: string) {
  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;
    if (typeof record.detail === "string") return record.detail;
    if (typeof record.error === "string") return record.error;
    if (Array.isArray(record.detail) && record.detail.length > 0) {
      const first = record.detail[0] as { msg?: string };
      if (typeof first?.msg === "string") return first.msg;
    }
  }
  return fallback;
}

function formatStamp(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.toISOString().replace("T", " ").slice(0, 16)} UTC`;
}

function resultText(execution: WorkflowExecution) {
  if (execution.checkpoint_error) return execution.checkpoint_error;
  if (execution.result?.note) return execution.result.note;
  if (execution.result?.error) return execution.result.error;
  if (execution.display_status === "waiting_for_approval") {
    return "Paused before the note is written.";
  }
  return "No result recorded yet.";
}

export function WorkflowConsole({
  orgId,
  role,
  agents,
  definitions,
  initialExecutions,
}: {
  orgId: string;
  role: string;
  agents: Agent[];
  definitions: WorkflowDefinition[];
  initialExecutions: WorkflowExecution[];
}) {
  const activeAgents = agents.filter((agent) => !agent.is_archived);
  const workflow = definitions[0] ?? null;
  const noteField = workflow?.inputs.find((input) => input.name === "note");
  const maxLength = noteField?.max_length ?? 500;
  const canStart = role === "OWNER" || role === "ADMIN" || role === "DEVELOPER";
  const canReview = role === "OWNER" || role === "ADMIN";
  const [agentId, setAgentId] = useState(activeAgents[0]?.id ?? "");
  const [note, setNote] = useState("");
  const [executions, setExecutions] = useState(initialExecutions);
  const [busy, setBusy] = useState<"start" | "refresh" | null>(null);
  const [error, setError] = useState("");
  const sending = useRef(false);
  const base = `/api/workspace/${encodeURIComponent(orgId)}/workflows`;

  async function loadExecutions() {
    const response = await fetch(`${base}/executions`, { cache: "no-store" });
    const data: unknown = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(errorMessage(data, "Unable to load workflow history"));
    }
    setExecutions(Array.isArray(data) ? (data as WorkflowExecution[]) : []);
  }

  async function start(event: FormEvent) {
    event.preventDefault();
    const text = note.trim();
    if (!workflow || !canStart || !agentId || !text || sending.current) return;
    sending.current = true;
    setBusy("start");
    setError("");
    try {
      const response = await fetch(`${base}/demo-action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agent_id: agentId, note: text }),
      });
      const data: unknown = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(errorMessage(data, "Unable to start the workflow"));
      }
      setNote("");
      await loadExecutions();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to start the workflow");
    } finally {
      sending.current = false;
      setBusy(null);
    }
  }

  async function refresh() {
    if (sending.current) return;
    sending.current = true;
    setBusy("refresh");
    setError("");
    try {
      await loadExecutions();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to load workflow history"
      );
    } finally {
      sending.current = false;
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-blue-600">
          Workflows
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
          Workflows
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-500">
          Available actions come from the workflow service. A run pauses for
          approval before the action is carried out.
        </p>
      </div>

      {error ? (
        <p
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700"
        >
          {error}
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <h2 className="text-sm font-semibold text-slate-900">Available workflows</h2>
          {workflow ? (
            <div className="mt-4 space-y-4">
              <div>
                <p className="font-mono text-sm font-semibold text-slate-900">
                  {workflow.name}
                </p>
                <p className="mt-1 text-sm text-slate-500">{workflow.description}</p>
                <p className="mt-3 inline-flex rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800">
                  {workflow.requires_approval
                    ? "Human approval required"
                    : "Runs immediately"}
                </p>
              </div>
              <form onSubmit={start} className="space-y-3">
                <label className="block text-xs font-medium text-slate-600">
                  Agent
                  <select
                    aria-label="Agent"
                    value={agentId}
                    onChange={(event) => setAgentId(event.target.value)}
                    disabled={!canStart || busy === "start" || activeAgents.length === 0}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-300 focus:bg-white disabled:opacity-60"
                  >
                    {activeAgents.length === 0 ? (
                      <option value="">No agents available</option>
                    ) : (
                      activeAgents.map((agent) => (
                        <option key={agent.id} value={agent.id}>
                          {agent.name}
                        </option>
                      ))
                    )}
                  </select>
                </label>
                <label className="block text-xs font-medium text-slate-600">
                  Note
                  <textarea
                    aria-label="Note"
                    value={note}
                    maxLength={maxLength}
                    rows={4}
                    disabled={!canStart || busy === "start"}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder="Note to store after approval"
                    className="mt-1 w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-300 focus:bg-white disabled:opacity-60"
                  />
                </label>
                <button
                  type="submit"
                  disabled={
                    !canStart ||
                    busy !== null ||
                    !agentId ||
                    !note.trim() ||
                    activeAgents.length === 0
                  }
                  className="inline-flex min-h-10 w-full items-center justify-center rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
                >
                  {busy === "start" ? "Starting..." : "Start workflow"}
                </button>
                {!canStart ? (
                  <p className="text-xs text-slate-500">
                    Owners, Admins, and Developers can start this workflow.
                  </p>
                ) : null}
                {activeAgents.length === 0 ? (
                  <p className="text-xs text-slate-500">
                    Create an agent before starting this workflow.
                  </p>
                ) : null}
              </form>
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-500">
              No workflow definitions are available.
            </p>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Execution history</h2>
              <p className="mt-1 text-xs text-slate-500">
                Records saved for this workspace.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={refresh}
                disabled={busy !== null}
                className="min-h-10 rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                {busy === "refresh" ? "Refreshing..." : "Refresh"}
              </button>
              {canReview ? (
                <Link
                  href={`/dashboard/organizations/${encodeURIComponent(orgId)}/approvals/inbox`}
                  className="inline-flex min-h-10 items-center rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Approval inbox
                </Link>
              ) : null}
            </div>
          </div>

          {executions.length === 0 ? (
            <p className="mt-6 rounded-xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">
              No executions yet.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {executions.map((execution) => (
                <li
                  key={execution.id}
                  className="rounded-xl border border-slate-200 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono text-sm font-semibold text-slate-900">
                        {execution.workflow_name}
                      </p>
                      <p className="mt-1 break-all text-xs text-slate-500">
                        Execution {execution.id}
                      </p>
                    </div>
                    <span
                      className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
                        execution.display_status === "completed"
                          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                          : execution.display_status === "rejected" ||
                              execution.display_status === "failed"
                            ? "border-rose-200 bg-rose-50 text-rose-700"
                            : execution.display_status === "waiting_for_approval"
                              ? "border-amber-200 bg-amber-50 text-amber-800"
                              : "border-slate-200 bg-slate-50 text-slate-700"
                      }`}
                    >
                      {STATUS_LABEL[execution.display_status]}
                    </span>
                  </div>
                  <dl className="mt-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-2">
                    <div>
                      <dt className="text-slate-400">Agent</dt>
                      <dd>{execution.agent_name ?? "Unknown agent"}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-400">Approval</dt>
                      <dd>{execution.status}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-400">Created</dt>
                      <dd>{formatStamp(execution.created_at)}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-400">Updated</dt>
                      <dd>{formatStamp(execution.completed_at)}</dd>
                    </div>
                  </dl>
                  <p className="mt-3 text-sm text-slate-800">{resultText(execution)}</p>
                  {execution.display_status === "waiting_for_approval" && canReview ? (
                    <Link
                      href={`/dashboard/organizations/${encodeURIComponent(orgId)}/approvals/${encodeURIComponent(execution.id)}`}
                      className="mt-3 inline-flex text-xs font-semibold text-blue-700 hover:underline"
                    >
                      Open approval
                    </Link>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
