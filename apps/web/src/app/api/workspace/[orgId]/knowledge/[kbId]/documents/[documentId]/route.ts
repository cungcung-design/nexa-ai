import { proxyRequest } from "@/lib/proxy";
import { NextRequest } from "next/server";

const path = (orgId: string, kbId: string, documentId: string) =>
  `/api/v1/organizations/${encodeURIComponent(orgId)}/knowledge/${encodeURIComponent(kbId)}/documents/${encodeURIComponent(documentId)}`;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string; kbId: string; documentId: string }> },
) {
  const { orgId, kbId, documentId } = await params;
  return proxyRequest(request, orgId, path(orgId, kbId, documentId));
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string; kbId: string; documentId: string }> },
) {
  const { orgId, kbId, documentId } = await params;
  return proxyRequest(request, orgId, path(orgId, kbId, documentId));
}
