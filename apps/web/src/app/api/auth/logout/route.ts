import { NextResponse } from "next/server";

import { sessionCookieOptions } from "@/lib/session-cookie";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set("nexa_access", "", sessionCookieOptions(0));
  return response;
}
