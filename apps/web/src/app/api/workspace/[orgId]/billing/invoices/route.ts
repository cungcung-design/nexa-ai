import { NextRequest } from "next/server";
import { proxyRequest } from "@/lib/proxy";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await params;
  return proxyRequest(
    request,
    orgId,
    "/api/v1/organizations/{orgId}/billing/invoices".replace("{orgId}", encodeURIComponent(orgId))
  );
}


