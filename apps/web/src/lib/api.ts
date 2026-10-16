import "server-only";
import { cookies } from "next/headers";

export const API_URL = (
  process.env.NEXA_API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:8000"
).replace(/\/$/, "");
export const AUTH_ME_PATH =
  process.env.NEXA_AUTH_ME_PATH ?? "/api/v1/auth/me";
export const ORGS_PATH =
  process.env.NEXA_ORGANIZATIONS_PATH ?? "/api/v1/organizations";

export type User = {
  id: string;
  email: string;
  full_name?: string | null;
};
export type Organization = {
  id: string;
  name: string;
  slug: string;
  role: string;
};
export type Agent = {
  id: string;
  organization_id?: string;
  name: string;
  description?: string | null;
  is_archived?: boolean;
  published_version_id?: string | null;
  latest_version_number?: number | null;
  created_at?: string;
};
export type AgentVersion = {
  id: string;
  agent_id: string;
  version_number: number;
  system_prompt: string;
  model: string;
  temperature: number;
  max_tokens: number;
  tools_config?: Record<string, unknown>;
  created_at: string;
};

export type Trace = {
  id: string;
  organization_id: string;
  agent_id: string;
  status: string;
  error_code: string | null;
  latency_ms: number;
  prompt_tokens: number;
  completion_tokens: number;
  created_at: string;
};

export type SpanResponse = {
  id: string;
  trace_id: string;
  name: string;
  duration_ms: number;
  status: string;
};

export async function backendGet<T>(path: string): Promise<T | null> {
  const token = (await cookies()).get("nexa_access")?.value;
  if (!token) return null;
  try {
    const res = await fetch(`${API_URL}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      next: { revalidate: 30, tags: ["backend-api"] },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export function asArray<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    for (const key of ["items", "organizations", "agents", "data"]) {
      if (Array.isArray(obj[key])) return obj[key] as T[];
    }
  }
  return [];
}
