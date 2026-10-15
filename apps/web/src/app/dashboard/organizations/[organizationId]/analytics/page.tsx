import Link from "next/link";
import {
  Activity,
  Bot,
  CircleAlert,
  Database,
  MessageSquare,
  RadioTower,
} from "lucide-react";
import { asArray, backendGet, type Agent } from "@/lib/api";
import { authorizedOrganization } from "@/lib/workspace";
import type { Deployment } from "@/components/deployment-manager";

type Conversation = { id: string; agent_id?: string };
type KnowledgeBase = { id: string };

const number = (n: number) => n.toLocaleString();

export default async function AnalyticsPage({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;
  const org = await authorizedOrganization(organizationId);
  if (!org)
    return (
      <div className="rounded-2xl border border-white/10 p-8 text-zinc-400">
        No organization available. Sign in and select a workspace.
      </div>
    );

  const root = `/api/v1/organizations/${encodeURIComponent(org.id)}`;
  const [rawAgents, rawDeployments, rawConversations, rawKnowledge] =
    await Promise.all([
      backendGet<unknown>(`${root}/agents`),
      backendGet<unknown>(`${root}/deployments`),
      backendGet<unknown>(`${root}/conversations`),
      backendGet<unknown>(`${root}/knowledge`),
    ]);

  const agents = asArray<Agent>(rawAgents);
  const deployments = asArray<Deployment>(rawDeployments);
  const conversations = asArray<Conversation>(rawConversations);
  const knowledge = asArray<KnowledgeBase>(rawKnowledge);
  const published = agents.filter(
    (a) => !!a.published_version_id && !a.is_archived
  ).length;
  const draft = agents.filter(
    (a) => !a.published_version_id && !a.is_archived
  ).length;
  const archived = agents.filter((a) => a.is_archived).length;
  const activeDeployments = deployments.filter((d) => d.is_active).length;

  const metrics = [
    {
      name: "AI agents",
      value: rawAgents === null ? null : agents.length,
      icon: Bot,
      detail: `${published} published`,
    },
    {
      name: "Active deployments",
      value: rawDeployments === null ? null : activeDeployments,
      icon: RadioTower,
      detail: "Configured deployments",
    },
    {
      name: "Conversations",
      value: rawConversations === null ? null : conversations.length,
      icon: MessageSquare,
      detail: "Visible to your account",
    },
    {
      name: "Knowledge bases",
      value: rawKnowledge === null ? null : knowledge.length,
      icon: Database,
      detail: "Backend records",
    },
  ];

  const total = agents.length || 1;

  return (
    <div className="space-y-7">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-violet-400">
          Workspace / Insights
        </p>
        <h1 className="mt-2 text-3xl font-bold">Analytics</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Live operational counts where available, directly from your FastAPI
          workspace.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((m) => (
          <article
            key={m.name}
            className="rounded-2xl border border-white/10 bg-[#14131e] p-5"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm text-zinc-400">{m.name}</span>
              <m.icon className="size-5 text-violet-300" />
            </div>
            <p className="mt-4 text-3xl font-semibold">
              {m.value === null ? "—" : number(m.value)}
            </p>
            <p className="mt-2 text-xs text-zinc-500">
              {m.value === null
                ? "Endpoint unavailable or incompatible"
                : m.detail}
            </p>
          </article>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-2xl border border-white/10 bg-[#14131e] p-6">
          <h2 className="text-lg font-semibold">Agent lifecycle</h2>
          <p className="mt-1 text-sm text-zinc-400">
            Published, draft, and archived agents
          </p>
          {rawAgents === null ? (
            <p className="mt-6 text-sm text-zinc-500">
              Agent data unavailable.
            </p>
          ) : (
            <div className="mt-6 space-y-5">
              {[
                { label: "Published", count: published, bar: "bg-violet-500" },
                { label: "Draft", count: draft, bar: "bg-indigo-400" },
                { label: "Archived", count: archived, bar: "bg-zinc-500" },
              ].map((s) => (
                <div key={s.label}>
                  <div className="mb-2 flex justify-between text-sm">
                    <span>{s.label}</span>
                    <span className="tabular-nums text-zinc-400">
                      {s.count}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/10">
                    <div
                      className={`h-full rounded-full ${s.bar}`}
                      style={{ width: `${(100 * s.count) / total}%` }}
                    />
                  </div>
                </div>
              ))}
              {agents.length === 0 && (
                <p className="text-sm text-zinc-500">
                  No agents have been created.
                </p>
              )}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-white/10 bg-[#14131e] p-6">
          <div className="flex items-center gap-2">
            <Activity className="size-5 text-violet-300" />
            <h2 className="text-lg font-semibold">AI performance & traces</h2>
          </div>
          <p className="mt-3 text-sm text-zinc-400">
            Latency, token usage, cost, error rate, retrieval quality, and
            evaluation scores require backend instrumentation and a
            tenant-scoped analytics API.
          </p>
          <div className="mt-6 flex items-start gap-3 rounded-xl border border-violet-400/15 bg-violet-500/5 p-4">
            <CircleAlert className="mt-0.5 size-5 shrink-0 text-violet-300" />
            <p className="text-sm text-zinc-300">
              No fabricated trends or AI evaluation scores are shown. These
              metrics require backend endpoints that do not exist yet.
            </p>
          </div>
        </section>
      </div>

      <Link
        href={`/dashboard/organizations/${org.id}/agents`}
        className="inline-flex rounded-xl border border-violet-500/30 px-4 py-2.5 text-sm font-semibold text-violet-200 hover:bg-violet-500/10"
      >
        Manage AI agents →
      </Link>
    </div>
  );
}
