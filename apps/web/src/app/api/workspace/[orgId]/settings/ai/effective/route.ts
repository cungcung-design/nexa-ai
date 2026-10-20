import { NextRequest } from "next/server";
import { proxyRequest } from "@/lib/proxy";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await params;
  const query = request.nextUrl.search;
  return proxyRequest(
    request,
    orgId,
    `/api/v1/organizations/${encodeURIComponent(orgId)}/settings/ai/effective${query}`
  );
}
