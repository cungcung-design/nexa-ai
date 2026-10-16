"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRightFromSquare,
  Bot,
  Brain,
  Ellipsis,
  FileText,
  Globe,
  Headset,
  MessageSquare,
  Plus,
  Search,
  ShoppingBag,
  Sliders,
  ShieldCheck,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import type { Agent } from "@/lib/api";

const AGENT_ICONS: Record<string, { icon: React.ElementType; color: string }> = {
  "Customer Support": { icon: Headset, color: "bg-blue-50 text-blue-600" },
  "Sales Assistant": { icon: ShoppingBag, color: "bg-purple-50 text-purple-600" },
  "Research Agent": { icon: Brain, color: "bg-emerald-50 text-emerald-600" },
  "HR Assistant": { icon: Users, color: "bg-amber-50 text-amber-600" },
  "Document Analyzer": { icon: FileText, color: "bg-rose-50 text-rose-600" },
  "Workflow Assistant": { icon: Globe, color: "bg-sky-50 text-sky-600" },
};

function getAgentIcon(name: string) {
  return AGENT_ICONS[name] ?? { icon: Bot, color: "bg-slate-50 text-slate-600" };
}

function AgentOverlay({ agent, onClose }: { agent: Agent; onClose: () => void }) {
  const { icon: Icon, color } = getAgentIcon(agent.name);
  const isPublished = !!agent.published_version_id && !agent.is_archived;
  const statusText = agent.is_archived ? "Archived" : isPublished ? "Published" : "Draft";
  const version = agent.latest_version_number ?? 1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Agent details"
    >
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      <div
        className="relative z-10 w-full max-w-lg bg-white rounded-3xl border border-slate-200/80 shadow-sm p-6 flex flex-col justify-between"
      >
        <button
          onClick={onClose}
          aria-label="Close agent details"
          className="absolute top-4 right-4 w-7 h-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:text-slate-900 transition-colors"
        >
          <X className="size-4" />
        </button>

        <div>
          <div className="flex items-center justify-between mb-4">
            <div className={`w-12 h-12 rounded-2xl ${color} flex items-center justify-center text-lg`}>
              <Icon className="size-6" />
            </div>
            <div className={`flex items-center gap-1.5 bg-emerald-50 text-emerald-600 border border-emerald-100 px-3 py-1 rounded-full text-xs font-medium ${isPublished ? '' : 'hidden'}`}>
              <ShieldCheck className="size-3" /> {statusText}
            </div>
            {(!isPublished && !agent.is_archived) && (
              <div className={`flex items-center gap-1.5 bg-slate-100 text-slate-600 border border-slate-200 px-3 py-1 rounded-full text-xs font-medium`}>
                <ShieldCheck className="size-3" /> {statusText}
              </div>
            )}
            {agent.is_archived && (
              <div className="flex items-center gap-1.5 bg-slate-100 text-slate-600 border border-slate-200 px-3 py-1 rounded-full text-xs font-medium">
                <ShieldCheck className="size-3" /> {statusText}
              </div>
            )}
          </div>

          <div className="mb-5">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight mb-1.5">
              {agent.name}
            </h2>
            <p className="text-xs text-slate-500 leading-relaxed">
              {agent.description || "No description yet."}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6 bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
            <div>
              <span className="text-[11px] text-slate-400 block mb-1">Executions</span>
              <span className="text-xl font-bold text-slate-900 tracking-tight">1,248</span>
            </div>
            <div className="flex items-end gap-1">
              <span className="text-[11px] text-slate-400 block mb-1">Success rate</span>
              <div className="flex items-baseline gap-1">
                <span className="text-xl font-bold text-slate-900 tracking-tight">98.6%</span>
                <TrendingUp className="size-3 text-emerald-600" />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-400 mb-6 px-1">
            <span>Updated 2 hours ago</span>
            <span className="font-medium text-slate-500">v{version}</span>
          </div>
        </div>

        <div>
          <hr className="border-slate-100 mb-5" />

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => {}}
              className="bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 text-xs font-semibold py-3 px-4 rounded-2xl shadow-2xs flex items-center justify-center gap-2 transition-all"
            >
              <MessageSquare className="size-3" /> Test
            </button>
            <button
              className="bg-slate-950 hover:bg-slate-800 text-white text-xs font-semibold py-3 px-4 rounded-2xl shadow-sm flex items-center justify-center gap-2 transition-all"
            >
              <Sliders className="size-3" /> Configure
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AgentsGrid({ agents }: { agents: Agent[] }) {
  const [query, setQuery] = useState("");
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);

  const visibleAgents = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return agents.filter((agent) => {
      const matchesText =
        !normalized ||
        agent.name.toLowerCase().includes(normalized) ||
        (agent.description ?? "").toLowerCase().includes(normalized);
      return matchesText;
    });
  }, [agents, query]);

  return (
    <section className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            AI Agents
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Create, manage, and deploy your intelligent agents.
          </p>
        </div>
        <Link
          href="/dashboard/organizations/new-agent"
          className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-md shadow-slate-900/10 flex items-center justify-center gap-2 transition-all w-fit"
        >
          <Plus className="size-3" /> New Agent
        </Link>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none"
          />
          <input
            type="text"
            placeholder="Search agents..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-white text-xs text-slate-700 pl-9 pr-4 py-2.5 rounded-xl border border-slate-200/80 focus:border-blue-300 focus:bg-white outline-none shadow-2xs transition-all"
          />
        </div>
        <button
          onClick={() => {}}
          className="bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold px-4 py-2.5 rounded-xl border border-slate-200/80 shadow-2xs flex items-center gap-2 transition-all shrink-0"
        >
          <Sliders className="size-3" /> Filter
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {visibleAgents.length === 0 ? (
          <div className="lg:col-span-3 flex flex-col items-center justify-center py-12 text-center">
            <p className="text-sm text-zinc-400">No matching agents</p>
          </div>
        ) : (
          visibleAgents.map((agent) => {
            const { icon: Icon, color } = getAgentIcon(agent.name);
            const isPublished = !!agent.published_version_id && !agent.is_archived;
            const statusText = agent.is_archived ? "Archived" : isPublished ? "Published" : "Draft";
            const statusStyle = agent.is_archived
              ? "bg-slate-100 text-slate-600 border border-slate-200"
              : isPublished
                ? "bg-emerald-50 text-emerald-600 border border-emerald-100"
                : "bg-slate-100 text-slate-600 border border-slate-200";
            const version = agent.latest_version_number ?? 1;
            return (
              <article
                key={agent.id}
                onClick={() => setSelectedAgent(agent)}
                className="bg-white p-5 rounded-2xl border border-slate-200/70 shadow-2xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className={`w-9 h-9 rounded-xl ${color} flex items-center justify-center text-sm`}>
                      <Icon className="size-4" />
                    </div>
                    <Ellipsis
                      className="text-slate-400 cursor-pointer hover:text-slate-600"
                    />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 mb-1">
                    {agent.name}
                  </h3>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    {agent.description || "No description yet."}
                  </p>
                </div>
                <div>
                  <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-100 text-xs">
                    <span
                      className={`border font-semibold px-2.5 py-0.5 rounded-md text-[10px] ${statusStyle}`}
                    >
                      {statusText}
                    </span>
                    <span className="text-[11px] text-slate-400 font-medium">
                      v{version}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-3 text-xs text-slate-500 font-medium pt-2">
                    <span>Agent Studio</span>
                    <Link
                      href={`/dashboard/organizations/new-agent`}
                      className="text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      <ArrowUpRightFromSquare className="size-3" />
                    </Link>
                  </div>
                </div>
              </article>
            );
          })
        )}
      </div>

      {selectedAgent && <AgentOverlay agent={selectedAgent} onClose={() => setSelectedAgent(null)} />}
    </section>
  );
}
