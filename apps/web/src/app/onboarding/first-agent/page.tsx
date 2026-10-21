"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { useOnboardingState } from "@/hooks/use-onboarding-state";
import { errorMessage } from "@/lib/onboarding";

type CreatedAgent = {
  id: string;
  name: string;
  description: string;
  created: boolean;
};

/**
 * The first agent of the onboarding flow.
 *
 * The agent is created by the backend, the page only shows the result and
 * lets the user skip the step.
 */
export default function FirstAgentPage() {
  const router = useRouter();
  const { state, error, loading, reload } = useOnboardingState(
    "/onboarding/first-agent"
  );
  const [agent, setAgent] = useState<CreatedAgent | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("");

  async function create() {
    if (busy || !state?.workspace) return;
    setBusy(true);
    setMessage("");
    setStatus("Creating your first agent...");
    try {
      const response = await fetch("/api/onboarding/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspace_id: state.workspace.id }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setStatus("");
        setMessage(errorMessage(data, "The agent could not be created."));
        return;
      }
      setAgent(data as CreatedAgent);
      setStatus("");
    } catch {
      setStatus("");
      setMessage("Network error. Please retry.");
    } finally {
      setBusy(false);
    }
  }

  async function skip() {
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/onboarding/skip", { method: "POST" });
      if (!response.ok) {
        setMessage("The onboarding could not be finished.");
        return;
      }
      router.push(
        state?.workspace
          ? `/dashboard/organizations/${state.workspace.id}`
          : "/dashboard"
      );
    } catch {
      setMessage("Network error. Please retry.");
    } finally {
      setBusy(false);
    }
  }

  if (loading || (!state && !error)) {
    return (
      <main className="nx-ob-page">
        <p className="nx-ob-status">Loading your onboarding...</p>
      </main>
    );
  }

  if (!state) {
    return (
      <main className="nx-ob-page">
        <div className="nx-ob-card nx-ob-center-status">
          <p className="nx-ob-status nx-ob-status-error">{error}</p>
          <button
            className="nx-ob-continue"
            type="button"
            onClick={() => void reload()}
          >
            Try again
          </button>
        </div>
      </main>
    );
  }

  if (agent) {
    return (
      <main className="nx-ob-page">
        <div className="nx-ob-card nx-ob-center-status">
          <div className="nx-ob-agent-icon" style={{ margin: "0 auto 16px" }}>
            <svg viewBox="0 0 24 24">
              <rect x="5" y="7" width="14" height="13" rx="4" />
              <path d="M12 3v4M2 11v5m20-5v5M9 12v2m6-2v2m-6 3h6" />
            </svg>
          </div>

          <h1 className="nx-ob-title">Your agent is ready</h1>
          <p className="nx-ob-description">
            {agent.name} is now part of your workspace.
          </p>

          <button
            className="nx-ob-create"
            type="button"
            onClick={() =>
              router.push(
                state.workspace
                  ? `/dashboard/organizations/${state.workspace.id}`
                  : "/dashboard"
              )
            }
          >
            Go to the dashboard
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="nx-ob-page">
      <div className="nx-ob-card">
        <h1 className="nx-ob-title">Create your first agent</h1>
        <p className="nx-ob-description">
          Start with a ready to use template and adjust it later.
        </p>

        <div className="nx-ob-agent-template">
          <div className="nx-ob-agent-icon">
            <svg viewBox="0 0 24 24">
              <rect x="5" y="7" width="14" height="13" rx="4" />
              <path d="M12 3v4M2 11v5m20-5v5M9 12v2m6-2v2m-6 3h6" />
            </svg>
          </div>

          <div>
            <h2 className="nx-ob-agent-name">Customer Support Agent</h2>
            <p className="nx-ob-agent-description">
              A helpful agent that answers questions using your knowledge base.
            </p>
          </div>
        </div>

        <button
          className="nx-ob-create"
          type="button"
          onClick={create}
          disabled={busy || !state.workspace}
        >
          Create the agent
        </button>

        <button className="nx-ob-skip" type="button" onClick={skip} disabled={busy}>
          Skip for now
        </button>

        <p
          className={`nx-ob-status nx-ob-center-status${message ? " nx-ob-status-error" : ""}`}
          role={message ? "alert" : "status"}
        >
          {message || status}
        </p>
      </div>
    </main>
  );
}
