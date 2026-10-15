import { NextRequest } from "next/server";
import { proxyRequest } from "@/lib/proxy";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string; agentId: string }> }
) {
  const { orgId, agentId } = await params;
  return proxyRequest(
    request,
    orgId,
    `/api/v1/organizations/${encodeURIComponent(orgId)}/agents/${encodeURIComponent(agentId)}`
  );
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string; agentId: string }> }
) {
  const { orgId, agentId } = await params;
  return proxyRequest(
    request,
    orgId,
    `/api/v1/organizations/${encodeURIComponent(orgId)}/agents/${encodeURIComponent(agentId)}`
  );
}
