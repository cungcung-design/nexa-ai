import { proxyRequest } from "@/lib/proxy";
import { NextRequest } from "next/server";

export async function POST(request: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  return proxyRequest(request, orgId, `/api/v1/organizations/${encodeURIComponent(orgId)}/billing/checkout`);
}
