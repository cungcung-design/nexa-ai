import { apiFetch } from "./client";

export type Agent = {
  id: string;
  name: string;
  description: string;
  published: boolean;
};

export async function fetchAgents(orgId: string): Promise<Agent[]> {
  const res = await apiFetch(`/api/v1/organizations/${orgId}/agents`);

  if (!res.ok) {
    throw new Error(`Failed to fetch agents (${res.status})`);
  }

  return res.json();
}
