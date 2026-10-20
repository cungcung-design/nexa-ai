import { AgentInheritancePanel } from "@/components/settings/agent-inheritance-panel";
import { AiConfigurationForm } from "@/components/settings/ai-configuration-form";
import { RunSnapshotPanel } from "@/components/settings/run-snapshot-panel";
import { WorkspaceSettingsShell } from "@/components/settings/workspace-shell";
import { backendGet } from "@/lib/api";
import { authorizedOrganization } from "@/lib/workspace";
import type { WorkspaceSettings } from "@/lib/api/settings";

export default async function WorkspaceAiPage({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;
  const organization = await authorizedOrganization(organizationId);
  const initial = await backendGet<WorkspaceSettings>(
    `/api/v1/organizations/${organizationId}/settings`,
    { revalidate: 0 }
  );

  return (
    <WorkspaceSettingsShell
      organizationName={organization?.name ?? "the workspace"}
      title="AI Configuration"
      description="The default models, the parameters, and the safeguards of the agents."
    >
      <div className="space-y-4">
        <AiConfigurationForm
          organizationId={organizationId}
          initial={initial}
        />
        <AgentInheritancePanel organizationId={organizationId} />
        <RunSnapshotPanel organizationId={organizationId} />
      </div>
    </WorkspaceSettingsShell>
  );
}
