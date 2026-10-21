import { NextRequest } from "next/server";
import { proxyUserRequest } from "@/lib/proxy";

export async function POST(request: NextRequest) {
  return proxyUserRequest(request, "/api/v1/onboarding/join");
}
