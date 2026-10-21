"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { useOnboardingState } from "@/hooks/use-onboarding-state";
import { completeStep } from "@/lib/onboarding";

/**
 * The choice between a new workspace and an existing one.
 */
export default function OnboardingWorkspacePage() {
  const router = useRouter();
  const { state, error, loading, reload } = useOnboardingState(
    "/onboarding/workspace"
  );
  const [choice, setChoice] = useState("create");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function continueSetup() {
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      await completeStep("workspace");
    } catch (failure) {
      setBusy(false);
      setMessage(
        failure instanceof Error
          ? failure.message
          : "The step could not be saved."
      );
      return;
    }
    const target =
      choice === "join"
        ? "/onboarding/join-workspace"
        : "/onboarding/workspace-information";
    router.push(target);
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

  return (
    <main className="nx-ob-page">
      <div className="nx-ob-card">
        <h1 className="nx-ob-title" id="workspace-title">
          Create your workspace
        </h1>

        <p className="nx-ob-description" id="workspace-description">
          Set up a new workspace or join an existing one.
        </p>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            continueSetup();
          }}
        >
          <fieldset
            className="nx-ob-options"
            aria-labelledby="workspace-title"
            aria-describedby="workspace-description"
          >
            <label className="nx-ob-option">
              <span className="nx-ob-radio">
                <input
                  type="radio"
                  name="workspace"
                  value="create"
                  checked={choice === "create"}
                  onChange={() => setChoice("create")}
                  required
                />
                <span className="nx-ob-radio-mark" />
              </span>

              <span>
                <span className="nx-ob-option-title">
                  Create a new workspace
                </span>
                <span className="nx-ob-option-description">
                  Start a new organization for your team.
                </span>
              </span>
            </label>

            <label className="nx-ob-option">
              <span className="nx-ob-radio">
                <input
                  type="radio"
                  name="workspace"
                  value="join"
                  checked={choice === "join"}
                  onChange={() => setChoice("join")}
                />
                <span className="nx-ob-radio-mark" />
              </span>

              <span>
                <span className="nx-ob-option-title">
                  Join an existing workspace
                </span>
                <span className="nx-ob-option-description">
                  Use an invitation link or join your team.
                </span>
              </span>
            </label>
          </fieldset>

          <button className="nx-ob-continue" type="submit" disabled={busy}>
            Continue
          </button>

          <p
            className={`nx-ob-status${message ? " nx-ob-status-error" : ""}`}
            role={message ? "alert" : "status"}
          >
            {message}
          </p>
        </form>
      </div>
    </main>
  );
}
