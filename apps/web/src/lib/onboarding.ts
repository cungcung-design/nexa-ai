export type OnboardingWorkspace = {
  id: string;
  name: string;
  slug: string;
  role: string;
};

export type OnboardingState = {
  email: string;
  email_verified: boolean;
  step: string;
  completed_steps: string[];
  workspace: OnboardingWorkspace | null;
  plan: string | null;
  agent_id: string | null;
  can_create_agent: boolean;
  workspaces: OnboardingWorkspace[];
};

export type PlanOption = {
  key: string;
  label: string;
  tagline: string;
  price: string;
  amount: number;
  currency: string;
  interval: string;
  popular: boolean;
  contact_sales: boolean;
  purchasable: boolean;
  current: boolean;
};

export type PlanList = {
  currency: string;
  plans: PlanOption[];
  provider_configured: boolean;
};

export type ApiError = { error?: string; detail?: string };

export type OnboardingComplete = {
  step: string;
  completed_steps: string[];
  workspace_id: string | null;
};

/**
 * The error message of a failed request.
 *
 * The backend answers with a `detail` field, the same origin proxy with an
 * `error` field. Both are shown to the user.
 */
export function errorMessage(payload: ApiError | null, fallback: string) {
  const message = payload?.error || payload?.detail;
  return message ? String(message) : fallback;
}

/**
 * Read the onboarding progress of the signed in user.
 */
export async function loadOnboardingState(): Promise<OnboardingState | null> {
  const response = await fetch("/api/onboarding/state", { cache: "no-store" });
  if (!response.ok) return null;
  return (await response.json()) as OnboardingState;
}

export type OnboardingStateResult =
  | { ok: true; state: OnboardingState }
  | { ok: false; status: number };

/**
 * Read the onboarding progress and keep the status of the request.
 *
 * A status of 401 means that the session is missing, every other status is a
 * temporary problem the page can offer to retry.
 */
export async function fetchOnboardingState(): Promise<OnboardingStateResult> {
  try {
    const response = await fetch("/api/onboarding/state", { cache: "no-store" });
    if (!response.ok) return { ok: false, status: response.status };
    return { ok: true, state: (await response.json()) as OnboardingState };
  } catch {
    return { ok: false, status: 0 };
  }
}

/**
 * The page the user continues on after signing in.
 *
 * A new account confirms the address first, an account that still runs
 * through the onboarding continues there, and a finished account goes to the
 * workspace.
 */
export async function resolveAfterAuth(next?: string): Promise<string> {
  const fallback = next && next.startsWith("/") ? next : "/dashboard";
  const result = await fetchOnboardingState();
  if (!result.ok) return fallback;
  const state = result.state;
  if (!state.email_verified) return "/verify-email";
  if (state.step === "complete") return fallback;
  // An account that already belongs to a workspace of an earlier session
  // keeps the previous behaviour and goes straight to the workspace.
  if (state.workspace === null && state.workspaces.length > 0) return fallback;
  return "/onboarding/welcome";
}

/**
 * Mark a step of the flow that only collects a choice as done.
 *
 * The backend rejects the steps that change data, those are marked by their
 * own endpoints.
 */
export async function completeStep(step: string) {
  const response = await fetch("/api/onboarding/step", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ step }),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(errorMessage(payload, "The step could not be saved."));
  }
  return (await response.json()) as OnboardingComplete;
}
