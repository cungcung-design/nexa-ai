import { NextRequest } from "next/server";
import { proxyRequest } from "@/lib/proxy";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string; paymentMethodId: string }> }
) {
  const { orgId, paymentMethodId } = await params;
  return proxyRequest(
    request,
    orgId,
    `/api/v1/organizations/${encodeURIComponent(orgId)}/billing/payment-methods/${encodeURIComponent(paymentMethodId)}/default`
  );
}
