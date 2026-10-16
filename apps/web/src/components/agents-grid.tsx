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
  Plus,
  Search,
  ShoppingBag,
  Sliders,
  Users,
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

export function AgentsGrid({ agents }: { agents: Agent[] }) {
  const [query, setQuery] = useState("");

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
                className="bg-white p-5 rounded-2xl border border-slate-200/70 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between"
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
    </section>
  );
}
