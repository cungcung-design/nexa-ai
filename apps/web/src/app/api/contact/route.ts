import { NextRequest, NextResponse } from "next/server";
import { API_URL } from "@/lib/api";

/**
 * The contact form of the public landing page.
 *
 * The endpoint is public, a visitor does not need an account to reach the
 * team, so the request carries no session.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json(
      { detail: "The message could not be read." },
      { status: 400 }
    );
  }

  try {
    const upstream = await fetch(`${API_URL}/api/v1/contact`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
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
      { detail: "The message could not be sent. Please try again." },
      { status: 503 }
    );
  }
}
