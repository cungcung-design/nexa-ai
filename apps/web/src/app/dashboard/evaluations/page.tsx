"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { FlaskConical } from "lucide-react";

type EvaluationResult = {
  id: string;
  case_id: string;
  agent_id: string;
  passed: boolean;
  latency_ms: number;
};

function isEvaluationResult(value: unknown): value is EvaluationResult {
  if (!value || typeof value !== "object") return false;
  const result = value as Record<string, unknown>;
  return (
    typeof result.id === "string" &&
    typeof result.case_id === "string" &&
    typeof result.agent_id === "string" &&
    typeof result.passed === "boolean" &&
    typeof result.latency_ms === "number"
  );
}

export default function EvaluationsPage() {
  const params = useSearchParams();
  const organizationId = params.get("orgId");
  const [results, setResults] = useState<EvaluationResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!organizationId) return;
    const activeOrganizationId = organizationId;

    const controller = new AbortController();

    async function loadResults() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(
          `/api/workspace/${encodeURIComponent(activeOrganizationId)}/evaluations/results`,
          { signal: controller.signal, cache: "no-store" }
        );
        if (!response.ok) {
          throw new Error(`Failed to load evaluations (${response.status})`);
        }
        const data: unknown = await response.json();
        if (!Array.isArray(data) || !data.every(isEvaluationResult)) {
          throw new Error("Evaluation response did not match the expected format");
        }
        setResults(data);
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Unexpected error");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void loadResults();
    return () => controller.abort();
  }, [organizationId]);

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-widest text-violet-400">
          Workspace / Quality
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          AI Evaluations
        </h1>
        <p className="mt-2 text-sm text-zinc-400">
          Review evaluation outcomes and measured response latency.
        </p>
      </header>

      {!organizationId ? (
        <div className="rounded-xl border border-white/10 bg-[#14131e] p-6 text-sm text-zinc-400">
          Select an organization to view evaluations.
        </div>
      ) : loading ? (
        <p role="status" className="text-sm text-zinc-400">
          Loading evaluations...
        </p>
      ) : error ? (
        <div
          role="alert"
          className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300"
        >
          {error}
        </div>
      ) : results.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/15 bg-[#14131e] px-6 py-12 text-center">
          <FlaskConical className="mx-auto size-8 text-violet-400" />
          <h2 className="mt-3 font-semibold">No evaluation results yet</h2>
          <p className="mt-1 text-sm text-zinc-400">
            Results will appear here when evaluations are available.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-white/10 bg-[#14131e]">
          <table className="w-full min-w-[620px] text-left text-sm">
            <thead className="bg-white/5 text-xs uppercase tracking-wide text-zinc-400">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">Case</th>
                <th scope="col" className="px-4 py-3 font-medium">Agent</th>
                <th scope="col" className="px-4 py-3 font-medium">Result</th>
                <th scope="col" className="px-4 py-3 font-medium">Latency</th>
              </tr>
            </thead>
            <tbody>
              {results.map((result) => (
                <tr key={result.id} className="border-t border-white/10">
                  <td className="break-all px-4 py-3 font-mono text-xs">{result.case_id}</td>
                  <td className="break-all px-4 py-3 font-mono text-xs">{result.agent_id}</td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        result.passed
                          ? "font-medium text-emerald-400"
                          : "font-medium text-red-400"
                      }
                    >
                      {result.passed ? "Passed" : "Failed"}
                    </span>
                  </td>
                  <td className="px-4 py-3 tabular-nums">{result.latency_ms} ms</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
