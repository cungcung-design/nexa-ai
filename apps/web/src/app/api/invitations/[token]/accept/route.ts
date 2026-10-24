import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { API_URL } from "@/lib/api";
import { isSameOrigin } from "@/lib/proxy";

/**
 * Accept a workspace invitation. The recipient is not a member of the
 * organization yet, so the organization guard cannot be used here: only the
 * session cookie is forwarded to the backend, which validates the token and
 * the invited address.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const access = (await cookies()).get("nexa_access")?.value;
  if (!access)
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  if (!isSameOrigin(request))
    return NextResponse.json(
      { error: "Invalid request origin" },
      { status: 403 }
    );

  try {
    const upstream = await fetch(
      `${API_URL}/api/v1/invitations/${encodeURIComponent(token)}/accept`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${access}` },
        cache: "no-store",
        signal: AbortSignal.timeout(15000),
      }
    );
    const text = await upstream.text();
    return new NextResponse(text, {
      status: upstream.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return NextResponse.json(
      { error: "Backend unavailable" },
      { status: 503 }
    );
  }
}
