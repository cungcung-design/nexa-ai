import { asArray, backendGet } from "@/lib/api";
import { authorizedOrganization } from "@/lib/workspace";
import { KnowledgeManager } from "@/components/knowledge-manager";

export type KnowledgeBase = { id: string; name: string };

export default async function KnowledgePage({
  params,
  searchParams,
}: {
  params: Promise<{ organizationId: string }>;
  searchParams: Promise<{ kb?: string }>;
}) {
  const { organizationId } = await params;
  const { kb } = await searchParams;
  const org = await authorizedOrganization(organizationId);

  const bases = org
    ? asArray<KnowledgeBase>(
        await backendGet<unknown>(
          `/api/v1/organizations/${org.id}/knowledge`
        )
      )
    : [];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-violet-400">
          Agent Intelligence
        </p>
        <h1 className="mt-2 text-3xl font-bold">Knowledge Base</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Manage knowledge sources, upload documents, check indexing status,
          and search indexed chunks.
        </p>
      </div>
      {org ? (
        <KnowledgeManager
          key={org.id}
          orgId={org.id}
          initialBases={bases}
          initialSelectedId={kb}
        />
      ) : (
        <p className="text-zinc-400">Choose an organization to continue.</p>
      )}
    </div>
  );
}
