import { proxyRequest } from "@/lib/proxy";
import { NextRequest } from "next/server";

const path = (orgId: string, caseId: string) =>
  `/api/v1/organizations/${encodeURIComponent(orgId)}/evaluations/cases/${encodeURIComponent(caseId)}/run`;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string; caseId: string }> },
) {
  const { orgId, caseId } = await params;
  return proxyRequest(request, orgId, path(orgId, caseId));
}
