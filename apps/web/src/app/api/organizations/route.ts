import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { API_URL, ORGS_PATH } from "@/lib/api";
import { isSameOrigin } from "@/lib/proxy";

export async function POST(request: NextRequest) {
  const token = (await cookies()).get("nexa_access")?.value;
  if (!token)
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  if (!isSameOrigin(request))
    return NextResponse.json(
      { error: "Invalid request origin" },
      { status: 403 }
    );
  const body = await request.json().catch(() => ({}));
  if (typeof body.name !== "string" || !body.name.trim()) {
    return NextResponse.json(
      { error: "Organization name is required." },
      { status: 400 }
    );
  }
  try {
    const upstream = await fetch(`${API_URL}${ORGS_PATH}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: body.name.trim(), slug: body.slug }),
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
