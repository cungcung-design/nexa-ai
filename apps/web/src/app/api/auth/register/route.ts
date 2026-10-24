import { NextRequest, NextResponse } from "next/server";

import { sessionCookieOptions } from "@/lib/session-cookie";

const base = (
  process.env.NEXA_API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:8000"
).replace(/\/$/, "");

const TOKEN_MAX_AGE_SECONDS = 15 * 60;

export async function POST(request: NextRequest) {
  const { email, password, name } = await request.json().catch(() => ({}));
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
  if (password.length < 12) {
    return NextResponse.json(
      { error: "Password must be at least 12 characters." },
      { status: 400 }
    );
  }
  const fullName = typeof name === "string" ? name.trim() : "";
  try {
    const registered = await fetch(`${base}/api/v1/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password,
        ...(fullName ? { full_name: fullName } : {}),
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!registered.ok) {
      const detail = await registered
        .json()
        .then((d: unknown) =>
          d && typeof d === "object" && typeof (d as { detail?: unknown }).detail === "string"
            ? ((d as { detail: string }).detail)
            : null
        )
        .catch(() => null);
      return NextResponse.json(
        { error: detail ?? "Registration failed. The email may already be in use." },
        { status: registered.status === 409 ? 409 : 400 }
      );
    }

    const login = await fetch(`${base}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!login.ok)
      return NextResponse.json(
        { error: "Account created, but automatic sign-in failed. Please sign in manually." },
        { status: 502 }
      );
    const data: unknown = await login.json();
    const token =
      data && typeof data === "object" && "access_token" in data
        ? (data as { access_token: unknown }).access_token
        : null;
    if (typeof token !== "string" || !token)
      return NextResponse.json(
        { error: "Unexpected authentication response." },
        { status: 502 }
      );
    const response = NextResponse.json({ ok: true });
    response.cookies.set(
      "nexa_access",
      token,
      sessionCookieOptions(TOKEN_MAX_AGE_SECONDS),
    );
    return response;
  } catch {
    return NextResponse.json(
      { error: "Cannot reach authentication service." },
      { status: 503 }
    );
  }
}
