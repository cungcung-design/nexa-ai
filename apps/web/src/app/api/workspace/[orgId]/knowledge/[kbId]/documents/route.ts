import { proxyRequest } from "@/lib/proxy";
import { NextRequest } from "next/server";

const path = (orgId: string, kbId: string) =>
  `/api/v1/organizations/${encodeURIComponent(orgId)}/knowledge/${encodeURIComponent(kbId)}/documents`;

export async function GET(request: NextRequest, { params }: { params: Promise<{ orgId: string; kbId: string }> }) {
  const { orgId, kbId } = await params;
  return proxyRequest(request, orgId, path(orgId, kbId));
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ orgId: string; kbId: string }> }) {
  const { orgId, kbId } = await params;
  return proxyRequest(request, orgId, path(orgId, kbId), { maxBytes: 6 * 1024 * 1024 });
}
