import { NextRequest } from "next/server";
import { proxyRequest } from "@/lib/proxy";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string; agentId: string }> }
) {
  const { orgId, agentId } = await params;
  return proxyRequest(
    request,
    orgId,
    `/api/v1/organizations/${encodeURIComponent(orgId)}/agents/${encodeURIComponent(agentId)}/versions`
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string; agentId: string }> }
) {
  const { orgId, agentId } = await params;
  return proxyRequest(
    request,
    orgId,
    `/api/v1/organizations/${encodeURIComponent(orgId)}/agents/${encodeURIComponent(agentId)}/versions`
  );
}
