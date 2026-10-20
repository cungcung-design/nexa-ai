import { ApiKeysPanel } from "@/components/settings/api-keys-panel";
import { WorkspaceSettingsShell } from "@/components/settings/workspace-shell";
import { authorizedOrganization } from "@/lib/workspace";

export default async function WorkspaceDeveloperPage({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;
  const organization = await authorizedOrganization(organizationId);

  return (
    <WorkspaceSettingsShell
      organizationName={organization?.name ?? "the workspace"}
      title="API & Developer"
      description="The API keys, the webhooks, and the programmatic access of the workspace."
    >
      <div className="space-y-4">
        <ApiKeysPanel organizationId={organizationId} />
      </div>
    </WorkspaceSettingsShell>
  );
}
