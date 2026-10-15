import "server-only";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { API_URL } from "@/lib/api";
import { authorizedOrganization } from "@/lib/workspace";

export async function proxyRequest(
  request: NextRequest,
  orgId: string,
  path: string,
  options: { multipart?: boolean; maxBytes?: number; timeoutMs?: number } = {}
) {
  const token = (await cookies()).get("nexa_access")?.value;
  if (!token)
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  if (!(await authorizedOrganization(orgId)))
    return NextResponse.json(
      { error: "Workspace unavailable" },
      { status: 403 }
    );
  if (request.method !== "GET") {
    const origin = request.headers.get("origin");
    const expected = request.nextUrl.origin;
    if (origin !== expected)
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
    const text = await response.text();
    const contentType =
      response.headers.get("content-type") || "application/json";
    return new NextResponse(text, {
      status: response.status,
      headers: { "Content-Type": contentType, "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json(
      { error: "Backend unavailable" },
      { status: 503 }
    );
  }
}
