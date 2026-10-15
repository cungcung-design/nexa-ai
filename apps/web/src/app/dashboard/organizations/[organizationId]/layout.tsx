import { redirect } from "next/navigation";
import { unstable_noStore } from "next/cache";
import { authorizedOrganization } from "@/lib/workspace";
import { Suspense } from "react";

// Tenant guard: only members of this organization can view its pages.
// The backend re-checks membership on every API call as well.
async function OrganizationGuard({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ organizationId: string }>;
}) {
  unstable_noStore();
  const { organizationId } = await params;
  if (!(await authorizedOrganization(organizationId))) {
    redirect("/dashboard");
  }
  return <>{children}</>;
}

export default async function OrganizationLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ organizationId: string }>;
}) {
  return (
    <Suspense fallback={null}>
      <OrganizationGuard children={children} params={params} />
    </Suspense>
  );
}
