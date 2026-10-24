import { asArray, backendGet, type Agent } from "@/lib/api";
import { authorizedOrganization } from "@/lib/workspace";
import { ConversationManager } from "@/components/conversation-manager";

export default async function ConversationsPage({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;
  const org = await authorizedOrganization(organizationId);

  const conversations = org
    ? asArray<{ id: string; agent_id: string; title: string; created_at: string }>(
        await backendGet<unknown>(
          `/api/v1/organizations/${org.id}/conversations`,
          { revalidate: 0 }
        )
      )
    : [];
  const agents = org
    ? asArray<Agent>(
        await backendGet<unknown>(
          `/api/v1/organizations/${org.id}/agents`,
          { revalidate: 0 }
        )
      )
    : [];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-violet-400">
          AI Memory
        </p>
        <h1 className="mt-2 text-3xl font-bold">Conversations</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Resume persistent conversations with published agents.
        </p>
      </div>
      {org ? (
        <ConversationManager
          key={org.id}
          orgId={org.id}
          initialConversations={conversations}
          agents={agents}
        />
      ) : (
        <p className="text-zinc-400">Choose an organization to continue.</p>
      )}
    </div>
  );
}
