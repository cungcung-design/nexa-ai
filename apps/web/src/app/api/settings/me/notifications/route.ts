import { NextRequest } from "next/server";
import { proxyUserRequest } from "@/lib/proxy";

export async function PATCH(request: NextRequest) {
  return proxyUserRequest(request, "/api/v1/settings/me/notifications");
}
