/**
 * Only same-origin relative paths may be used as a post sign in redirect.
 * Anything that could point at another origin is rejected.
 */
export function safeNextPath(value: string | string[] | undefined) {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (!candidate) return undefined;
  if (!candidate.startsWith("/") || candidate.startsWith("//")) return undefined;
  return candidate;
}
