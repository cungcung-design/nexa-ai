import { proxyRequest } from "@/lib/proxy";
import { NextRequest } from "next/server";

export async function POST(request: NextRequest, { params }: { params: Promise<{ orgId: string; approvalId: string }> }) {
  const { orgId, approvalId } = await params;
  return proxyRequest(request, orgId, `/api/v1/organizations/${encodeURIComponent(orgId)}/workflows/approvals/${encodeURIComponent(approvalId)}/decision`);
}
