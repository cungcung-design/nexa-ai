import { NextRequest } from "next/server";
import { proxyRequest } from "@/lib/proxy";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string; keyId: string }> }
) {
  const { orgId, keyId } = await params;
  return proxyRequest(
    request,
    orgId,
    `/api/v1/organizations/${encodeURIComponent(orgId)}/api-keys/${encodeURIComponent(keyId)}/revoke`
  );
}
