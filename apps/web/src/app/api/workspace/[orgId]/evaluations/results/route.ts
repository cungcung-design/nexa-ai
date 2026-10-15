import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

type RouteContext = {
  params: Promise<{ orgId: string }>;
};

export async function GET(
  _request: NextRequest,
  context: RouteContext
) {
  const { orgId } = await context.params;

  const cookieStore = await cookies();

  // Replace this name if your existing authentication
  // integration uses a different HttpOnly cookie.
  const token = cookieStore.get("nexa_access_token")?.value;

  if (!token) {
    return NextResponse.json(
      { detail: "Unauthorized" },
      { status: 401 }
    );
  }

  const baseUrl = process.env.NEXA_API_URL;

  if (!baseUrl) {
    return NextResponse.json(
      { detail: "Backend URL not configured" },
      { status: 500 }
    );
  }

  const response = await fetch(
    `${baseUrl}/api/v1/organizations/${encodeURIComponent(
      orgId
    )}/evaluations/results`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    }
  );

  const data = await response.json();

  return NextResponse.json(data, {
    status: response.status,
  });
}