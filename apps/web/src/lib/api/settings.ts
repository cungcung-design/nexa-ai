/**
 * The client for the settings API.
 *
 * The browser only talks to the Next.js routes in `app/api`, which keep the
 * backend credentials and the organization check on the server.
 */

export type NotificationPreferences = {
  approvals: boolean;
  workflow_failures: boolean;
  agent_alerts: boolean;
  security_alerts: boolean;
  billing_updates: boolean;
  email_channel: boolean;
  in_app_channel: boolean;
};

export type PersonalSettings = {
  email: string;
  full_name: string;
  job_title: string;
  language: string;
  appearance: string;
  timezone: string;
  notifications: NotificationPreferences;
  mandatory_notifications: string[];
  supported: Record<string, unknown>;
};

export type WorkspaceGeneral = {
  name: string;
  slug: string;
};

export type WorkspaceSecurity = {
  session_timeout_minutes: number;
  require_tool_approval: boolean;
  mfa_supported: boolean;
  sessions_supported: boolean;
  mfa_note: string;
  sessions_note: string;
};

export type WorkspaceAi = {
  default_model: string | null;
  default_temperature: number | null;
  default_agent_timeout_seconds: number | null;
  default_tool_approval_policy: string | null;
  allowed_models: string[];
  require_tool_approval: boolean;
  capture_mode: string;
  available_models: string[];
  tool_approval_policies: string[];
  capture_modes: string[];
  temperature_range: number[];
  timeout_range: number[];
};

export type WorkspaceData = {
  retention_days: number;
  allow_data_export: boolean;
  export_scope: string;
  retention_enforced: boolean;
  note: string;
};

export type WorkspaceCapabilities = {
  mfa: boolean;
  sessions: boolean;
  sso: boolean;
  data_export: boolean;
  personal_account_deletion: boolean;
  workspace_deletion: boolean;
  ownership_transfer: boolean;
  workflow_overrides: boolean;
  run_overrides: boolean;
};

export type WorkspaceSettings = {
  organization: {
    id: string;
    name: string;
    slug: string;
    role: string;
  };
  general: WorkspaceGeneral;
  security: WorkspaceSecurity;
  ai: WorkspaceAi;
  data: WorkspaceData;
  capabilities: WorkspaceCapabilities;
  role: string;
  can_manage: boolean;
  current_user_email: string;
};

export type EffectiveSetting = {
  value: unknown;
  source: string;
  source_label: string;
  inherited: boolean;
  overridden: boolean;
  reset_available: boolean;
  locked_by_policy?: boolean;
};

export type EffectiveConfig = {
  agent: {
    id: string | null;
    name: string | null;
    version_id: string;
    version_number: number;
  };
  settings: Record<string, EffectiveSetting>;
  capture_mode: string;
  restrictions: {
    allowed_models: string[];
    require_tool_approval: boolean;
    model_allowed: boolean;
  };
  agent_override: AgentOverride | null;
  workflow_override: AgentOverride | null;
};

export type AgentOverride = {
  model: string | null;
  temperature: number | null;
  agent_timeout_seconds: number | null;
  tool_approval_policy: string | null;
};

export type AgentConfigSummary = {
  id: string;
  name: string;
  published_version_id: string | null;
  version_number: number | null;
  override: AgentOverride | null;
  inherited: boolean;
};

export type RunSnapshot = {
  id: string;
  agent_id: string | null;
  agent_version_id: string | null;
  workflow_key: string | null;
  run_id: string | null;
  resolved_config: Record<string, unknown>;
  sources: Record<string, string>;
  created_at: string;
};

export type ApiKey = {
  id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  is_active: boolean;
  created_at: string;
  revoked_at: string | null;
};

export type CreatedApiKey = ApiKey & { api_key: string };

export type TeamMemberSummary = {
  id: string;
  email: string;
  role: string;
  role_label: string;
  status: string;
};

export type ApiResult<T> = {
  ok: boolean;
  data: T | null;
  error: string | null;
  status: number;
};

async function request<T>(
  url: string,
  init?: RequestInit
): Promise<ApiResult<T>> {
  try {
    const response = await fetch(url, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
    });
    if (response.status === 204) {
      return { ok: true, data: null, error: null, status: response.status };
    }
    const text = await response.text();
    let payload: unknown = null;
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = null;
      }
    }
    if (!response.ok) {
      const detail =
        payload && typeof payload === "object" && "error" in payload
          ? String((payload as { error: unknown }).error)
          : `Request failed with status ${response.status}`;
      return { ok: false, data: null, error: detail, status: response.status };
    }
    return { ok: true, data: (payload as T) ?? null, error: null, status: response.status };
  } catch {
    return {
      ok: false,
      data: null,
      error: "The server could not be reached. Try again.",
      status: 0,
    };
  }
}

export function getPersonalSettings(): Promise<ApiResult<PersonalSettings>> {
  return request<PersonalSettings>("/api/settings/me");
}

export function savePersonalSettings(
  payload: Partial<
    Pick<
      PersonalSettings,
      "full_name" | "job_title" | "language" | "appearance" | "timezone"
    >
  >
): Promise<ApiResult<PersonalSettings>> {
  return request<PersonalSettings>("/api/settings/me", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function saveNotificationPreferences(
  payload: Partial<NotificationPreferences>
): Promise<ApiResult<PersonalSettings>> {
  return request<PersonalSettings>("/api/settings/me/notifications", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function changePassword(payload: {
  current_password: string;
  new_password: string;
}): Promise<ApiResult<{ ok: boolean; message: string }>> {
  return request<{ ok: boolean; message: string }>(
    "/api/settings/me/password",
    { method: "POST", body: JSON.stringify(payload) }
  );
}

export function getWorkspaceSettings(
  organizationId: string
): Promise<ApiResult<WorkspaceSettings>> {
  return request<WorkspaceSettings>(
    `/api/workspace/${encodeURIComponent(organizationId)}/settings`
  );
}

export function saveWorkspaceSettings(
  organizationId: string,
  payload: {
    general?: { name?: string; slug?: string };
    security?: {
      session_timeout_minutes?: number;
      require_tool_approval?: boolean;
    };
    data?: { retention_days?: number; allow_data_export?: boolean };
    ai?: {
      default_model?: string | null;
      default_temperature?: number | null;
      default_agent_timeout_seconds?: number | null;
      default_tool_approval_policy?: string | null;
      allowed_models?: string[];
      require_tool_approval?: boolean;
      capture_mode?: string;
    };
  }
): Promise<ApiResult<WorkspaceSettings>> {
  return request<WorkspaceSettings>(
    `/api/workspace/${encodeURIComponent(organizationId)}/settings`,
    { method: "PATCH", body: JSON.stringify(payload) }
  );
}

export function getEffectiveConfig(
  organizationId: string,
  agentId: string,
  versionId: string,
  workflowKey?: string | null
): Promise<ApiResult<EffectiveConfig>> {
  const params = new URLSearchParams({
    agent_id: agentId,
    version_id: versionId,
  });
  if (workflowKey) params.set("workflow_key", workflowKey);
  return request<EffectiveConfig>(
    `/api/workspace/${encodeURIComponent(organizationId)}/settings/ai/effective?${params.toString()}`
  );
}

export function getAgentConfigs(
  organizationId: string
): Promise<ApiResult<{ items: AgentConfigSummary[] }>> {
  return request<{ items: AgentConfigSummary[] }>(
    `/api/workspace/${encodeURIComponent(organizationId)}/settings/ai/agents`
  );
}

export function saveAgentOverride(
  organizationId: string,
  agentId: string,
  versionId: string,
  payload: AgentOverride
): Promise<ApiResult<AgentOverride>> {
  return request<AgentOverride>(
    `/api/workspace/${encodeURIComponent(
      organizationId
    )}/settings/ai/overrides/${encodeURIComponent(agentId)}/${encodeURIComponent(versionId)}`,
    { method: "PUT", body: JSON.stringify(payload) }
  );
}

export function resetAgentOverride(
  organizationId: string,
  agentId: string,
  versionId: string
): Promise<ApiResult<null>> {
  return request<null>(
    `/api/workspace/${encodeURIComponent(
      organizationId
    )}/settings/ai/overrides/${encodeURIComponent(agentId)}/${encodeURIComponent(versionId)}`,
    { method: "DELETE" }
  );
}

export function getRunSnapshots(
  organizationId: string
): Promise<ApiResult<{ items: RunSnapshot[] }>> {
  return request<{ items: RunSnapshot[] }>(
    `/api/workspace/${encodeURIComponent(organizationId)}/settings/runs`
  );
}

export function listApiKeys(
  organizationId: string
): Promise<ApiResult<ApiKey[]>> {
  return request<ApiKey[]>(
    `/api/workspace/${encodeURIComponent(organizationId)}/api-keys`
  );
}

export function createApiKey(
  organizationId: string,
  payload: { name: string; scopes: string[] }
): Promise<ApiResult<CreatedApiKey>> {
  return request<CreatedApiKey>(
    `/api/workspace/${encodeURIComponent(organizationId)}/api-keys`,
    { method: "POST", body: JSON.stringify(payload) }
  );
}

export function rotateApiKey(
  organizationId: string,
  keyId: string
): Promise<ApiResult<CreatedApiKey>> {
  return request<CreatedApiKey>(
    `/api/workspace/${encodeURIComponent(
      organizationId
    )}/api-keys/${encodeURIComponent(keyId)}/rotate`,
    { method: "POST" }
  );
}

export function revokeApiKey(
  organizationId: string,
  keyId: string
): Promise<ApiResult<ApiKey>> {
  return request<ApiKey>(
    `/api/workspace/${encodeURIComponent(
      organizationId
    )}/api-keys/${encodeURIComponent(keyId)}/revoke`,
    { method: "POST" }
  );
}

export function listTeamMembers(
  organizationId: string
): Promise<ApiResult<{ items: TeamMemberSummary[] }>> {
  return request<{ items: TeamMemberSummary[] }>(
    `/api/workspace/${encodeURIComponent(organizationId)}/team/members`
  );
}

export function transferOwnership(
  organizationId: string,
  membershipId: string
): Promise<ApiResult<{ ok: boolean; new_owner: string; message: string }>> {
  return request<{ ok: boolean; new_owner: string; message: string }>(
    `/api/workspace/${encodeURIComponent(organizationId)}/settings/ownership/transfer`,
    { method: "POST", body: JSON.stringify({ membership_id: membershipId }) }
  );
}

export function deleteWorkspace(
  organizationId: string,
  confirmName: string
): Promise<ApiResult<{ ok: boolean; message: string }>> {
  return request<{ ok: boolean; message: string }>(
    `/api/workspace/${encodeURIComponent(organizationId)}/settings/delete`,
    { method: "POST", body: JSON.stringify({ confirm_name: confirmName }) }
  );
}
