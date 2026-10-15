function getAuthToken(): string {
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith("nexa_access="));
  return match ? match.split("=")[1] : "";
}

export function authHeaders(): Record<string, string> {
  const token = getAuthToken();
  return token
    ? { Authorization: `Bearer ${token}` }
    : {};
}

export async function apiFetch(
  input: string,
  init?: RequestInit,
): Promise<Response> {
  const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
  const url = input.startsWith("http")
    ? input
    : `${base}${input}`;
  return fetch(url, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      ...authHeaders(),
    },
  });
}
