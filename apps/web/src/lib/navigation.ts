/**
 * Only same-origin relative paths may be used as a post sign in redirect.
 * Anything that could point at another origin is rejected.
 */
const POST_AUTH_COOKIE = "nexa_post_auth";

export function safeNextPath(value: string | string[] | undefined) {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (!candidate) return undefined;
  if (!candidate.startsWith("/") || candidate.startsWith("//")) return undefined;
  return candidate;
}

/**
 * Remember a same-origin path across the email confirmation link.
 *
 * The confirmation link can open in the same browser without the original
 * query string, so the path is kept in a short-lived cookie.
 */
export function rememberPostAuthPath(path: string | undefined) {
  if (typeof document === "undefined") return;
  if (!path) {
    document.cookie = `${POST_AUTH_COOKIE}=;path=/;max-age=0;samesite=lax`;
    return;
  }
  document.cookie = `${POST_AUTH_COOKIE}=${encodeURIComponent(
    path
  )};path=/;max-age=3600;samesite=lax`;
}

export function readPostAuthPath() {
  if (typeof document === "undefined") return undefined;
  const parts = document.cookie.split(";").map((part) => part.trim());
  const match = parts.find((part) => part.startsWith(`${POST_AUTH_COOKIE}=`));
  if (!match) return undefined;
  return safeNextPath(decodeURIComponent(match.slice(POST_AUTH_COOKIE.length + 1)));
}

export function verificationPath(next?: string) {
  if (!next) return "/verify-email";
  return `/verify-email?next=${encodeURIComponent(next)}`;
}
