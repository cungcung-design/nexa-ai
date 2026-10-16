"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Bot,
  Brain,
  FileText,
  Headset,
  MessageSquare,
  ShoppingBag,
  Sliders,
  Users,
} from "lucide-react";
import type { Agent } from "@/lib/api";

const AGENT_ICONS: Record<string, { icon: React.ElementType; color: string }> = {
  "Customer Support": { icon: Headset, color: "bg-blue-50 text-blue-600 border border-blue-100" },
  "Sales Assistant": { icon: ShoppingBag, color: "bg-purple-50 text-purple-600 border border-purple-100" },
  "Research Agent": { icon: Brain, color: "bg-emerald-50 text-emerald-600 border border-emerald-100" },
  "HR Assistant": { icon: Users, color: "bg-amber-50 text-amber-600 border border-amber-100" },
  "Document Analyzer": { icon: FileText, color: "bg-rose-50 text-rose-600 border border-rose-100" },
  "Workflow Assistant": { icon: Sliders, color: "bg-sky-50 text-sky-600 border border-sky-100" },
};

function getAgentIcon(name: string) {
  return AGENT_ICONS[name] ?? { icon: Bot, color: "bg-slate-50 text-slate-600 border border-slate-200" };
}

function getStatus(agent: Agent) {
  if (agent.is_archived) return "Archived";
  if (!!agent.published_version_id) return "Published";
  return "Draft";
}

function getStatusStyle(status: string) {
  switch (status) {
    case "Published":
      return "bg-emerald-50 text-emerald-700 border border-emerald-200/60";
    case "Draft":
      return "bg-gray-100 text-gray-700 border border-gray-200/60";
    case "Archived":
      return "bg-gray-100 text-gray-600 border border-gray-200/60";
    default:
      return "bg-gray-100 text-gray-600 border border-gray-200/60";
  }
}

export function AgentsGrid({ agents, orgId }: { agents: Agent[]; orgId: string }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "published" | "draft" | "archived">("all");

  const visibleAgents = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return agents.filter((agent) => {
      const matchesText =
        !normalized ||
        agent.name.toLowerCase().includes(normalized) ||
        (agent.description ?? "").toLowerCase().includes(normalized);
      if (!matchesText) return false;
      const status = getStatus(agent).toLowerCase();
      if (filter === "all") return true;
      if (filter === "published") return status === "published";
      if (filter === "draft") return status === "draft";
      if (filter === "archived") return status === "archived";
      return true;
    });
  }, [agents, query, filter]);

  const FILTERS: { value: "all" | "published" | "draft" | "archived"; label: string }[] = [
    { value: "all", label: "All" },
    { value: "published", label: "Published" },
    { value: "draft", label: "Draft" },
    { value: "archived", label: "Archived" },
  ];

  return (
    <section className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <span className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none text-gray-400">
            <MessageSquare className="w-4 h-4" />
          </span>
          <input
            type="text"
            placeholder="Search AI agents..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-white border border-gray-200/80 rounded-xl pl-11 pr-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/10 shadow-2xs"
          />
        </div>
        <button
          onClick={() => {}}
          className="flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-gray-50 border border-gray-200/80 rounded-xl text-xs font-medium text-gray-700 shadow-2xs transition-colors cursor-pointer shrink-0"
        >
          <Sliders className="w-4 h-4 text-gray-400" />
          Filter
        </button>
      </div>

      <div className="grid grid-cols-4 gap-2 bg-gray-50/80 border border-gray-200/60 p-1 rounded-xl mb-6 text-xs font-medium text-center">
        {FILTERS.map((f) => {
          const active = filter === f.value;
          return (
            <button
              key={f.label}
              onClick={() => setFilter(f.value)}
              className={`py-2 rounded-lg transition-colors cursor-pointer font-semibold ${
                active
                  ? "bg-white text-gray-900 shadow-xs border border-gray-200/80"
                  : "text-gray-500 hover:text-gray-900"
              }`}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {visibleAgents.length === 0 ? (
          <div className="md:col-span-2 flex flex-col items-center justify-center py-16 text-center">
            <p className="text-sm text-gray-400">No matching agents</p>
          </div>
        ) : (
          visibleAgents.map((agent) => {
            const { icon: Icon, color } = getAgentIcon(agent.name);
            const status = getStatus(agent);
            const statusStyle = getStatusStyle(status);
            const detailHref = `/dashboard/organizations/${encodeURIComponent(orgId)}/agents/${encodeURIComponent(agent.id)}`;
            return (
              <article
                key={agent.id}
                className="bg-white border border-gray-200/80 rounded-2xl p-5 shadow-xs flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className={`w-8 h-8 rounded-lg ${color} flex items-center justify-center`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusStyle}`}>
                      {status}
                    </span>
                  </div>
                  <Link href={detailHref} className="block">
                    <h3 className="text-sm font-semibold text-gray-900 tracking-tight hover:underline">
                      {agent.name}
                    </h3>
                  </Link>
                  <p className="text-xs text-gray-500 mt-1 mb-4 leading-relaxed">
                    {agent.description || "No description yet."}
                  </p>
                </div>
                <div>
                  <div className="border-t border-gray-100 pt-4 flex gap-2">
                    <Link
                      href={detailHref}
                      className="flex-1 py-2 px-3 bg-white hover:bg-gray-50 text-gray-800 text-xs font-medium border border-gray-200/80 rounded-xl transition-colors shadow-2xs cursor-pointer text-center"
                    >
                      Test
                    </Link>
                    <Link
                      href={detailHref}
                      className="flex-1 py-2 px-3 bg-gray-900 hover:bg-gray-800 text-white text-xs font-medium rounded-xl transition-colors shadow-sm cursor-pointer text-center"
                    >
                      Configure
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
