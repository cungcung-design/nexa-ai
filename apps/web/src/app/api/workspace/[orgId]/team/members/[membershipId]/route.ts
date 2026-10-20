import { NextRequest } from "next/server";
import { proxyRequest } from "@/lib/proxy";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string; membershipId: string }> }
) {
  const { orgId, membershipId } = await params;
  return proxyRequest(
    request,
    orgId,
    `/api/v1/organizations/${encodeURIComponent(orgId)}/team/members/${encodeURIComponent(membershipId)}`
  );
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string; membershipId: string }> }
) {
  const { orgId, membershipId } = await params;
  return proxyRequest(
    request,
    orgId,
    `/api/v1/organizations/${encodeURIComponent(orgId)}/team/members/${encodeURIComponent(membershipId)}`
  );
}
