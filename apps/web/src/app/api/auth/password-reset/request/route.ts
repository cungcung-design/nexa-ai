import { NextRequest, NextResponse } from "next/server";

import {
  AUTH_PASSWORD_RESET_REQUEST_PATH,
  forwardToAuthService,
} from "@/lib/auth-proxy";

/**
 * Ask the backend for a password reset link.
 *
 * The answer of the backend is the same for every address, so the route
 * never reveals whether an account exists.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const email =
    body && typeof body === "object" && typeof body.email === "string"
      ? body.email.trim()
      : "";
  if (!email) {
    return NextResponse.json(
      { error: "Email address is required." },
      { status: 400 }
    );
  }

  const result = await forwardToAuthService(
    AUTH_PASSWORD_RESET_REQUEST_PATH,
    { email }
  );
  if (result.status !== 200) {
    return NextResponse.json(result.body, { status: result.status });
  }

  const resendAvailableInSeconds =
    typeof result.body.resend_available_in_seconds === "number"
      ? result.body.resend_available_in_seconds
      : 0;
  const devResetLink =
    process.env.NODE_ENV === "production"
      ? null
      : typeof result.body.dev_reset_link === "string"
        ? result.body.dev_reset_link
        : null;

  return NextResponse.json({
    ok: true,
    message:
      typeof result.body.message === "string"
        ? result.body.message
        : "If an account exists for that address, a password reset link is on its way.",
    resendAvailableInSeconds,
    devResetLink,
  });
}
