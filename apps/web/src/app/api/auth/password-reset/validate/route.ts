import { NextRequest, NextResponse } from "next/server";

import {
  AUTH_PASSWORD_RESET_VALIDATE_PATH,
  forwardToAuthService,
} from "@/lib/auth-proxy";

/**
 * Check a reset link before the new password is asked for.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const token =
    body && typeof body === "object" && typeof body.token === "string"
      ? body.token.trim()
      : "";
  if (!token) {
    return NextResponse.json(
      { error: "This reset link is invalid or has expired." },
      { status: 400 }
    );
  }

  const result = await forwardToAuthService(
    AUTH_PASSWORD_RESET_VALIDATE_PATH,
    { token }
  );
  if (result.status !== 200) {
    return NextResponse.json(result.body, { status: result.status });
  }

  return NextResponse.json({
    ok: true,
    valid: true,
    expiresInMinutes:
      typeof result.body.expires_in_minutes === "number"
        ? result.body.expires_in_minutes
        : null,
  });
}
