import { NextRequest, NextResponse } from "next/server";

import {
  AUTH_PASSWORD_RESET_CONFIRM_PATH,
  forwardToAuthService,
} from "@/lib/auth-proxy";

const MIN_PASSWORD_LENGTH = 12;

/**
 * Store the new password.
 *
 * The backend signs every session of the account out, so the cookie of the
 * browser is dropped as well.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const token =
    body && typeof body === "object" && typeof body.token === "string"
      ? body.token.trim()
      : "";
  const password =
    body && typeof body === "object" && typeof body.password === "string"
      ? body.password
      : "";
  if (!token) {
    return NextResponse.json(
      { error: "This reset link is invalid or has expired." },
      { status: 400 }
    );
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json(
      { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` },
      { status: 400 }
    );
  }

  const result = await forwardToAuthService(AUTH_PASSWORD_RESET_CONFIRM_PATH, {
    token,
    password,
  });
  if (result.status !== 200) {
    return NextResponse.json(result.body, { status: result.status });
  }

  const response = NextResponse.json({ ok: true });
  // The password of the account changed, so the old session is worthless.
  response.cookies.set("nexa_access", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
