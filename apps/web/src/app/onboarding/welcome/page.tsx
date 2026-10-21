"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { useOnboardingState } from "@/hooks/use-onboarding-state";
import { completeStep } from "@/lib/onboarding";

const STEPS = [
  { key: "workspace", label: "Create or join workspace" },
  { key: "workspace_information", label: "Workspace information" },
  { key: "plan", label: "Choose plan" },
  { key: "preferences", label: "Initial preferences" },
  { key: "first_agent", label: "Create your first agent" },
];

/**
 * The welcome of the onboarding flow.
 *
 * The page resumes the session of the user, so the checklist shows the steps
 * that are already finished.
 */
export default function OnboardingWelcomePage() {
  const router = useRouter();
  const { state, error, loading, reload } = useOnboardingState(
    "/onboarding/welcome"
  );
  const [status, setStatus] = useState("");

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

  const done = new Set(state.completed_steps);
  const finished = state.step === "complete" && state.workspace;

  async function start() {
    setStatus("");
    if (finished && state?.workspace) {
      router.push(`/dashboard/organizations/${state.workspace.id}`);
      return;
    }
    try {
      await completeStep("welcome");
    } catch {
      // The step is only a marker, the flow continues even when it fails.
    }
    router.push("/onboarding/workspace");
  }

  return (
    <main className="nx-ob-page">
      <div className="nx-ob-welcome">
        <section className="nx-ob-welcome-content" aria-labelledby="welcome-title">
          <h1 className="nx-ob-welcome-title" id="welcome-title">
            Welcome to Nexa AI
          </h1>

          <p className="nx-ob-welcome-description">
            Let&apos;s set up your workspace and get you started.
          </p>

          <ol className="nx-ob-steps">
            {STEPS.map((step, index) => (
              <li
                key={step.key}
                className={done.has(step.key) ? "nx-ob-step-done" : undefined}
              >
                <span className="nx-ob-step-number">
                  {done.has(step.key) ? "✓" : index + 1}
                </span>
                {step.label}
              </li>
            ))}
          </ol>

          <button className="nx-ob-start" type="button" onClick={start}>
            {finished ? "Open your workspace" : "Get Started"}
          </button>

          {status ? <p className="nx-ob-status">{status}</p> : null}

          {state.workspace ? (
            <p className="nx-ob-status">
              Workspace: {state.workspace.name} ({state.workspace.slug})
            </p>
          ) : null}
        </section>

        <div className="nx-ob-illustration" aria-hidden="true">
          <div className="nx-ob-back-window" />

          <div className="nx-ob-dashboard">
            <div className="nx-ob-rail">
              <span>✣</span>
              <span>▣</span>
              <span>◇</span>
              <span>⌘</span>
              <span>▤</span>
              <span>◈</span>
              <span>◎</span>
              <span>⚙</span>
            </div>

            <div className="nx-ob-sidebar">
              <div className="nx-ob-mini-brand">✣ Nexa AI</div>
              <div className="nx-ob-nav-line nx-ob-nav-line-active">▣ Dashboard</div>
              <div className="nx-ob-nav-line">♧ AI Agents</div>
              <div className="nx-ob-nav-line">⌘ Workflows</div>
              <div className="nx-ob-nav-line">▤ Knowledge Base</div>
              <div className="nx-ob-nav-line">◈ Integrations</div>
              <div className="nx-ob-nav-line">▢ Conversations</div>
              <div className="nx-ob-nav-line">◇ Approvals</div>
              <div className="nx-ob-nav-line">▥ Analytics</div>
              <div className="nx-ob-nav-line">▧ Audit Logs</div>
              <div className="nx-ob-nav-line">♧ Team</div>
              <div className="nx-ob-nav-line">⚙ Settings</div>
            </div>

            <div className="nx-ob-dashboard-main">
              <div className="nx-ob-toolbar">
                <div className="nx-ob-search" />
                <span className="nx-ob-create-chip">＋ Create Agent</span>
              </div>

              <h2 className="nx-ob-mini-heading">Workspace Overview</h2>

              <div className="nx-ob-stats">
                <div className="nx-ob-stat">
                  <small>Total Agents</small>
                  <strong>12</strong>
                </div>
                <div className="nx-ob-stat">
                  <small>Workflow Runs</small>
                  <strong>892</strong>
                </div>
                <div className="nx-ob-stat">
                  <small>Approvals</small>
                  <strong>5</strong>
                </div>
              </div>

              <div className="nx-ob-panels">
                <div className="nx-ob-panel">
                  <h3>Usage Overview</h3>
                  <svg
                    className="nx-ob-chart"
                    viewBox="0 0 130 75"
                    preserveAspectRatio="none"
                  >
                    <defs>
                      <linearGradient id="usageFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0" stopColor="#8f6bff" stopOpacity=".8" />
                        <stop offset="1" stopColor="#8f6bff" stopOpacity=".08" />
                      </linearGradient>
                    </defs>
                    <path d="M0 15h130M0 35h130M0 55h130" stroke="#f0ecf9" fill="none" />
                    <path
                      d="M0 60C10 58 12 35 24 38S39 57 49 45 S63 16 75 23S88 44 99 28S117 18 130 26V75H0Z"
                      fill="url(#usageFill)"
                    />
                    <path
                      d="M0 60C10 58 12 35 24 38S39 57 49 45 S63 16 75 23S88 44 99 28S117 18 130 26"
                      stroke="#8a60ff"
                      strokeWidth="1.7"
                      fill="none"
                    />
                  </svg>
                </div>

                <div className="nx-ob-panel">
                  <h3>Recent Activity</h3>
                  <div className="nx-ob-activity-line">
                    <span className="nx-ob-activity-dot" />
                    <span className="nx-ob-activity-text" />
                  </div>
                  <div className="nx-ob-activity-line">
                    <span className="nx-ob-activity-dot" />
                    <span className="nx-ob-activity-text" />
                  </div>
                  <div className="nx-ob-activity-line">
                    <span className="nx-ob-activity-dot" />
                    <span className="nx-ob-activity-text" />
                  </div>
                  <div className="nx-ob-activity-line">
                    <span className="nx-ob-activity-dot" />
                    <span className="nx-ob-activity-text" />
                  </div>
                </div>
              </div>

              <div className="nx-ob-bottom-lines">
                <span />
                <span />
                <span />
              </div>
            </div>
          </div>

          <div className="nx-ob-tile nx-ob-tile-one">
            <svg viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="8" />
              <path d="M12 8v5m0 3h.01" />
            </svg>
          </div>

          <div className="nx-ob-tile nx-ob-tile-two">
            <svg viewBox="0 0 24 24">
              <rect x="5" y="4" width="14" height="16" rx="3" />
              <path d="M9 8h6m-6 4h6m-6 4h3" />
            </svg>
          </div>

          <div className="nx-ob-tile nx-ob-tile-three">
            <svg viewBox="0 0 24 24">
              <rect x="5" y="7" width="14" height="13" rx="4" />
              <path d="M12 3v4M2 11v5m20-5v5M9 12v2m6-2v2m-6 3h6" />
            </svg>
          </div>

          <div className="nx-ob-tile nx-ob-tile-four">
            <svg viewBox="0 0 24 24">
              <path d="M6 3h9l4 4v14H6V3Zm9 0v5h4M9 12h7m-7 4h5" />
            </svg>
          </div>

          <div className="nx-ob-tile nx-ob-tile-five">
            <svg viewBox="0 0 24 24">
              <path d="m12 3 8 4v5c0 5-8 9-8 9s-8-4-8-9V7l8-4Z" />
              <path d="m9 12 2 2 4-4" />
            </svg>
          </div>

          <div className="nx-ob-tile nx-ob-tile-six">
            <svg viewBox="0 0 24 24">
              <path d="m12 3 8 5v9l-8 4-8-4V8l8-5Zm-8 5 8 4 8-4m-8 4v9" />
            </svg>
          </div>
        </div>
      </div>
    </main>
  );
}
