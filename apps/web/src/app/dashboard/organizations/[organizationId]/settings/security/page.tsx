import { WorkspaceSecurityForm } from "@/components/settings/workspace-security-form";
import { WorkspaceSettingsShell } from "@/components/settings/workspace-shell";
import { backendGet } from "@/lib/api";
import { authorizedOrganization } from "@/lib/workspace";
import type { WorkspaceSettings } from "@/lib/api/settings";

export default async function WorkspaceSecurityPage({
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
      title="Security"
      description="The access rules, the roles, and the approval policies of the workspace."
    >
      <WorkspaceSecurityForm
        organizationId={organizationId}
        initial={initial}
      />
    </WorkspaceSettingsShell>
  );
}
