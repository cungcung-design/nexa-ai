"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import {
  LoaderCircle,
  Save,
  ShieldAlert,
  Trash2,
  UploadCloud,
} from "lucide-react";
import type { Agent, AgentVersion } from "@/lib/api";

function errorMessage(data: unknown, fallback: string) {
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    if (typeof obj.detail === "string") return obj.detail;
    if (typeof obj.error === "string") return obj.error;
  }
  return fallback;
}

// Editable agent configuration backed by the real FastAPI version routes:
// PATCH profile, POST new draft versions, publish a version, archive agent.
export function AgentVersionManager({
  orgId,
  agent,
  versions: initialVersions,
}: {
  orgId: string;
  agent: Agent;
  versions: AgentVersion[];
}) {
  const router = useRouter();
  const [versions, setVersions] = useState(initialVersions);
  const [name, setName] = useState(agent.name);
  const [description, setDescription] = useState(agent.description ?? "");
  const [systemPrompt, setSystemPrompt] = useState(
    "You are a helpful assistant for this organization."
  );
  // Default matches the backend's configured LLM (LLM_DEFAULT_MODEL).
  const [model, setModel] = useState("qwen3:4b");
  const [temperature, setTemperature] = useState(0.3);
  const [maxTokens, setMaxTokens] = useState(1024);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const base = `/api/workspace/${encodeURIComponent(orgId)}/agents/${encodeURIComponent(agent.id)}`;

  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(base, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(errorMessage(data, "Could not update agent"));
      setNotice("Profile saved.");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update agent");
    } finally {
      setBusy(false);
    }
  }

  async function saveVersion(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`${base}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_prompt: systemPrompt,
          model,
          temperature,
          max_tokens: maxTokens,
          tools_config: {},
        }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(errorMessage(data, "Could not save version"));
      setVersions((current) => [data as AgentVersion, ...current]);
      setNotice(`Version ${(data as AgentVersion).version_number} saved.`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save version");
    } finally {
      setBusy(false);
    }
  }

  async function publish(versionId: string) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`${base}/publish/${encodeURIComponent(versionId)}`, {
        method: "POST",
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(errorMessage(data, "Could not publish version"));
      setNotice("Version published.");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not publish version");
    } finally {
      setBusy(false);
    }
  }

  async function archive() {
    if (!window.confirm("Archive this agent? It will no longer be usable."))
      return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(base, { method: "DELETE" });
      if (!response.ok && response.status !== 204) {
        const data = await response.json();
        throw new Error(errorMessage(data, "Could not archive agent"));
      }
      router.push(`/dashboard/organizations/${orgId}/agents`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not archive agent");
      setBusy(false);
    }
  }

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

      <form
        onSubmit={saveProfile}
        className="space-y-4 rounded-2xl border border-white/10 bg-[#14131e] p-6"
      >
        <h2 className="text-lg font-semibold">Profile</h2>
        <label className="block text-sm font-medium text-zinc-400">
          Agent name
          <input
            required
            minLength={2}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-2 min-h-11 w-full rounded-lg border border-white/15 bg-black/20 px-4 py-2.5 outline-none focus:border-violet-500"
          />
        </label>
        <label className="block text-sm font-medium text-zinc-400">
          Description
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="mt-2 w-full rounded-lg border border-white/15 bg-black/20 px-4 py-3 outline-none focus:border-violet-500"
          />
        </label>
        <button
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold hover:bg-violet-500 disabled:opacity-60"
        >
          {busy ? (
            <LoaderCircle className="size-4 animate-spin" />
          ) : (
            <Save className="size-4" />
          )}
          Save profile
        </button>
      </form>

      <form
        onSubmit={saveVersion}
        className="space-y-4 rounded-2xl border border-white/10 bg-[#14131e] p-6"
      >
        <h2 className="text-lg font-semibold">New configuration version</h2>
        <label className="block text-sm font-medium text-zinc-400">
          System instructions
          <textarea
            required
            minLength={10}
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            rows={5}
            className="mt-2 w-full rounded-lg border border-white/15 bg-black/20 px-4 py-3 outline-none focus:border-violet-500"
          />
        </label>
        <label className="block text-sm font-medium text-zinc-400">
          Model
          <input
            required
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="mt-2 min-h-11 w-full rounded-lg border border-white/15 bg-black/20 px-4 py-2.5 outline-none focus:border-violet-500"
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm text-zinc-400">
            Temperature
            <input
              type="number"
              min={0}
              max={2}
              step={0.1}
              value={temperature}
              onChange={(e) => setTemperature(Number(e.target.value))}
              className="mt-2 w-full rounded-xl border border-white/15 bg-black/20 px-4 py-3 text-white outline-none focus:border-violet-500"
            />
          </label>
          <label className="text-sm text-zinc-400">
            Maximum tokens
            <input
              type="number"
              min={1}
              max={8192}
              value={maxTokens}
              onChange={(e) => setMaxTokens(Number(e.target.value))}
              className="mt-2 w-full rounded-xl border border-white/15 bg-black/20 px-4 py-3 text-white outline-none focus:border-violet-500"
            />
          </label>
        </div>
        <button
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold hover:bg-violet-500 disabled:opacity-60"
        >
          {busy ? (
            <LoaderCircle className="size-4 animate-spin" />
          ) : (
            <UploadCloud className="size-4" />
          )}
          Save version
        </button>
      </form>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Version history</h2>
        {versions.length === 0 ? (
          <p className="text-sm text-zinc-500">No versions saved yet.</p>
        ) : (
          versions.map((version) => (
            <article
              key={version.id}
              className="rounded-2xl border border-white/10 bg-[#14131e] p-5"
            >
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-semibold">
                  Version {version.version_number}
                </h3>
                {agent.published_version_id === version.id ? (
                  <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-300">
                    Live
                  </span>
                ) : (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => publish(version.id)}
                    className="rounded-full bg-violet-500/15 px-2.5 py-1 text-xs text-violet-300 hover:bg-violet-500/25 disabled:opacity-50"
                  >
                    Publish
                  </button>
                )}
              </div>
              <p className="mt-2 text-sm text-zinc-400">
                {version.model} · temp {version.temperature} ·{" "}
                {version.max_tokens} tokens
              </p>
              <p className="mt-3 line-clamp-4 text-sm text-zinc-300">
                {version.system_prompt}
              </p>
            </article>
          ))
        )}
      </section>

      <div className="flex items-start justify-between gap-4 rounded-2xl border border-white/10 bg-[#14131e] p-5">
        <div className="flex items-start gap-3 text-sm text-zinc-400">
          <ShieldAlert className="mt-0.5 size-5 shrink-0 text-violet-300" />
          Archiving removes the agent from active use. Published versions stay
          immutable.
        </div>
        <button
          type="button"
          onClick={archive}
          disabled={busy}
          className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-red-500/30 px-4 py-2 text-sm text-red-300 hover:bg-red-500/10 disabled:opacity-50"
        >
          <Trash2 className="size-4" /> Archive
        </button>
      </div>
    </div>
  );
}
