import { redirect } from "next/navigation";

export default async function ApprovalsPage({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;
  redirect(`/dashboard/organizations/${organizationId}/approvals/inbox`);
}
