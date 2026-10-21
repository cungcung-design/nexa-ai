import { NextRequest } from "next/server";
import { proxyUserRequest } from "@/lib/proxy";

export async function GET(request: NextRequest) {
  // The slug is a query parameter, so the search is forwarded as well.
  return proxyUserRequest(
    request,
    `/api/v1/onboarding/slug-available${request.nextUrl.search}`
  );
}
