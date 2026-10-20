import { NextRequest } from "next/server";
import { proxyRequest } from "@/lib/proxy";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string; invitationId: string }> }
) {
  const { orgId, invitationId } = await params;
  return proxyRequest(
    request,
    orgId,
    `/api/v1/organizations/${encodeURIComponent(orgId)}/team/invitations/${encodeURIComponent(invitationId)}/resend`
  );
}
