/**
 * Session cookie flags.
 *
 * NODE_ENV=production is also used for the local HTTP staging check, so the
 * Secure flag is chosen with COOKIE_SECURE. Behind Caddy it is true. On the
 * local HTTP check it is false, otherwise the browser would drop the cookie.
 */
export function sessionCookieSecure(): boolean {
  const flag = process.env.COOKIE_SECURE;
  if (flag === "true") return true;
  if (flag === "false") return false;
  return process.env.NODE_ENV === "production";
}

export function sessionCookieOptions(maxAge?: number) {
  return {
    httpOnly: true as const,
    secure: sessionCookieSecure(),
    sameSite: "lax" as const,
    path: "/",
    ...(maxAge === undefined ? {} : { maxAge }),
  };
}
