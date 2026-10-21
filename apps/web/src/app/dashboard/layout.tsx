import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { connection } from "next/server";
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

export const metadata: Metadata = {
  title: "NEXORA Dashboard",
};

export const instant = false;

async function DashboardContent({ children }: { children: React.ReactNode }) {
  // The dashboard is a session bound area: it is rendered at request time so
  // that no value of the render depends on the moment it happens.
  await connection();
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
