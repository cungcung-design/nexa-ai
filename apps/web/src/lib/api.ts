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

export type Member = {
  user_id: string;
  email: string;
  role: string;
};

export type IntegrationProvider = {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: string;
  auth_type: string;
  config_schema: Record<string, unknown>;
  capabilities: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type WorkspaceConnection = {
  id: string;
  organization_id: string;
  provider_id: string;
  provider_name?: string | null;
  provider_slug?: string | null;
  provider_auth_type?: string | null;
  provider_capabilities?: string[] | null;
  name: string;
  status: string;
  auth_type: string;
  scopes: string[];
  config: Record<string, unknown>;
  has_credentials: boolean;
  last_tested_at: string | null;
  last_tested_ok: boolean | null;
  created_at: string;
  updated_at: string;
};

export type ConnectionSummary = {
  id: string;
  name: string;
  provider_name: string | null;
  provider_slug: string | null;
  status: string;
  auth_type: string;
  has_credentials: boolean;
  agent_count: number;
  workflow_count: number;
  last_tested_at: string | null;
  last_tested_ok: boolean | null;
};

export type ConnectionAgentAccess = {
  id: string;
  connection_id: string;
  agent_id: string;
  agent_name: string | null;
  actions: string[];
  created_at: string;
};

export type ConnectionWorkflowAccess = {
  id: string;
  connection_id: string;
  workflow_id: string;
  step_key: string;
  created_at: string;
};

export type IntegrationWebhook = {
  id: string;
  organization_id: string;
  connection_id: string;
  connection_name?: string | null;
  name: string;
  target_url: string;
  events: string[];
  has_secret: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type IntegrationWebhookDelivery = {
  id: string;
  webhook_id: string;
  event: string;
  status: string;
  response_status: number | null;
  attempted_at: string;
  completed_at: string | null;
};

export type IntegrationActivity = {
  id: string;
  organization_id: string;
  connection_id: string | null;
  webhook_id: string | null;
  action: string;
  actor_id: string | null;
  activity_metadata: Record<string, unknown>;
  created_at: string;
};

export type Approval = {
  id: string;
  organization_id: string;
  agent_id: string;
  thread_id: string;
  action: string;
  arguments: Record<string, unknown>;
  status: "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED";
  requested_by: string | null;
  decided_by: string | null;
  decided_at: string | null;
  created_at: string;
};

export type ApprovalListItem = {
  id: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED";
  action: string;
  thread_id: string;
  requested_by: string | null;
  created_at: string;
};

export type ApprovalDetail = Approval & {
  execution_status: string | null;
  execution_result: Record<string, unknown> | null;
  policy_id: string | null;
  assigned_reviewer: string | null;
};

export type ApprovalStats = {
  pending: number;
  approved_today: number;
  rejected_today: number;
  expired: number;
};

export type ApprovalPolicy = {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  action_pattern: string;
  risk_level: "low" | "medium" | "high" | "critical";
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
};

export type ApprovalPolicyCreate = {
  name: string;
  description?: string | null;
  action_pattern: string;
  risk_level: "low" | "medium" | "high" | "critical";
  is_enabled: boolean;
};

export type ApprovalAssignment = {
  id: string;
  organization_id: string;
  policy_id: string | null;
  user_id: string;
  user_email: string;
  is_primary: boolean;
  created_at: string;
};

export type ApprovalAssignmentCreate = {
  policy_id: string | null;
  user_id: string;
  is_primary?: boolean;
};

export async function approvalsList(orgId: string): Promise<ApprovalListItem[]> {
  return asArray<ApprovalListItem>(
    await backendGet<unknown>(
      `/api/v1/organizations/${orgId}/approvals`
    )
  );
}

export async function approvalsStats(orgId: string): Promise<ApprovalStats | null> {
  return backendGet<ApprovalStats>(
    `/api/v1/organizations/${orgId}/approvals/stats`
  );
}

export async function approvalsHistory(orgId: string): Promise<ApprovalListItem[]> {
  return asArray<ApprovalListItem>(
    await backendGet<unknown>(
      `/api/v1/organizations/${orgId}/approvals/history`
    )
  );
}

export async function approvalDetail(orgId: string, approvalId: string): Promise<ApprovalDetail | null> {
  return backendGet<ApprovalDetail>(
    `/api/v1/organizations/${orgId}/approvals/${approvalId}`
  );
}

export async function approvalPolicies(orgId: string): Promise<ApprovalPolicy[]> {
  return asArray<ApprovalPolicy>(
    await backendGet<unknown>(
      `/api/v1/organizations/${orgId}/approvals/policies`
    )
  );
}

export async function approvalAssignments(orgId: string): Promise<ApprovalAssignment[]> {
  return asArray<ApprovalAssignment>(
    await backendGet<unknown>(
      `/api/v1/organizations/${orgId}/approvals/assignments`
    )
  );
}

export type AuditEvent = {
  id: string;
  event_id: string | null;
  organization_id: string;
  actor_user_id: string | null;
  actor_type: string;
  actor_name: string | null;
  actor_email: string | null;
  action: string;
  title: string;
  label: string;
  summary: string | null;
  category: string;
  categories: string[];
  outcome: string;
  resource_type: string;
  resource_id: string | null;
  resource_name: string | null;
  resource_available: boolean;
  source: string;
  details: Record<string, unknown> | null;
  changes: Record<string, unknown> | null;
  created_at: string;
};

export type AuditEventList = {
  items: AuditEvent[];
  total: number;
  limit: number;
  offset: number;
  page: number;
  page_size: number;
  page_count: number;
};

export type AuditStats = {
  total_events: number;
  security_events: number;
  failed_actions: number;
  active_actors: number;
  period_from: string | null;
  period_to: string | null;
  timezone: string;
};

export type AuditActivityPoint = {
  date: string;
  label: string;
  count: number;
};

export type AuditActivity = {
  timezone: string;
  days: number;
  points: AuditActivityPoint[];
};

export type AuditCategory = {
  id: string;
  name: string;
  description: string;
  color: string;
  bg: string;
  event_count: number;
};

export type AuditChangeGroup = {
  resource_type: string;
  resource_id: string | null;
  resource_name: string | null;
  resource_available: boolean;
  events: AuditEvent[];
};

export type AuditChanges = {
  total: number;
  groups: AuditChangeGroup[];
};

export type AuditFilters = {
  limit?: number;
  offset?: number;
  search?: string;
  category?: string;
  outcome?: string;
  actor?: string;
  resource_type?: string;
  resource_id?: string;
  date_from?: string;
  date_to?: string;
  date?: string;
  tz?: string;
};

export type ExportRequest = {
  format: "csv" | "json";
  scope: "filtered" | "date_range" | "metadata";
  search?: string;
  category?: string;
  outcome?: string;
  actor?: string;
  resource_type?: string;
  resource_id?: string;
  date_from?: string;
  date_to?: string;
  date?: string;
  tz?: string;
};

export type ExportResponse = {
  export_id: string;
  status: string;
  format: string;
  scope: string;
  record_count: number | null;
  download_url: string | null;
  error: string | null;
  created_at: string;
};

function auditQuery(params?: AuditFilters): string {
  const searchParams = new URLSearchParams();
  if (!params) return "";
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    searchParams.set(key, String(value));
  }
  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

export async function auditEvents(
  orgId: string,
  params?: AuditFilters,
): Promise<AuditEventList | null> {
  return backendGet<AuditEventList>(
    `/api/v1/organizations/${orgId}/audit-logs${auditQuery(params)}`,
  );
}

export async function auditEvent(
  orgId: string,
  eventId: string,
): Promise<AuditEvent | null> {
  return backendGet<AuditEvent>(
    `/api/v1/organizations/${orgId}/audit-logs/${eventId}`,
  );
}

export async function auditStats(
  orgId: string,
  params?: AuditFilters,
): Promise<AuditStats | null> {
  return backendGet<AuditStats>(
    `/api/v1/organizations/${orgId}/audit-logs/stats${auditQuery(params)}`,
  );
}

export async function auditActivity(
  orgId: string,
  params?: { days?: number; date_from?: string; date_to?: string; tz?: string },
): Promise<AuditActivity | null> {
  return backendGet<AuditActivity>(
    `/api/v1/organizations/${orgId}/audit-logs/activity${auditQuery(params)}`,
  );
}

export async function auditCategories(
  orgId: string,
  params?: { date_from?: string; date_to?: string; date?: string; tz?: string },
): Promise<AuditCategory[]> {
  return asArray<AuditCategory>(
    await backendGet<unknown>(
      `/api/v1/organizations/${orgId}/audit-logs/categories${auditQuery(params)}`,
    ),
  );
}

export async function auditChanges(
  orgId: string,
  params?: AuditFilters & { limit?: number },
): Promise<AuditChanges | null> {
  return backendGet<AuditChanges>(
    `/api/v1/organizations/${orgId}/audit-logs/changes${auditQuery(params)}`,
  );
}

export async function auditExport(
  orgId: string,
  payload: ExportRequest,
): Promise<ExportResponse | null> {
  return backendPost<ExportResponse>(
    `/api/v1/organizations/${orgId}/audit-logs/export`,
    payload,
  );
}

export async function auditExportStatus(
  orgId: string,
  exportId: string,
): Promise<ExportResponse | null> {
  return backendGet<ExportResponse>(
    `/api/v1/organizations/${orgId}/audit-logs/export/${exportId}`,
  );
}

export type TeamMember = {
  id: string;
  user_id: string;
  email: string;
  role: string;
  role_label: string;
  status: string;
  created_at: string;
  permissions: string[];
};

export type TeamMemberList = {
  items: TeamMember[];
  total: number;
};

export type TeamMetrics = {
  total_members: number;
  active_members: number;
  suspended_members: number;
  pending_invitations: number;
  roles: number;
};

export type TeamInvitation = {
  id: string;
  organization_id: string;
  organization_name: string;
  email: string;
  role: string;
  role_label: string;
  status: string;
  message: string | null;
  invited_by_email: string | null;
  expires_at: string;
  created_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
  permissions: string[];
  permission_labels: string[];
  invite_token: string | null;
};

export type InvitationPreview = {
  email: string;
  organization_id: string;
  organization_name: string;
  role: string;
  role_label: string;
  status: string;
  message: string | null;
  expires_at: string;
  permissions: string[];
  permission_labels: string[];
};

export type TeamRoleSummary = {
  role: string;
  label: string;
  description: string;
  permissions: string[];
  permission_labels: string[];
  member_count: number;
};

export type TeamMatrixCapability = {
  capability: string;
  permission: string;
  grants: Record<string, boolean>;
};

export type TeamMatrix = {
  roles: string[];
  role_labels: Record<string, string>;
  capabilities: TeamMatrixCapability[];
};

export type TeamEffectivePermission = {
  permission: string;
  label: string;
  granted: boolean;
  source: string;
  restriction: string | null;
};

export type TeamResource = {
  id: string;
  name: string;
  type: string;
  href: string | null;
  can_open: boolean;
};

export type TeamResources = {
  agents: TeamResource[];
  knowledge_bases: TeamResource[];
  approvals: TeamResource[];
  agents_count: number;
  knowledge_bases_count: number;
  approvals_count: number;
  workflows_supported: boolean;
  workflows_note: string;
};

export type TeamActivityEntry = {
  id: string;
  action: string;
  title: string;
  summary: string | null;
  category: string;
  outcome: string;
  resource_type: string;
  resource_id: string | null;
  resource_name: string | null;
  actor_email: string | null;
  created_at: string;
};

export type TeamMemberDetail = {
  member: TeamMember;
  effective_permissions: TeamEffectivePermission[];
  granted_permissions: string[];
  groups_supported: boolean;
  groups_note: string;
  direct_access_supported: boolean;
  direct_access_note: string;
  resources: TeamResources;
  activity: TeamActivityEntry[];
  can_manage: boolean;
};

export async function teamMetrics(orgId: string): Promise<TeamMetrics | null> {
  return backendGet<TeamMetrics>(
    `/api/v1/organizations/${orgId}/team/metrics`,
    { revalidate: 0 }
  );
}

export async function teamMembers(orgId: string): Promise<TeamMemberList | null> {
  return backendGet<TeamMemberList>(
    `/api/v1/organizations/${orgId}/team/members`,
    { revalidate: 0 }
  );
}

export async function teamMember(
  orgId: string,
  membershipId: string
): Promise<TeamMemberDetail | null> {
  return backendGet<TeamMemberDetail>(
    `/api/v1/organizations/${orgId}/team/members/${membershipId}`,
    { revalidate: 0 }
  );
}

export async function teamInvitations(orgId: string): Promise<TeamInvitation[]> {
  return asArray<TeamInvitation>(
    await backendGet<unknown>(
      `/api/v1/organizations/${orgId}/team/invitations`,
      { revalidate: 0 }
    )
  );
}

export async function teamRoles(orgId: string): Promise<TeamRoleSummary[]> {
  return asArray<TeamRoleSummary>(
    await backendGet<unknown>(`/api/v1/organizations/${orgId}/team/roles`, {
      revalidate: 0,
    })
  );
}

export async function teamMatrix(orgId: string): Promise<TeamMatrix | null> {
  return backendGet<TeamMatrix>(
    `/api/v1/organizations/${orgId}/team/permissions/matrix`,
    { revalidate: 0 }
  );
}

export async function teamActivity(orgId: string): Promise<TeamActivityEntry[]> {
  return asArray<TeamActivityEntry>(
    await backendGet<unknown>(`/api/v1/organizations/${orgId}/team/activity`, {
      revalidate: 0,
    })
  );
}

/**
 * Invitation preview. The endpoint is public, so it is read without the
 * session cookie: the recipient may not be signed in yet.
 */
export async function invitationPreview(
  token: string
): Promise<InvitationPreview | null> {  try {
    const res = await fetch(
      `${API_URL}/api/v1/invitations/${encodeURIComponent(token)}`,
      { cache: "no-store", signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return null;
    return (await res.json()) as InvitationPreview;
  } catch {
    return null;
  }
}

export async function backendPost<T>(
  path: string,
  body: unknown,
): Promise<T> {
  const token = (await cookies()).get("nexa_access")?.value;
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return null as unknown as T;
  return (await res.json()) as T;
}

export async function integrationProviders(orgId: string): Promise<IntegrationProvider[]> {
  return asArray<IntegrationProvider>(
    await backendGet<unknown>(
      `/api/v1/organizations/${orgId}/integrations/providers`
    )
  );
}

export async function integrationConnections(orgId: string): Promise<WorkspaceConnection[]> {
  return asArray<WorkspaceConnection>(
    await backendGet<unknown>(
      `/api/v1/organizations/${orgId}/integrations/connections`
    )
  );
}

export async function integrationConnection(orgId: string, connectionId: string): Promise<WorkspaceConnection | null> {
  return backendGet<WorkspaceConnection>(
    `/api/v1/organizations/${orgId}/integrations/connections/${connectionId}`
  );
}

export async function integrationWebhooks(orgId: string): Promise<IntegrationWebhook[]> {
  return asArray<IntegrationWebhook>(
    await backendGet<unknown>(
      `/api/v1/organizations/${orgId}/integrations/webhooks`
    )
  );
}

export async function integrationActivity(orgId: string): Promise<IntegrationActivity[]> {
  return asArray<IntegrationActivity>(
    await backendGet<unknown>(
      `/api/v1/organizations/${orgId}/integrations/activity`
    )
  );
}

export async function integrationWebhookDeliveries(orgId: string, webhookId: string): Promise<IntegrationWebhookDelivery[]> {
  return asArray<IntegrationWebhookDelivery>(
    await backendGet<unknown>(
      `/api/v1/organizations/${orgId}/integrations/webhooks/${webhookId}/deliveries`
    )
  );
}

export async function integrationConnectionAgents(orgId: string, connectionId: string): Promise<ConnectionAgentAccess[]> {
  return asArray<ConnectionAgentAccess>(
    await backendGet<unknown>(
      `/api/v1/organizations/${orgId}/integrations/connections/${connectionId}/agents`
    )
  );
}

export async function integrationConnectionWorkflows(orgId: string, connectionId: string): Promise<ConnectionWorkflowAccess[]> {
  return asArray<ConnectionWorkflowAccess>(
    await backendGet<unknown>(
      `/api/v1/organizations/${orgId}/integrations/connections/${connectionId}/workflows`
    )
  );
}

export async function integrationAffected(orgId: string, connectionId: string): Promise<unknown> {
  return backendGet<unknown>(
    `/api/v1/organizations/${orgId}/integrations/connections/${connectionId}/affected`
  );
}

export type Agent = {  id: string;
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

export async function backendGet<T>(
  path: string,
  options: { revalidate?: number } = {}
): Promise<T | null> {
  const token = (await cookies()).get("nexa_access")?.value;
  if (!token) return null;
  const revalidate = options.revalidate ?? 30;
  try {
    const res = await fetch(`${API_URL}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      // A response that must not be kept is fetched with `no-store`. The
      // legacy `revalidate` option is not usable here: it asks the cache for
      // the current time, which cannot be prerendered.
      ...(revalidate === 0
        ? { cache: "no-store" as const }
        : { next: { revalidate, tags: ["backend-api"] } }),
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

export type BillingPlanLimits = {
  agents: number;
  monthly_requests: number;
  knowledge_bases: number;
  workflow_executions: number;
  storage_mb: number;
  seats: number;
};

export type BillingPrice = {
  amount: number;
  currency: string;
  interval: string;
  monthly_equivalent: number;
  annual_total: number;
};

export type BillingCatalogPlan = {
  key: string;
  label: string;
  tagline: string;
  features: string[];
  limits: BillingPlanLimits;
  monthly: BillingPrice | null;
  yearly: BillingPrice | null;
  contact_sales: boolean;
  popular: boolean;
  purchasable: boolean;
  current: boolean;
};

export type BillingCatalog = {
  currency: string;
  plans: BillingCatalogPlan[];
  provider_configured: boolean;
};

export type BillingSubscription = {
  plan: string;
  plan_label: string;
  status: string;
  interval: string;
  price_amount: number;
  currency: string;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  canceled_at: string | null;
  created_at: string | null;
  has_provider_subscription: boolean;
  provider_configured: boolean;
  limits: BillingPlanLimits;
  price: BillingPrice | null;
};

export type BillingUsageQuota = {
  key: string;
  label: string;
  unit: string;
  used: number;
  limit: number | null;
  unlimited: boolean;
  tracked: boolean;
};

export type BillingUsagePoint = {
  day: string;
  value: number;
};

export type BillingUsage = {
  period: string;
  period_start: string;
  period_end: string;
  interval: string;
  quotas: BillingUsageQuota[];
  request_count: number;
  prompt_tokens: number;
  completion_tokens: number;
  estimated_cost_cents: number;
  seats_used: number;
  trend: BillingUsagePoint[];
};

export type BillingInvoice = {
  id: string;
  number: string;
  status: string;
  currency: string;
  amount_due: number;
  amount_paid: number;
  tax_amount: number;
  period_start: string | null;
  period_end: string | null;
  hosted_invoice_url: string | null;
  invoice_pdf: string | null;
  created_at: string;
};

export type BillingPaymentMethod = {
  id: string;
  brand: string;
  last4: string;
  exp_month: number | null;
  exp_year: number | null;
  holder_name: string | null;
  is_default: boolean;
  in_use: boolean;
};

export type BillingSettings = {
  company_name: string;
  billing_email: string | null;
  address: string | null;
  tax_id: string | null;
};

export async function billingCatalog(
  orgId: string
): Promise<BillingCatalog | null> {
  return backendGet<BillingCatalog>(
    `/api/v1/organizations/${orgId}/billing/catalog`,
    { revalidate: 0 }
  );
}

export async function billingSubscription(
  orgId: string
): Promise<BillingSubscription | null> {
  return backendGet<BillingSubscription>(
    `/api/v1/organizations/${orgId}/billing/subscription`,
    { revalidate: 0 }
  );
}

export async function billingUsage(orgId: string): Promise<BillingUsage | null> {
  return backendGet<BillingUsage>(
    `/api/v1/organizations/${orgId}/billing/usage`,
    { revalidate: 0 }
  );
}

export async function billingInvoices(
  orgId: string
): Promise<BillingInvoice[]> {
  return asArray<BillingInvoice>(
    await backendGet<unknown>(
      `/api/v1/organizations/${orgId}/billing/invoices`,
      { revalidate: 0 }
    )
  );
}

export async function billingInvoice(
  orgId: string,
  invoiceId: string
): Promise<BillingInvoice | null> {
  return backendGet<BillingInvoice>(
    `/api/v1/organizations/${orgId}/billing/invoices/${invoiceId}`,
    { revalidate: 0 }
  );
}

export async function billingPaymentMethods(
  orgId: string
): Promise<{ items: BillingPaymentMethod[]; provider_configured: boolean } | null> {
  return backendGet<{
    items: BillingPaymentMethod[];
    provider_configured: boolean;
  }>(`/api/v1/organizations/${orgId}/billing/payment-methods`, {
    revalidate: 0,
  });
}

export async function billingSettings(
  orgId: string
): Promise<BillingSettings | null> {
  return backendGet<BillingSettings>(
    `/api/v1/organizations/${orgId}/billing/settings`,
    { revalidate: 0 }
  );
}
