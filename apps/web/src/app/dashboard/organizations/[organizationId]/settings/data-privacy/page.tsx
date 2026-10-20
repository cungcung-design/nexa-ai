import { DataPrivacyPanel } from "@/components/settings/data-privacy-panel";
import { WorkspaceSettingsShell } from "@/components/settings/workspace-shell";
import { backendGet } from "@/lib/api";
import { authorizedOrganization } from "@/lib/workspace";
import type { WorkspaceSettings } from "@/lib/api/settings";

export default async function WorkspaceDataPrivacyPage({
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
      title="Data & Privacy"
      description="The retention, the exports, and the deletion of the data of the workspace."
    >
      <DataPrivacyPanel organizationId={organizationId} initial={initial} />
    </WorkspaceSettingsShell>
  );
}
