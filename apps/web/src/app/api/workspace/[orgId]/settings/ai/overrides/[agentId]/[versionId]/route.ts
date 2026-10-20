import { NextRequest } from "next/server";
import { proxyRequest } from "@/lib/proxy";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string; agentId: string; versionId: string }> }
) {
  const { orgId, agentId, versionId } = await params;
  return proxyRequest(
    request,
    orgId,
    `/api/v1/organizations/${encodeURIComponent(orgId)}/settings/ai/overrides/${encodeURIComponent(agentId)}/${encodeURIComponent(versionId)}`
  );
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string; agentId: string; versionId: string }> }
) {
  const { orgId, agentId, versionId } = await params;
  return proxyRequest(
    request,
    orgId,
    `/api/v1/organizations/${encodeURIComponent(orgId)}/settings/ai/overrides/${encodeURIComponent(agentId)}/${encodeURIComponent(versionId)}`
  );
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string; agentId: string; versionId: string }> }
) {
  const { orgId, agentId, versionId } = await params;
  return proxyRequest(
    request,
    orgId,
    `/api/v1/organizations/${encodeURIComponent(orgId)}/settings/ai/overrides/${encodeURIComponent(agentId)}/${encodeURIComponent(versionId)}`
  );
}
