import { proxyRequest } from "@/lib/proxy";
import { NextRequest } from "next/server";

export async function POST(request: NextRequest, { params }: { params: Promise<{ orgId: string; kbId: string }> }) {
  const { orgId, kbId } = await params;
  return proxyRequest(request, orgId, `/api/v1/organizations/${encodeURIComponent(orgId)}/knowledge/${encodeURIComponent(kbId)}/search`);
}
