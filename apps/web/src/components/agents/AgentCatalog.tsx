"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Bot, Search } from "lucide-react";
import type { Agent } from "@/lib/api";

type AgentFilter = "all" | "published" | "draft" | "archived";

function isAgentFilter(value: string): value is AgentFilter {
  return ["all", "published", "draft", "archived"].includes(value);
}

export function AgentCatalog({
  orgId,
  agents,
}: {
  orgId: string;
  agents: Agent[];
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<AgentFilter>("all");
  const visibleAgents = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return agents.filter((agent) => {
      const matchesText =
        !normalized ||
        agent.name.toLocaleLowerCase().includes(normalized) ||
        (agent.description ?? "").toLocaleLowerCase().includes(normalized);
      const matchesFilter =
        filter === "all" ||
        (filter === "archived" && !!agent.is_archived) ||
        (filter === "published" &&
          !agent.is_archived &&
          !!agent.published_version_id) ||
        (filter === "draft" &&
          !agent.is_archived &&
          !agent.published_version_id);
      return matchesText && matchesFilter;
    });
  }, [agents, filter, query]);

  return (
    <section className="space-y-4" aria-label="Agent catalog">
      <div className="flex flex-col gap-3 rounded-xl border border-white/10 bg-[#14131e] p-3 sm:flex-row">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Search agents</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search agents"
            className="min-h-10 w-full rounded-lg border border-white/10 bg-black/20 pl-9 pr-3 text-sm placeholder:text-zinc-500 focus:border-violet-500 focus:outline-none"
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-zinc-400">
          <span>Status</span>
          <select
            value={filter}
            onChange={(event) => {
              if (isAgentFilter(event.target.value)) {
                setFilter(event.target.value);
              }
            }}
            className="min-h-10 min-w-32 rounded-lg border border-white/10 bg-[#111019] px-3 text-sm text-zinc-100 focus:border-violet-500 focus:outline-none"
          >
            <option value="all">All agents</option>
            <option value="published">Published</option>
            <option value="draft">Draft</option>
            <option value="archived">Archived</option>
          </select>
        </label>
      </div>

      {agents.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/15 bg-[#14131e] p-14 text-center">
          <Bot className="mx-auto size-10 text-violet-400" />
          <h2 className="mt-4 font-semibold">No agents yet</h2>
          <p className="mt-2 text-sm text-zinc-400">
            Create your first agent to get started.
          </p>
        </div>
      ) : visibleAgents.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/15 px-6 py-12 text-center">
          <p className="font-medium">No matching agents</p>
          <p className="mt-1 text-sm text-zinc-400">
            Try another name or status filter.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visibleAgents.map((agent) => {
            const status = agent.is_archived
              ? "Archived"
              : agent.published_version_id
                ? "Published"
                : "Draft";
            const statusStyle = agent.is_archived
              ? "bg-zinc-500/10 text-zinc-500"
              : agent.published_version_id
                ? "bg-emerald-500/10 text-emerald-300"
                : "bg-amber-500/10 text-amber-300";
            return (
              <article
                key={agent.id}
                className="flex min-w-0 flex-col rounded-xl border border-white/10 bg-[#14131e] p-5 transition-colors hover:border-violet-500/40"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-violet-500/10 text-violet-400">
                    <Bot className="size-5" />
                  </span>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusStyle}`}>
                    {status}
                  </span>
                </div>
                <h2 className="mt-4 break-words text-base font-semibold">
                  {agent.name}
                </h2>
                <p className="mt-1 min-h-10 break-words text-sm leading-5 text-zinc-400">
                  {agent.description || "No description yet."}
                </p>
                <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3">
                  <span className="text-xs text-zinc-500">
                    {agent.latest_version_number
                      ? `Version ${agent.latest_version_number}`
                      : "No saved versions"}
                  </span>
                  <Link
                    className="rounded-md px-2 py-1 text-sm font-semibold text-violet-400 hover:bg-violet-500/10"
                    href={`/dashboard/organizations/${encodeURIComponent(orgId)}/agents/${encodeURIComponent(agent.id)}`}
                  >
                    Open agent
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
