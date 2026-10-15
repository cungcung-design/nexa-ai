import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { unstable_noStore } from "next/cache";
import { DashboardShell } from "@/components/dashboard-shell";
import {
  asArray,
  backendGet,
  AUTH_ME_PATH,
  ORGS_PATH,
  type Organization,
  type User,
} from "@/lib/api";
import { Suspense } from "react";

export const instant = false;

async function DashboardContent({ children }: { children: React.ReactNode }) {
  unstable_noStore();
  if (!(await cookies()).get("nexa_access")?.value) redirect("/login");
  const user = await backendGet<User>(AUTH_ME_PATH);
  if (!user || !user.id || !user.email) {
    redirect("/login?error=session");
  }
  const organizations = asArray<Organization>(
    await backendGet<unknown>(ORGS_PATH)
  );
  return (
    <DashboardShell user={user} organizations={organizations}>
      {children}
    </DashboardShell>
  );
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={null}>
      <DashboardContent>{children}</DashboardContent>
    </Suspense>
  );
}
