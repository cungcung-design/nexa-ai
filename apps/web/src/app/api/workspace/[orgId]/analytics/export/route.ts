import { proxyRequest } from "@/lib/proxy";
import { NextRequest } from "next/server";

const path = (orgId: string) =>
  `/api/v1/organizations/${encodeURIComponent(orgId)}/analytics/traces`;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await params;
  return proxyRequest(request, orgId, path(orgId));
}
