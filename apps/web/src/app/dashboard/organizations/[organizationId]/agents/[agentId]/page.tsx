import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Settings2, ShieldAlert } from "lucide-react";
import {
  asArray,
  backendGet,
  type Agent,
  type AgentVersion,
} from "@/lib/api";
import { authorizedOrganization } from "@/lib/workspace";
import { AgentPlayground } from "@/components/agent-playground";
import { AgentVersionManager } from "@/components/agent-version-manager";

export default async function AgentDetailPage({
  params,
}: {
  params: Promise<{ organizationId: string; agentId: string }>;
}) {
  const { organizationId, agentId } = await params;
  const org = await authorizedOrganization(organizationId);
  if (!org) notFound();

  const agent = await backendGet<Agent>(
    `/api/v1/organizations/${org.id}/agents/${encodeURIComponent(agentId)}`
  );
  if (!agent || agent.id !== agentId) notFound();

  const versions = asArray<AgentVersion>(
    await backendGet<unknown>(
      `/api/v1/organizations/${org.id}/agents/${encodeURIComponent(agentId)}/versions`
    )
  );

  const base = `/dashboard/organizations/${org.id}`;

  return (
    <div className="space-y-6">
      <Link
        href={`${base}/agents`}
        className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white"
      >
        <ArrowLeft className="size-4" /> All agents
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-violet-400">
            Agent Studio
          </p>
          <h1 className="mt-2 text-3xl font-bold">{agent.name}</h1>
          <p className="mt-2 text-sm text-zinc-400">
            {agent.description || "No description yet"}
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-sm ${
            agent.published_version_id
              ? "bg-emerald-500/10 text-emerald-300"
              : "bg-amber-500/10 text-amber-300"
          }`}
        >
          {agent.published_version_id ? "Published" : "Draft"}
        </span>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          {agent.published_version_id ? (
            <AgentPlayground
              orgId={org.id}
              agentId={agent.id}
              agentName={agent.name}
            />
          ) : (
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-8">
              <ShieldAlert className="size-8 text-amber-300" />
              <h2 className="mt-3 text-xl font-semibold">
                Publish an agent version first
              </h2>
              <p className="mt-2 text-sm text-zinc-400">
                Chat uses the published version. Save a configuration version
                below, then publish it.
              </p>
            </div>
          )}
          <AgentVersionManager orgId={org.id} agent={agent} versions={versions} />
        </div>

        <aside className="h-fit space-y-4 rounded-2xl border border-white/10 bg-[#14131e] p-5">
          <div className="flex items-center gap-2">
            <Settings2 className="size-5 text-violet-400" />
            <h2 className="font-semibold">Agent configuration</h2>
          </div>
          <dl className="space-y-4 text-sm">
            <div>
              <dt className="text-zinc-500">Agent ID</dt>
              <dd className="mt-1 break-all font-mono text-xs">{agent.id}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Published version</dt>
              <dd className="mt-1 break-all font-mono text-xs">
                {agent.published_version_id || "Not published"}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500">Latest version</dt>
              <dd className="mt-1 font-mono text-xs">
                {agent.latest_version_number ?? "none"}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500">Organization</dt>
              <dd className="mt-1">{org.name}</dd>
            </div>
          </dl>
          <p className="rounded-xl bg-violet-500/10 p-3 text-xs leading-relaxed text-violet-200">
            Editing configuration saves a new draft version. Published
            versions stay unchanged.
          </p>
        </aside>
      </div>
    </div>
  );
}
