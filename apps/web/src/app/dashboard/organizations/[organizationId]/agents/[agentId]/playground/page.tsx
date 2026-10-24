import { notFound } from "next/navigation";
import { asArray, backendGet, type Agent, type AgentVersion } from "@/lib/api";
import { authorizedOrganization } from "@/lib/workspace";
import { AgentPlaygroundChat } from "@/components/agent-playground-chat";
import type { StoredMessage } from "@/lib/playground-session";

type ConversationRecord = {
  id: string;
  agent_id: string;
  title: string;
  created_at: string;
};

export default async function AgentPlaygroundPage({
  params,
}: {
  params: Promise<{ organizationId: string; agentId: string }>;
}) {
  const { organizationId, agentId } = await params;
  const org = await authorizedOrganization(organizationId);
  if (!org) notFound();

  const agent = await backendGet<Agent>(
    `/api/v1/organizations/${org.id}/agents/${encodeURIComponent(agentId)}`,
    { revalidate: 0 }
  );
  if (!agent || agent.id !== agentId) notFound();

  const versions = asArray<AgentVersion>(
    await backendGet<unknown>(
      `/api/v1/organizations/${org.id}/agents/${encodeURIComponent(agentId)}/versions`,
      { revalidate: 0 }
    )
  );
  const publishedVersion = versions.find(
    (version) => version.id === agent.published_version_id
  );
  const isDraft = !agent.published_version_id || agent.is_archived === true;
  const versionLabel = String(
    publishedVersion?.version_number ?? agent.latest_version_number ?? 1
  );

  const conversations = asArray<ConversationRecord>(
    await backendGet<unknown>(
      `/api/v1/organizations/${org.id}/conversations`,
      { revalidate: 0 }
    )
  );
  const current = conversations.find((item) => item.agent_id === agentId) ?? null;
  const initialMessages = current
    ? asArray<StoredMessage>(
        await backendGet<unknown>(
          `/api/v1/organizations/${org.id}/conversations/${encodeURIComponent(current.id)}/messages`,
          { revalidate: 0 }
        )
      )
    : [];

  return (
    <div className="w-full max-w-4xl bg-white border border-gray-200/80 rounded-2xl p-6 shadow-xs flex flex-col">
      <div className="flex items-start justify-between pb-6 border-b border-gray-100 mb-6">
        <div>
          <h2 className="text-base font-semibold text-gray-900 tracking-tight">
            AI Playground
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Test agent responses and inspect execution behavior.
          </p>
        </div>
        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
          isDraft
            ? "bg-amber-50 text-amber-700 border border-amber-200/60"
            : "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
        }`}>
          {isDraft ? "Draft" : "Published"} v{versionLabel}
        </span>
      </div>

      <AgentPlaygroundChat
        orgId={org.id}
        agentId={agent.id}
        agentName={agent.name}
        published={!isDraft}
        versionLabel={versionLabel}
        model={publishedVersion?.model}
        temperature={publishedVersion?.temperature}
        initialConversationId={current?.id ?? null}
        initialMessages={initialMessages.filter(
          (message) => message.role === "user" || message.role === "assistant"
        )}
      />

      <div className="pt-4 border-t border-gray-100 mt-auto">
        <p className="text-xs text-gray-400">
          Messages are saved to this workspace conversation and restored when
          the page is opened again.
        </p>
      </div>
    </div>
  );
}
