import { proxyRequest } from "@/lib/proxy";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest, { params }: { params: Promise<{ orgId: string; conversationId: string }> }) {
  const { orgId, conversationId } = await params;
  return proxyRequest(request, orgId, `/api/v1/organizations/${encodeURIComponent(orgId)}/conversations/${encodeURIComponent(conversationId)}/messages`);
}
