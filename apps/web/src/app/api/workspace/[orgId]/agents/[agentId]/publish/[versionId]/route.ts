import { NextRequest } from "next/server";
import { proxyRequest } from "@/lib/proxy";

export async function POST(
  request: NextRequest,
  {
    params,
  }: { params: Promise<{ orgId: string; agentId: string; versionId: string }> }
) {
  const { orgId, agentId, versionId } = await params;
  return proxyRequest(
    request,
    orgId,
    `/api/v1/organizations/${encodeURIComponent(orgId)}/agents/${encodeURIComponent(agentId)}/publish/${encodeURIComponent(versionId)}`
  );
}
