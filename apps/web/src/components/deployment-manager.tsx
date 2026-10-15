"use client";

import { FormEvent, useState } from "react";
import {
  Bot,
  Code2,
  Copy,
  ExternalLink,
  Globe,
  Plus,
  ShieldAlert,
} from "lucide-react";
import type { Agent } from "@/lib/api";

export type Deployment = {
  id: string;
  agent_id: string;
  public_id: string;
  name: string;
  allowed_origins: string[];
  is_active: boolean;
};

function err(data: unknown) {
  if (data && typeof data === "object") {
    const d = data as Record<string, unknown>;
    if (typeof d.detail === "string") return d.detail;
    if (typeof d.error === "string") return d.error;
  }
  return "Request failed";
}

export function DeploymentManager({
  orgId,
  agents,
  initialDeployments,
  canManage,
}: {
  orgId: string;
  agents: Agent[];
  initialDeployments: Deployment[];
  canManage: boolean;
}) {
  const [deployments, setDeployments] = useState(initialDeployments);
  const [name, setName] = useState("Website Support");
  const [agentId, setAgentId] = useState(
    agents.find((a) => a.published_version_id && !a.is_archived)?.id ?? ""
  );
  const [origins, setOrigins] = useState("http://localhost:3000");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [embedBase, setEmbedBase] = useState(
    typeof window !== "undefined" ? window.location.origin : "http://localhost:3000"
  );

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    const allowed_origins = origins
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    try {
      if (!agentId || !name.trim() || !allowed_origins.length)
        throw Error(
          "Enter an agent, deployment name, and at least one origin."
        );
      for (const o of allowed_origins) {
        const u = new URL(o);
        if (
          !["http:", "https:"].includes(u.protocol) ||
          u.username ||
          u.password ||
          u.pathname !== "/" ||
          u.search ||
          u.hash
        )
          throw Error("Enter origins only, e.g. https://example.com");
      }
      const res = await fetch(
        `/api/workspace/${encodeURIComponent(orgId)}/deployments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            agent_id: agentId,
            name: name.trim(),
            allowed_origins,
          }),
        }
      );
      const data: unknown = await res.json();
      if (!res.ok) throw Error(err(data));
      const created = data as Deployment;
      setDeployments((d) => [created, ...d]);
      setSelected(created.public_id);
      setNotice("Deployment created.");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not create deployment"
      );
    } finally {
      setBusy(false);
    }
  }

  const current =
    deployments.find((d) => d.public_id === selected) ?? deployments[0];
  const base = embedBase.replace(/\/$/, "");
  const snippet = current
    ? `<script src="${base}/widget.js" data-agent="${current.public_id}" defer></script>`
    : "";

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

      <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-amber-100">
        <div className="flex gap-2">
          <ShieldAlert className="mt-0.5 size-5 shrink-0" />
          <div>
            <p className="font-semibold">Development only</p>
            <p className="mt-1 text-amber-100/75">
              Public chat does not yet enforce durable per-deployment quotas,
              abuse controls, or a verified iframe-origin protocol. Keep
              public chat disabled on internet-facing deployments until these
              protections are implemented.
            </p>
          </div>
        </div>
      </div>

      {canManage && (
        <section className="rounded-2xl border border-white/10 bg-[#14131e] p-5 sm:p-7">
          <div className="mb-5 flex items-center gap-3">
            <span className="rounded-xl bg-violet-500/15 p-3 text-violet-300">
              <Plus className="size-5" />
            </span>
            <div>
              <h2 className="text-lg font-semibold">Create a deployment</h2>
              <p className="text-sm text-zinc-400">
                Publish an existing agent to a website configuration.
              </p>
            </div>
          </div>
          <form onSubmit={create} className="grid gap-4 md:grid-cols-2">
            <label className="text-sm text-zinc-300">
              Deployment name
              <input
                required
                maxLength={150}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-2 w-full rounded-xl border border-white/15 bg-[#0e0d16] p-3 text-white"
              />
            </label>
            <label className="text-sm text-zinc-300">
              Published agent
              <select
                required
                value={agentId}
                onChange={(e) => setAgentId(e.target.value)}
                className="mt-2 w-full rounded-xl border border-white/15 bg-[#0e0d16] p-3 text-white"
              >
                <option value="">Choose an agent</option>
                {agents
                  .filter((a) => a.published_version_id && !a.is_archived)
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
              </select>
            </label>
            <label className="text-sm text-zinc-300 md:col-span-2">
              Allowed website origins (one per line)
              <textarea
                required
                rows={3}
                value={origins}
                onChange={(e) => setOrigins(e.target.value)}
                className="mt-2 w-full rounded-xl border border-white/15 bg-[#0e0d16] p-3 font-mono text-xs text-white"
              />
              <span className="mt-1 block text-xs text-zinc-500">
                Exact scheme and host, optionally port. Example:
                https://example.com
              </span>
            </label>
            <div className="md:col-span-2">
              <button
                disabled={busy || !agentId}
                className="rounded-xl bg-violet-600 px-5 py-3 text-sm font-semibold hover:bg-violet-500 disabled:opacity-50"
              >
                {busy ? "Creating..." : "Create deployment"}
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">
          Deployments{" "}
          <span className="text-zinc-500">({deployments.length})</span>
        </h2>
        {!deployments.length && (
          <div className="rounded-2xl border border-dashed border-white/15 p-8 text-center text-sm text-zinc-400">
            <Globe className="mx-auto mb-3 size-8 text-violet-300" />
            No deployments yet.
          </div>
        )}
        <div className="grid gap-3 lg:grid-cols-2">
          {deployments.map((d) => (
            <button
              key={d.id}
              onClick={() => setSelected(d.public_id)}
              className={`rounded-2xl border p-5 text-left transition hover:border-violet-400/50 ${
                current?.id === d.id
                  ? "border-violet-400/60 bg-violet-500/10"
                  : "border-white/10 bg-[#14131e]"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <Bot className="size-5 shrink-0 text-violet-300" />
                  <span className="truncate font-semibold">{d.name}</span>
                </div>
                <span
                  className={`rounded-full px-2 py-1 text-xs ${
                    d.is_active
                      ? "bg-emerald-500/10 text-emerald-300"
                      : "bg-zinc-500/10 text-zinc-400"
                  }`}
                >
                  {d.is_active ? "Active" : "Disabled"}
                </span>
              </div>
              <p className="mt-3 break-all font-mono text-xs text-zinc-500">
                {d.public_id}
              </p>
              <p className="mt-2 text-xs text-zinc-400">
                {d.allowed_origins.length} allowed origins
              </p>
            </button>
          ))}
        </div>
      </section>

      {current && (
        <section className="rounded-2xl border border-white/10 bg-[#14131e] p-5 sm:p-7">
          <div className="mb-4 flex items-center gap-2">
            <Code2 className="size-5 text-violet-300" />
            <h2 className="text-lg font-semibold">Embed instructions</h2>
          </div>
          <p className="mb-4 text-sm text-zinc-400">
            Host the Nexa AI widget loader at the URL below, then copy this
            snippet into your website.
          </p>
          <label className="block text-sm text-zinc-300">
            Widget host URL
            <input
              value={embedBase}
              onChange={(e) => setEmbedBase(e.target.value)}
              className="mt-2 w-full rounded-xl border border-white/15 bg-[#0e0d16] p-3 font-mono text-xs text-white"
            />
          </label>
          <pre className="mt-4 overflow-x-auto rounded-xl border border-white/10 bg-[#0e0d16] p-4 text-xs text-violet-200">
            <code>{snippet}</code>
          </pre>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={() =>
                navigator.clipboard
                  .writeText(snippet)
                  .then(() => setNotice("Embed code copied."))
                  .catch(() =>
                    setError("Clipboard unavailable. Copy manually.")
                  )
              }
              className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm hover:bg-violet-500"
            >
              <Copy className="size-4" /> Copy code
            </button>
            <a
              href={`/embed/${encodeURIComponent(current.public_id)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2 text-sm hover:bg-white/5"
            >
              <ExternalLink className="size-4" /> Widget preview
            </a>
          </div>
          <div className="mt-5 space-y-1">
            <p className="text-sm font-medium">Allowed origins</p>
            {current.allowed_origins.map((o) => (
              <p
                key={o}
                className="break-all font-mono text-xs text-zinc-400"
              >
                {o}
              </p>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
