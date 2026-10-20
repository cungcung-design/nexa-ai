import { NextRequest } from "next/server";
import { proxyRequest } from "@/lib/proxy";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string; invoiceId: string }> }
) {
  const { orgId, invoiceId } = await params;
  return proxyRequest(
    request,
    orgId,
    `/api/v1/organizations/${encodeURIComponent(orgId)}/billing/invoices/${encodeURIComponent(invoiceId)}`
  );
}
