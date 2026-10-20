import { auditCategories } from "@/lib/api";
import { authorizedOrganization } from "@/lib/workspace";
import { AuditExportPanel } from "@/components/audit-logs/export-panel";
import { AuditPageHeader } from "@/components/audit-logs/shared";

export default async function AuditExportsPage({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;
  const org = await authorizedOrganization(organizationId);

  if (!org) {
    return (
      <div className="space-y-6">
        <AuditPageHeader
          title="Export Audit Logs"
          description="Choose an organization to continue."
        />
      </div>
    );
  }

  const categories = await auditCategories(org.id);
  const canExport = org.role === "OWNER" || org.role === "ADMIN";

  return (
    <div className="space-y-6">
      <AuditPageHeader
        title="Export Audit Logs"
        description="Export authorized audit records matching your filters."
        backHref={`/dashboard/organizations/${organizationId}/audit-logs`}
        backLabel="Back to overview"
      />

      {!canExport ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Exporting audit records is restricted to workspace Owners and Admins.
        </p>
      ) : null}

      <AuditExportPanel
        orgId={org.id}
        categories={categories.map((category) => ({
          id: category.id,
          name: category.name,
        }))}
      />

      <p className="text-center text-[11px] text-zinc-400">
        Exports are generated in the background. Secret values are redacted
        before any file is written.
      </p>
    </div>
  );
}
