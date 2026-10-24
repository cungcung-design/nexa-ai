import { NextRequest, NextResponse } from "next/server";

import { sessionCookieOptions } from "@/lib/session-cookie";

const base = (
  process.env.NEXA_API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:8000"
).replace(/\/$/, "");
const path = process.env.NEXA_AUTH_LOGIN_PATH ?? "/api/v1/auth/login";

// Matches the FastAPI JWT access-token lifetime so the cookie never
// outlives the token it holds.
const TOKEN_MAX_AGE_SECONDS = 15 * 60;

export async function POST(request: NextRequest) {
  const { email, password, remember } = await request
    .json()
    .catch(() => ({}));
  if (
    typeof email !== "string" ||
    typeof password !== "string" ||
    !email ||
    !password
  ) {
    return NextResponse.json(
      { error: "Email and password are required." },
      { status: 400 }
    );
  }
  try {
    const upstream = await fetch(`${base}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!upstream.ok)
      return NextResponse.json(
        { error: "Invalid credentials or authentication service unavailable." },
        { status: 401 }
      );
    const data: unknown = await upstream.json();
    const token =
      data && typeof data === "object" && "access_token" in data
        ? (data as { access_token: unknown }).access_token
        : null;
    if (typeof token !== "string" || !token)
      return NextResponse.json(
        { error: "Unexpected login response." },
        { status: 502 }
      );
    const response = NextResponse.json({ ok: true });
    response.cookies.set(
      "nexa_access",
      token,
      sessionCookieOptions(
        remember === false ? undefined : TOKEN_MAX_AGE_SECONDS,
      ),
    );
    return response;
  } catch {
    return NextResponse.json(
      { error: "Cannot reach authentication service." },
      { status: 503 }
    );
  }
}
