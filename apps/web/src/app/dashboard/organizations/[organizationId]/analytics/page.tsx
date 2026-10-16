import { authorizedOrganization } from "@/lib/workspace";
import { AnalyticsClient } from "@/components/analytics-client";

export default async function AnalyticsPage({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;
  const org = await authorizedOrganization(organizationId);

  if (!org) {
    return null;
  }

  return <AnalyticsClient orgId={org.id} />;
}

