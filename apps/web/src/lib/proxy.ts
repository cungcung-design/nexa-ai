import "server-only";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { API_URL } from "@/lib/api";
import { authorizedOrganization } from "@/lib/workspace";

/**
 * A state changing request must come from the same origin that serves the
 * app. The dev server and a reverse proxy can expose the same application
 * under different hosts (for example `localhost` and `127.0.0.1`), so the
 * request is accepted when the origin host matches either the resolved
 * request host or the host the browser actually asked for.
 */
function isSameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;

  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    return false;
  }

  const candidates = new Set<string>();
  if (request.nextUrl.host) candidates.add(request.nextUrl.host);
  const hostHeader = request.headers.get("host");
  if (hostHeader) candidates.add(hostHeader);

  return candidates.has(originHost);
}

export async function proxyRequest(
  request: NextRequest,
  orgId: string,
  path: string,
  options: { multipart?: boolean; maxBytes?: number; timeoutMs?: number } = {}
) {  const token = (await cookies()).get("nexa_access")?.value;
  if (!token)
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  if (!(await authorizedOrganization(orgId)))
    return NextResponse.json(
      { error: "Workspace unavailable" },
      { status: 403 }
    );
  if (request.method !== "GET") {
    if (!isSameOrigin(request))
      return NextResponse.json(
        { error: "Invalid request origin" },
        { status: 403 }
      );
  }
  try {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
    };
    let body: BodyInit | undefined;
    if (request.method !== "GET" && request.method !== "HEAD") {
      const length = Number(request.headers.get("content-length") || 0);
      if (length > (options.maxBytes ?? 6_000_000))
        return NextResponse.json(
          { error: "Payload too large" },
          { status: 413 }
        );
      const bytes = await request.arrayBuffer();
      if (bytes.byteLength > (options.maxBytes ?? 6_000_000))
        return NextResponse.json(
          { error: "Payload too large" },
          { status: 413 }
        );
      body = bytes;
      const type = request.headers.get("content-type");
      if (type) headers["Content-Type"] = type;
    }
    const response = await fetch(`${API_URL}${path}`, {
      method: request.method,
      headers,
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(options.timeoutMs ?? 65000),
    });
    // 204/205/304 responses must not carry a body, so they are forwarded
    // without one.
    const nullBodyStatus =
      response.status === 204 ||
      response.status === 205 ||
      response.status === 304;
    const text = nullBodyStatus ? "" : await response.text();
    const responseHeaders: Record<string, string> = {
      "Cache-Control": "no-store",
    };
    if (!nullBodyStatus) {
      responseHeaders["Content-Type"] =
        response.headers.get("content-type") || "application/json";
    }
    const disposition = response.headers.get("content-disposition");
    if (disposition) responseHeaders["Content-Disposition"] = disposition;
    return new NextResponse(nullBodyStatus ? null : text, {
      status: response.status,
      headers: responseHeaders,
    });
  } catch {
    return NextResponse.json(
      { error: "Backend unavailable" },
      { status: 503 }
    );
  }
}

/**
 * A proxy for the routes that are scoped to the signed in user instead of a
 * workspace. The session cookie is required and a state changing request
 * still has to come from the same origin.
 */
export async function proxyUserRequest(
  request: NextRequest,
  path: string,
  options: { maxBytes?: number; timeoutMs?: number } = {}
) {
  const token = (await cookies()).get("nexa_access")?.value;
  if (!token)
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  if (request.method !== "GET" && !isSameOrigin(request))
    return NextResponse.json(
      { error: "Invalid request origin" },
      { status: 403 }
    );
  try {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
    };
    let body: BodyInit | undefined;
    if (request.method !== "GET" && request.method !== "HEAD") {
      const bytes = await request.arrayBuffer();
      if (bytes.byteLength > (options.maxBytes ?? 256_000))
        return NextResponse.json(
          { error: "Payload too large" },
          { status: 413 }
        );
      body = bytes;
      const type = request.headers.get("content-type");
      if (type) headers["Content-Type"] = type;
    }
    const response = await fetch(`${API_URL}${path}`, {
      method: request.method,
      headers,
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(options.timeoutMs ?? 65000),
    });
    const nullBodyStatus =
      response.status === 204 ||
      response.status === 205 ||
      response.status === 304;
    const text = nullBodyStatus ? "" : await response.text();
    const responseHeaders: Record<string, string> = {
      "Cache-Control": "no-store",
    };
    if (!nullBodyStatus) {
      responseHeaders["Content-Type"] =
        response.headers.get("content-type") || "application/json";
    }
    return new NextResponse(nullBodyStatus ? null : text, {
      status: response.status,
      headers: responseHeaders,
    });
  } catch {
    return NextResponse.json(
      { error: "Backend unavailable" },
      { status: 503 }
    );
  }
}
