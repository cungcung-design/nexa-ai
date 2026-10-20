import { redirect } from "next/navigation";

export default async function IntegrationsOverviewPage({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;
  redirect(
    `/dashboard/organizations/${organizationId}/integrations/marketplace`
  );
}
