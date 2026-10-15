import "server-only";
import { cookies } from "next/headers";
import {
  asArray,
  backendGet,
  ORGS_PATH,
  type Organization,
} from "@/lib/api";

export async function authorizedOrganization(id: string) {
  const orgs = asArray<Organization>(await backendGet<unknown>(ORGS_PATH));
  return orgs.find((o) => o.id === id) ?? null;
}

export async function listOrganizations(): Promise<Organization[]> {
  return asArray<Organization>(await backendGet<unknown>(ORGS_PATH));
}

// Active workspace for non-org-scoped pages: last selection wins, otherwise
// the first membership. Never trusts the URL alone for authorization.
export async function resolveActiveOrganization(): Promise<Organization | null> {
  const orgs = await listOrganizations();
  if (orgs.length === 0) return null;
  const preferred = (await cookies()).get("nexa_active_org")?.value;
  return orgs.find((o) => o.id === preferred) ?? orgs[0];
}
