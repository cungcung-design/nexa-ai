import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { API_URL } from "@/lib/api";
import { authorizedOrganization } from "@/lib/workspace";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string; agentId: string }> }
) {
  const { orgId, agentId } = await params;
  if (!(await authorizedOrganization(orgId)))
    return NextResponse.json(
      { error: "Workspace unavailable" },
      { status: 403 }
    );
  const token = (await cookies()).get("nexa_access")?.value;
  if (!token)
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const origin = request.headers.get("origin");
  if (origin !== request.nextUrl.origin)
    return NextResponse.json(
      { error: "Invalid request origin" },
      { status: 403 }
    );
  const body = await request.json().catch(() => ({}));
  if (typeof body.message !== "string" || !body.message.trim()) {
    return NextResponse.json(
      { error: "Message is required." },
      { status: 400 }
    );
  }
  try {
    const response = await fetch(
      `${API_URL}/api/v1/organizations/${encodeURIComponent(orgId)}/agents/${encodeURIComponent(agentId)}/chat`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: body.message.trim() }),
        cache: "no-store",
        signal: AbortSignal.timeout(90000),
      }
    );
    const text = await response.text();
    const contentType =
      response.headers.get("content-type") || "application/json";
    return new NextResponse(text, {
      status: response.status,
      headers: { "Content-Type": contentType, "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json(
      { error: "Backend unavailable" },
      { status: 503 }
    );
  }
}
