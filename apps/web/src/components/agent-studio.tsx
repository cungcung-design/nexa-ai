"use client";

import { useParams, usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  Book,
  Check,
  FileText,
  Globe,
  Layers,
  LoaderCircle,
  MessageCircle,
  Rocket,
  Save,
  Settings,
  ShieldCheck,
  User,
  X,
} from "lucide-react";
import type { ComponentType, SVGProps } from "react";
import type { Agent, AgentVersion } from "@/lib/api";

type SVGIcon = ComponentType<SVGProps<SVGSVGElement>>;

const STUDIO_NAV: { name: string; icon: SVGIcon; segment: string }[] = [
  { name: "Overview", icon: MessageCircle, segment: "overview" },
  { name: "Instructions", icon: FileText, segment: "instructions" },
  { name: "Model", icon: Settings, segment: "model" },
  { name: "Knowledge", icon: Book, segment: "knowledge" },
  { name: "Tools", icon: ShieldCheck, segment: "tools" },
  { name: "Memory", icon: User, segment: "memory" },
  { name: "Versions", icon: Layers, segment: "versions" },
  { name: "Deployment", icon: Rocket, segment: "deployments" },
];

function getError(data: unknown, fallback: string) {
  if (data && typeof data === "object") {
    const d = data as Record<string, unknown>;
    if (typeof d.error === "string") return d.error;
    if (typeof d.detail === "string") return d.detail;
  }
  return fallback;
}

export function AgentStudio({
  agent,
  versions,
}: {
  agent: Agent;
  versions: AgentVersion[];
}) {
  const params = useParams<{ organizationId: string; agentId: string }>();
  const router = useRouter();
  const pathname = usePathname();
  const orgId = params.organizationId ?? "";
  const agentId = params.agentId ?? "";

  const match = STUDIO_NAV.find((n) => isActive(n.segment));
  const activeSection = match ? match.segment : "overview";

  const [unsaved, setUnsaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const base = `/api/workspace/${encodeURIComponent(orgId)}/agents/${encodeURIComponent(agentId)}`;
  const basePath = `/dashboard/organizations/${encodeURIComponent(orgId)}/agents/${encodeURIComponent(agentId)}/studio`;
  const isActive = (segment: string) => {
    const expected = `${basePath}/${segment}`;
    return pathname === expected || pathname.startsWith(expected + "/");
  };

  async function saveDraft() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(base, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: agent.name, description: agent.description }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(getError(data, "Could not save draft"));
      setUnsaved(false);
      setNotice("Draft saved.");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save draft");
    } finally {
      setBusy(false);
    }
  }

  async function publishVersion(versionId: string) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`${base}/publish/${encodeURIComponent(versionId)}`, {
        method: "POST",
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(getError(data, "Could not publish version"));
      setNotice("Version published.");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not publish version");
    } finally {
      setBusy(false);
    }
  }

  const isPublished = !!agent.published_version_id && !agent.is_archived;
  const statusText = agent.is_archived ? "Archived" : isPublished ? "Published" : "Draft";
  const latestVersion = versions[0]?.version_number ?? 1;

  return (
    <div className="space-y-6">
      {/* Error / Notice */}
      {error && (
        <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
          {error}
        </div>
      )}
      {notice && (
        <div role="status" className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">
          {notice}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex flex-col gap-1">
          <p className="text-xs text-gray-400 font-medium">
            AI Agents / {agent.name} / Studio
          </p>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">
              {agent.name}
            </h1>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
              isPublished
                ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                : agent.is_archived
                  ? "bg-gray-100 text-gray-600 border border-gray-200/60"
                  : "bg-gray-100 text-gray-600 border border-gray-200/60"
            }`}>
              {statusText}
            </span>
            {unsaved && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200/60">
                <X className="size-3" /> Unsaved changes
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={saveDraft}
            disabled={busy || !unsaved}
            className={`inline-flex items-center gap-2 px-4 py-2.5 text-xs font-medium rounded-xl transition-colors shadow-sm ${
              busy || !unsaved
                ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                : "bg-gray-900 hover:bg-gray-800 text-white"
            }`}
          >
            {busy ? (
              <LoaderCircle className="size-3.5 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            Save Draft
          </button>
          <button
            onClick={() => {}}
            disabled={!isPublished}
            className={`px-4 py-2.5 text-xs font-medium rounded-xl transition-colors ${
              !isPublished
                ? "bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200/80"
                : "bg-gray-900 hover:bg-gray-800 text-white"
            }`}
          >
            Run Evaluation
          </button>
          <button
            onClick={() => {}}
            disabled={!isPublished}
            className={`px-4 py-2.5 text-xs font-medium rounded-xl transition-colors shadow-sm ${
              !isPublished
                ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                : "bg-indigo-600 hover:bg-indigo-700 text-white"
            }`}
          >
            Publish
          </button>
        </div>
      </div>

      {/* Three-Panel Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Panel 1: Configuration Sidebar */}
        <div className="lg:col-span-3 space-y-1">
          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider px-2 mb-1">
            Configuration
          </p>
          {STUDIO_NAV.map(({ name, icon: Icon, segment }) => {
            const active = activeSection === segment;
            return (
              <button
                key={name}
                onClick={() => {
                  router.push(`${basePath}/${segment}`);
                }}
                className={`flex items-center gap-3 px-3 py-2 text-xs font-medium rounded-xl transition-colors duration-200 ease-out ${
                  active
                    ? "bg-indigo-50/70 border border-indigo-100/60 text-indigo-600 font-semibold shadow-2xs"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                }`}
              >
                <Icon className={`w-4 h-4 ${active ? "text-indigo-600" : "text-gray-400"}`} />
                {name}
              </button>
            );
          })}
        </div>

        {/* Panel 2: Configuration Editor */}
        <div className="lg:col-span-5 flex flex-col min-h-[600px]">
          {activeSection === "overview" && (
            <div className="flex-1 bg-white border border-gray-200/80 rounded-2xl p-6 shadow-xs space-y-6">
              <div>
                <h2 className="text-sm font-bold text-gray-900 tracking-tight">Overview</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Agent identity, status, and version information.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-gray-50 border border-gray-100 rounded-xl p-4">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                    Identity
                  </p>
                  <p className="text-sm font-semibold text-gray-900">{agent.name}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {agent.description || "No description set."}
                  </p>
                </div>
                <div className="bg-gray-50 border border-gray-100 rounded-xl p-4">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                    Status
                  </p>
                  <p className="text-sm font-semibold text-gray-900">{statusText}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Version {latestVersion}
                  </p>
                </div>
              </div>
              <div className="bg-gray-50 border border-gray-100 rounded-xl p-4">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                  Versions
                </p>
                <div className="space-y-2">
                  {versions.length > 0 ? (
                    versions.map((v) => (
                      <div
                        key={v.id}
                        className="flex items-center justify-between p-3 bg-white border border-gray-200/80 rounded-xl text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-gray-900">
                            v{v.version_number}
                          </span>
                          {agent.published_version_id === v.id && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">
                              Live
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => publishVersion(v.id)}
                          disabled={busy}
                          className={`text-xs font-medium transition-colors ${
                            busy
                              ? "text-gray-400 cursor-not-allowed"
                              : "text-indigo-600 hover:text-indigo-800"
                          }`}
                        >
                          {busy ? "..." : "Publish"}
                        </button>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-gray-400">No versions yet.</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeSection === "instructions" && (
            <div className="flex-1 bg-white border border-gray-200/80 rounded-2xl p-6 shadow-xs flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-gray-900 tracking-tight">
                  System Instructions
                </h2>
                <button
                  onClick={() => setUnsaved(true)}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                >
                  Reset
                </button>
              </div>
              <textarea
                value={agent.description || ""}
                onChange={() => setUnsaved(true)}
                rows={12}
                className="w-full bg-transparent text-sm text-gray-900 focus:outline-none resize-none leading-relaxed"
                placeholder="Define the agent's behavior, persona, and instructions..."
              />
              <p className="text-[10px] text-gray-400 mt-2 border-t border-gray-100 pt-3">
                Changes affect the draft, not the published version.
              </p>
            </div>
          )}

          {activeSection === "model" && (
            <div className="flex-1 bg-white border border-gray-200/80 rounded-2xl p-6 shadow-xs space-y-6">
              <h2 className="text-sm font-bold text-gray-900 tracking-tight">Model Configuration</h2>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-gray-700">Provider</label>
                  <select className="w-full bg-white border border-gray-200/80 rounded-xl px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/10">
                    <option>OpenAI</option>
                    <option>Claude</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-gray-700">Model</label>
                  <select className="w-full bg-white border border-gray-200/80 rounded-xl px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/10">
                    <option>gpt-4o-mini</option>
                    <option>gpt-4o</option>
                    <option>claude-3-5-sonnet</option>
                    <option>claude-3-haiku</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-gray-700 flex justify-between">
                    <span>Temperature</span>
                    <span className="text-gray-500 font-medium">0.7</span>
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="2"
                    step="0.1"
                    defaultValue="0.7"
                    className="w-full accent-gray-900 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-gray-700">Max Output Tokens</label>
                  <input
                    type="number"
                    value="1024"
                    className="w-full bg-white border border-gray-200/80 rounded-xl px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                  />
                </div>
              </div>
              <p className="text-[10px] text-gray-400 italic">
                Only options supported by the selected model are shown.
              </p>
            </div>
          )}

          {activeSection === "knowledge" && (
            <div className="flex-1 bg-white border border-gray-200/80 rounded-2xl p-6 shadow-xs flex flex-col">
              <h2 className="text-sm font-bold text-gray-900 tracking-tight">Knowledge Sources</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Attach approved knowledge base documents to this agent.
              </p>
              <div className="mt-4 flex items-center justify-between p-4 bg-gray-50 border border-gray-100 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                    <Book className="size-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Support Documentation</p>
                    <p className="text-xs text-gray-500">3 documents attached</p>
                  </div>
                </div>
                <button className="text-xs text-indigo-600 hover:underline font-medium">
                  Open Knowledge Base →
                </button>
              </div>
            </div>
          )}

          {activeSection === "tools" && (
            <div className="flex-1 bg-white border border-gray-200/80 rounded-2xl p-6 shadow-xs space-y-4">
              <h2 className="text-sm font-bold text-gray-900 tracking-tight">Tools</h2>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-gray-50 border border-gray-100 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                      <Globe className="size-3" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">Web Search</p>
                      <p className="text-xs text-gray-500">Search the web for current information</p>
                    </div>
                  </div>
                  <button className="w-6 h-6 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-400 hover:text-gray-900 transition-colors">
                    <Check className="size-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeSection === "memory" && (
            <div className="flex-1 bg-white border border-gray-200/80 rounded-2xl p-6 shadow-xs space-y-4">
              <h2 className="text-sm font-bold text-gray-900 tracking-tight">Memory Configuration</h2>
              <div className="space-y-3">
                <div className="p-3 bg-gray-50 border border-gray-100 rounded-xl">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                    Context Window
                  </p>
                  <p className="text-sm font-semibold text-gray-900">10 messages</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Conversation history retained per session.
                  </p>
                </div>
                <div className="p-3 bg-gray-50 border border-gray-100 rounded-xl">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                    Retention Period
                  </p>
                  <p className="text-sm font-semibold text-gray-900">30 days</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Within organization policies.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeSection === "versions" && (
            <div className="flex-1 bg-white border border-gray-200/80 rounded-2xl p-6 shadow-xs flex flex-col">
              <h2 className="text-sm font-bold text-gray-900 tracking-tight">Version History</h2>
              <div className="mt-4 space-y-3">
                {versions.length > 0 ? (
                  versions.map((v) => (
                    <div
                      key={v.id}
                      className="p-4 bg-gray-50 border border-gray-100 rounded-xl"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-semibold text-gray-900">
                          v{v.version_number}
                        </span>
                        {agent.published_version_id === v.id && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">
                            Live
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">
                        {v.model} · temp {v.temperature} · {v.max_tokens} tokens
                      </p>
                      <button
                        onClick={() => publishVersion(v.id)}
                        className="mt-2 text-xs text-indigo-600 hover:underline font-medium"
                      >
                        Publish version
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-gray-400 text-center py-4">
                    No versions saved yet.
                  </p>
                )}
              </div>
            </div>
          )}

          {activeSection === "deployments" && (
            <div className="flex-1 bg-white border border-gray-200/80 rounded-2xl p-6 shadow-xs space-y-4">
              <h2 className="text-sm font-bold text-gray-900 tracking-tight">Deployments</h2>
              <div className="bg-gray-50 border border-gray-100 rounded-xl p-4">
                <p className="text-xs font-semibold text-gray-700 mb-2">API Access</p>
                <p className="text-xs text-gray-500 mb-3">
                  Published agents are accessible via API at configured endpoints.
                </p>
                <button className="text-xs text-indigo-600 hover:underline font-medium">
                  Configure Deployment →
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Panel 3: Live Preview */}
        <div className="lg:col-span-4 flex flex-col min-h-[600px]">
          <div className="flex items-center gap-2 mb-2">
            <svg
              className="w-4 h-4 text-indigo-600"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
              />
            </svg>
            <span className="text-xs font-semibold text-gray-900">Live Preview</span>
            {isPublished === false && (
              <span className="ml-auto inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200/60">
                Draft
              </span>
            )}
          </div>
          <div className="flex-1 bg-white border border-gray-200/80 rounded-xl p-4 shadow-xs flex flex-col justify-between min-h-[520px]">
            <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 text-xs text-gray-700 max-w-[85%]">
              Hello! How can I help you today?
            </div>
            <div className="mt-4">
              <input
                type="text"
                placeholder="Test a message..."
                className="w-full bg-white border border-gray-200/85 rounded-xl px-4 py-2.5 text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900/10 shadow-2xs"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
