import { redirect } from "next/navigation";

export default async function AuditLogsRedirectPage({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;
  redirect(`/dashboard/organizations/${organizationId}/audit-logs`);
}
