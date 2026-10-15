import { proxyRequest } from "@/lib/proxy";
import { NextRequest } from "next/server";

const path = (orgId: string) => `/api/v1/organizations/${encodeURIComponent(orgId)}/knowledge`;

export async function GET(request: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  return proxyRequest(request, orgId, path(orgId));
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  return proxyRequest(request, orgId, path(orgId));
}
