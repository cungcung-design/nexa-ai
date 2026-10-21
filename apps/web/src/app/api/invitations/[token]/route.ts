import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { API_URL } from "@/lib/api";

/**
 * The preview of an invitation, used by the onboarding flow before the
 * invitation is accepted.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const access = (await cookies()).get("nexa_access")?.value;
  try {
    const upstream = await fetch(
      `${API_URL}/api/v1/invitations/${encodeURIComponent(token)}`,
      {
        headers: access ? { Authorization: `Bearer ${access}` } : {},
        cache: "no-store",
        signal: AbortSignal.timeout(10000),
      }
    );
    const text = await upstream.text();
    if (!upstream.ok) {
      return NextResponse.json(
        { error: "This invitation is not available." },
        { status: upstream.status }
      );
    }
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
