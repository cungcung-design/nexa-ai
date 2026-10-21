import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { API_URL } from "@/lib/api";

/**
 * Confirm an email address with the token of a verification link.
 *
 * The link can be opened without a session, so the route forwards the token
 * even when the visitor is not signed in.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  if (typeof body.token !== "string" || !body.token.trim()) {
    return NextResponse.json(
      { error: "The verification link is missing its token." },
      { status: 400 }
    );
  }
  const token = (await cookies()).get("nexa_access")?.value;
  try {
    const upstream = await fetch(`${API_URL}/api/v1/auth/verification/confirm`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ token: body.token.trim() }),
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
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
