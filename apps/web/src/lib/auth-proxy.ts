/**
 * The shared plumbing of the authentication proxies.
 *
 * The browser never talks to the FastAPI service directly, it talks to the
 * same origin routes under `src/app/api/auth`. The helpers here forward a
 * request to the backend, translate the answer of the backend into the shape
 * the browser expects and keep the internal addresses out of the client.
 */

const base = (
  process.env.NEXA_API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:8000"
).replace(/\/$/, "");

export const AUTH_LOGIN_PATH =
  process.env.NEXA_AUTH_LOGIN_PATH ?? "/api/v1/auth/login";
export const AUTH_PASSWORD_RESET_REQUEST_PATH =
  process.env.NEXA_AUTH_PASSWORD_RESET_REQUEST_PATH ??
  "/api/v1/auth/password-reset/request";
export const AUTH_PASSWORD_RESET_VALIDATE_PATH =
  process.env.NEXA_AUTH_PASSWORD_RESET_VALIDATE_PATH ??
  "/api/v1/auth/password-reset/validate";
export const AUTH_PASSWORD_RESET_CONFIRM_PATH =
  process.env.NEXA_AUTH_PASSWORD_RESET_CONFIRM_PATH ??
  "/api/v1/auth/password-reset/confirm";

export type AuthProxyResult = {
  status: number;
  body: Record<string, unknown>;
};

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function readString(
  source: Record<string, unknown>,
  key: string,
): string | null {
  const value = source[key];
  return typeof value === "string" && value ? value : null;
}

/**
 * Forward a payload to the authentication service.
 *
 * A failed request never reaches the browser as a raw backend answer: the
 * `detail` of the backend becomes the `error` the screens show.
 */
export async function forwardToAuthService(
  path: string,
  payload: unknown,
): Promise<AuthProxyResult> {
  try {
    const upstream = await fetch(`${base}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    const data: unknown = await upstream.json().catch(() => ({}));
    if (upstream.ok) {
      return { status: upstream.status, body: asRecord(data) };
    }
    return {
      status: upstream.status,
      body: {
        error:
          readString(asRecord(data), "detail") ??
          "The request could not be completed. Please try again.",
      },
    };
  } catch {
    return {
      status: 503,
      body: { error: "Cannot reach authentication service." },
    };
  }
}
