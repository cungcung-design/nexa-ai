import { AdvancedPanel } from "@/components/settings/advanced-panel";
import { WorkspaceSettingsShell } from "@/components/settings/workspace-shell";
import { backendGet } from "@/lib/api";
import { authorizedOrganization } from "@/lib/workspace";
import type { WorkspaceSettings } from "@/lib/api/settings";

export default async function WorkspaceAdvancedPage({
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
      title="Advanced"
      description="The ownership, the transfer, and the lifecycle of the workspace."
    >
      <AdvancedPanel organizationId={organizationId} initial={initial} />
    </WorkspaceSettingsShell>
  );
}
