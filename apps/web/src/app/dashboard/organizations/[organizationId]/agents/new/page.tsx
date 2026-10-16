"use client";

import { useParams, useRouter } from "next/navigation";
import { AgentCreationWizard } from "@/components/agent-creation-wizard";

export default function NewAgentPage() {
  const params = useParams<{ organizationId: string }>();
  const router = useRouter();
  const orgId = params.organizationId ?? "";

  return (
    <div className="space-y-7">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-gray-400">
          Agent Studio
        </p>
        <h1 className="mt-2 text-xl font-bold text-gray-900 tracking-tight">
          Create AI Agent
        </h1>
        <p className="mt-2 text-sm text-gray-500">
          Configure your agent and save it as a draft. Publishing comes after
          you save a configuration version.
        </p>
      </div>
      <AgentCreationWizard
        orgId={orgId}
        onComplete={(agentId) => {
          router.push(
            `/dashboard/organizations/${orgId}/agents/${encodeURIComponent(agentId)}/studio`
          );
        }}
      />
    </div>
  );
}
