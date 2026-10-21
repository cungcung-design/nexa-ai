"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { useOnboardingState } from "@/hooks/use-onboarding-state";
import { errorMessage } from "@/lib/onboarding";

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * The details of the new workspace.
 *
 * The slug follows the name until the user edits it, the backend checks
 * whether the slug is still free, and the workspace is only saved when the
 * backend confirms it.
 */
export default function WorkspaceInformationPage() {
  const router = useRouter();
  const { state, error, loading, reload } = useOnboardingState(
    "/onboarding/workspace-information"
  );
  const [nameInput, setNameInput] = useState<string | null>(null);
  const [slugInput, setSlugInput] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("");

  // The values of the form start empty and follow the workspace of an
  // earlier attempt as soon as it is known.
  const name = nameInput ?? state?.workspace?.name ?? "";
  const slug = slugInput ?? state?.workspace?.slug ?? "";

  async function checkSlug(value: string) {
    if (!value) return true;
    try {
      const response = await fetch(
        `/api/onboarding/slug-available?slug=${encodeURIComponent(value)}`,
        { cache: "no-store" }
      );
      const data = await response.json().catch(() => ({}));
      return response.ok && data.available !== false;
    } catch {
      return true;
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setMessage("");
    setStatus("");

    if (!name.trim()) {
      setMessage("The workspace name is required.");
      return;
    }
    if (!slug.trim()) {
      setMessage("The workspace slug is required.");
      return;
    }

    setBusy(true);
    setStatus("Saving the workspace...");
    try {
      const available = await checkSlug(slug.trim());
      if (!available) {
        setStatus("");
        setMessage("This workspace slug is already taken.");
        return;
      }
      const response = await fetch("/api/onboarding/workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          slug: slug.trim(),
          description: description.trim(),
          workspace_id: state?.workspace?.id ?? null,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setStatus("");
        setMessage(errorMessage(data, "The workspace could not be saved."));
        return;
      }
      router.push("/onboarding/choose-plan");
    } catch {
      setStatus("");
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

  return (
    <main className="nx-ob-page">
      <div className="nx-ob-card">
        <h1 className="nx-ob-title">Workspace information</h1>
        <p className="nx-ob-description">Tell us about your workspace.</p>

        <form onSubmit={submit}>
          <div className="nx-ob-field">
            <label htmlFor="workspaceName">Workspace Name</label>
            <input
              className="nx-ob-input"
              id="workspaceName"
              name="name"
              type="text"
              placeholder="My Company"
              autoComplete="organization"
              value={name}
              onChange={(event) => {
                setNameInput(event.target.value);
                if (slugInput === null) setSlugInput(slugify(event.target.value));
              }}
              required
            />
          </div>

          <div className="nx-ob-field">
            <label htmlFor="workspaceSlug">Workspace Slug</label>
            <input
              className="nx-ob-input"
              id="workspaceSlug"
              name="slug"
              type="text"
              placeholder="my-company"
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              title="Use lowercase letters, numbers, and single hyphens between words."
              autoCapitalize="none"
              spellCheck={false}
              value={slug}
              onChange={(event) => {
                setSlugInput(event.target.value);
              }}
              required
            />
          </div>

          <div className="nx-ob-field">
            <label htmlFor="workspaceDescription">Description (optional)</label>
            <textarea
              className="nx-ob-textarea"
              id="workspaceDescription"
              name="description"
              placeholder="Describe your workspace..."
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>

          <button
            className="nx-ob-continue nx-ob-details-continue"
            type="submit"
            disabled={busy}
          >
            Continue
          </button>

          <p
            className={`nx-ob-status${message ? " nx-ob-status-error" : ""}`}
            role={message ? "alert" : "status"}
          >
            {message || status}
          </p>
        </form>
      </div>
    </main>
  );
}
