import { proxyRequest } from "@/lib/proxy";
import { NextRequest } from "next/server";

const path = (orgId: string, traceId: string) =>
  `/api/v1/organizations/${encodeURIComponent(orgId)}/analytics/traces/${encodeURIComponent(traceId)}/spans`;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string; traceId: string }> },
) {
  const { orgId, traceId } = await params;
  return proxyRequest(request, orgId, path(orgId, traceId));
}
