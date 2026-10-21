"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { useOnboardingState } from "@/hooks/use-onboarding-state";
import { errorMessage } from "@/lib/onboarding";

type InvitationPreview = {
  organization_id: string;
  organization_name: string;
  email: string;
  role: string;
  role_label: string;
  status: string;
  message: string | null;
  expires_at: string;
};

/**
 * The invitation flow of the onboarding.
 *
 * The invitation code is validated by the backend before the user accepts it,
 * and the membership is only granted by the backend.
 */
export default function JoinWorkspacePage() {
  const router = useRouter();
  const { error } = useOnboardingState("/onboarding/join-workspace");
  const [code, setCode] = useState("");
  const [preview, setPreview] = useState<InvitationPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("");

  function extractToken(value: string) {
    const trimmed = value.trim();
    if (!trimmed) return "";
    const parts = trimmed.split("/").filter(Boolean);
    if (parts.length >= 2) {
      const index = parts.indexOf("invitations");
      if (index >= 0 && parts[index + 1]) return parts[index + 1];
    }
    return trimmed;
  }

  async function lookup() {
    const token = extractToken(code);
    if (!token) {
      setMessage("Enter the invitation code of your workspace.");
      return;
    }
    setBusy(true);
    setMessage("");
    setStatus("Checking the invitation...");
    try {
      const response = await fetch(`/api/invitations/${encodeURIComponent(token)}`, {
        cache: "no-store",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setStatus("");
        setMessage(
          errorMessage(data, "This invitation is not available. Ask for a new one.")
        );
        return;
      }
      setPreview(data as InvitationPreview);
      setStatus("");
    } catch {
      setStatus("");
      setMessage("Network error. Please retry.");
    } finally {
      setBusy(false);
    }
  }

  async function accept() {
    if (!preview) return;
    setBusy(true);
    setMessage("");
    setStatus("Joining the workspace...");
    try {
      const response = await fetch(
        `/api/invitations/${encodeURIComponent(extractToken(code))}/accept`,
        { method: "POST" }
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setStatus("");
        setMessage(errorMessage(data, "The invitation could not be accepted."));
        return;
      }
      const joined = await fetch("/api/onboarding/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspace_id: preview.organization_id }),
      });
      if (!joined.ok) {
        const payload = await joined.json().catch(() => ({}));
        setStatus("");
        setMessage(errorMessage(payload, "The workspace could not be opened."));
        return;
      }
      router.push("/onboarding/first-agent");
    } catch {
      setStatus("");
      setMessage("Network error. Please retry.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="nx-ob-page">
      <div className="nx-ob-card">
        <h1 className="nx-ob-title">Join an existing workspace</h1>
        <p className="nx-ob-description">
          Enter the invitation code you received by email.
        </p>

        <div className="nx-ob-field">
          <label htmlFor="invitationCode">Invitation code</label>
          <input
            className="nx-ob-input"
            id="invitationCode"
            name="invitation"
            type="text"
            placeholder="Paste the invitation code or link"
            autoComplete="off"
            value={code}
            onChange={(event) => setCode(event.target.value)}
          />
        </div>

        <button
          className="nx-ob-continue"
          type="button"
          onClick={lookup}
          disabled={busy}
          style={{ marginTop: 0 }}
        >
          Check invitation
        </button>

        {preview && (
          <div className="nx-ob-field" style={{ marginTop: 18 }}>
            <label htmlFor="invitationWorkspace">Workspace</label>
            <p
              id="invitationWorkspace"
              style={{ margin: 0, fontSize: 12, color: "#413653" }}
            >
              {preview.organization_name} — {preview.role_label}
            </p>
            <p style={{ margin: "4px 0 0", fontSize: 11, color: "#938aa5" }}>
              Invited: {preview.email} · Status: {preview.status}
            </p>
            {preview.message ? (
              <p style={{ margin: "6px 0 0", fontSize: 11, color: "#938aa5" }}>
                {preview.message}
              </p>
            ) : null}
          </div>
        )}

        {preview && (
          <button
            className="nx-ob-continue"
            type="button"
            onClick={accept}
            disabled={busy || preview.status !== "PENDING"}
          >
            Accept and continue
          </button>
        )}

        <p
          className={`nx-ob-status${message ? " nx-ob-status-error" : ""}`}
          role={message ? "alert" : "status"}
        >
          {message || status || error}
        </p>
      </div>
    </main>
  );
}
