import { proxyRequest } from "@/lib/proxy";
import { NextRequest } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string; exportId: string }> },
) {
  const { orgId, exportId } = await params;
  return proxyRequest(
    request,
    orgId,
    `/api/v1/organizations/${encodeURIComponent(orgId)}/audit-logs/export/${encodeURIComponent(exportId)}/download`,
    { timeoutMs: 120000 },
  );
}
