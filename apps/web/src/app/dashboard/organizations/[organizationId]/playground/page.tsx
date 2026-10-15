import Link from "next/link";
import { asArray, backendGet, type Agent } from "@/lib/api";
import { authorizedOrganization } from "@/lib/workspace";
import { AgentPlayground } from "@/components/agent-playground";

export default async function PlaygroundPage({
  params,
  searchParams,
}: {
  params: Promise<{ organizationId: string }>;
  searchParams: Promise<{ agent?: string }>;
}) {
  const { organizationId } = await params;
  const { agent: agentQuery } = await searchParams;
  const org = await authorizedOrganization(organizationId);

  const agents = org
    ? asArray<Agent>(
        await backendGet<unknown>(
          `/api/v1/organizations/${org.id}/agents`
        )
      )
    : [];
  const published = agents.filter(
    (a) => !!a.published_version_id && !a.is_archived
  );
  const active = published.find((a) => a.id === agentQuery) ?? published[0];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-violet-400">
          Agent Studio
        </p>
        <h1 className="mt-2 text-3xl font-bold">AI Playground</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Test a published agent against the live FastAPI runtime.
        </p>
      </div>

      {org && published.length > 0 ? (
        <>
          <div className="flex flex-wrap gap-2">
            {published.map((a) => (
              <Link
                key={a.id}
                href={`/dashboard/organizations/${org.id}/playground?agent=${encodeURIComponent(a.id)}`}
                className={`rounded-xl border px-4 py-2 text-sm ${
                  active?.id === a.id
                    ? "border-violet-500 bg-violet-500/15 text-violet-200"
                    : "border-white/10 text-zinc-400 hover:text-white"
                }`}
              >
                {a.name}
              </Link>
            ))}
          </div>
          {active && (
            <AgentPlayground
              key={active.id}
              orgId={org.id}
              agentId={active.id}
              agentName={active.name}
            />
          )}
        </>
      ) : (
        <div className="rounded-2xl border border-dashed border-white/15 bg-[#14131e] p-10 text-center">
          <h2 className="text-lg font-semibold">
            No published agents available
          </h2>
          <p className="mt-2 text-sm text-zinc-400">
            Publish an agent before using the playground.
          </p>
          <Link
            href={org ? `/dashboard/organizations/${org.id}/agents` : "/dashboard"}
            className="mt-5 inline-block text-sm text-violet-300"
          >
            View agents →
          </Link>
        </div>
      )}
    </div>
  );
}
