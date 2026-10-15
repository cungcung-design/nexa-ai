import "server-only";
import { redirect } from "next/navigation";
import { resolveActiveOrganization } from "@/lib/workspace";

// Compatibility layer for legacy flat dashboard URLs such as /dashboard/agents:
// resolves the caller's active organization server-side and redirects to the
// organization-scoped route so users never have to guess organization IDs.
export async function redirectToOrgSection(
  section: string
): Promise<never> {
  const org = await resolveActiveOrganization();
  if (!org) redirect("/dashboard");
  redirect(`/dashboard/organizations/${org.id}/${section}`);
}
