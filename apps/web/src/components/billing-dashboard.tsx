"use client";

import { useState } from "react";
import {
  ArrowUpRight,
  Check,
  CreditCard,
  LockKeyhole,
  ShieldAlert,
} from "lucide-react";

export type BillingPlan = {
  plan: string;
  status: string;
  limits: {
    agents: number;
    monthly_requests: number;
    knowledge_bases: number;
  };
};

type Tier = "FREE" | "PRO" | "BUSINESS";

// Display-only tier overview. The current plan, status, and limits always
// come from the live /billing/plan endpoint.
const tiers: {
  plan: Tier;
  price: number;
  agents: number;
  requests: number;
  knowledge: number;
}[] = [
  { plan: "FREE", price: 0, agents: 2, requests: 100, knowledge: 1 },
  { plan: "PRO", price: 29, agents: 10, requests: 5000, knowledge: 20 },
  { plan: "BUSINESS", price: 99, agents: 50, requests: 25000, knowledge: 100 },
];

function message(value: unknown): string {
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (typeof obj.detail === "string") return obj.detail;
    if (typeof obj.error === "string") return obj.error;
  }
  return "Billing request failed";
}

export function BillingDashboard({
  orgId,
  plan,
  canManage,
}: {
  orgId: string;
  plan: BillingPlan | null;
  canManage: boolean;
}) {
  const [busy, setBusy] = useState<Tier | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const effective = (plan?.plan ?? "FREE").toUpperCase();

  async function checkout(tier: Tier) {
    if (tier === "FREE" || !canManage) return;
    setBusy(tier);
    setError("");
    setNotice("");
    try {
      const response = await fetch(
        `/api/workspace/${encodeURIComponent(orgId)}/billing/checkout`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plan: tier }),
        }
      );
      const payload: unknown = await response.json();
      if (!response.ok) throw new Error(message(payload));
      if (
        !payload ||
        typeof payload !== "object" ||
        !("checkout_url" in payload)
      )
        throw new Error("Missing checkout URL");
      const url = (payload as { checkout_url: unknown }).checkout_url;
      if (typeof url !== "string") throw new Error("Invalid checkout URL");
      const parsed = new URL(url);
      if (
        parsed.protocol !== "https:" ||
        !(
          parsed.hostname === "checkout.stripe.com" ||
          parsed.hostname.endsWith(".checkout.stripe.com")
        )
      )
        throw new Error("Unexpected checkout destination");
      setNotice(
        "Opening Stripe test checkout. Paid access will not activate until webhook synchronization is implemented."
      );
      window.location.assign(parsed.href);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Checkout failed");
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200"
        >
          {error}
        </div>
      )}
      {notice && (
        <div
          role="status"
          className="rounded-xl border border-violet-500/30 bg-violet-500/10 p-4 text-sm text-violet-200"
        >
          {notice}
        </div>
      )}
      <div className="flex items-start gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/5 p-4 text-sm text-amber-100">
        <ShieldAlert className="mt-0.5 size-5 shrink-0" />
        <div>
          <p className="font-semibold">Stripe test-mode integration only</p>
          <p className="mt-1 text-amber-100/75">
            The webhook currently verifies events but does not synchronize
            subscriptions. Do not enable real charges or assume a successful
            checkout upgrades an organization.
          </p>
        </div>
      </div>

      <section className="rounded-2xl border border-white/10 bg-[#14131e] p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-violet-300">
              Subscription
            </p>
            <h2 className="mt-2 text-2xl font-bold">
              {plan ? effective : "Unavailable"} plan
            </h2>
            <p className="mt-2 text-sm text-zinc-400">
              {plan
                ? `Status: ${plan.status}. Live plan and limits reported by FastAPI.`
                : "Unable to retrieve subscription information. No plan has been assumed."}
            </p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full border border-violet-500/20 bg-violet-500/10 px-3 py-2 text-xs text-violet-200">
            <CreditCard className="size-4" /> Organization billing
          </span>
        </div>
        {plan && (
          <dl className="mt-6 grid gap-4 border-t border-white/10 pt-6 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-zinc-500">Agent limit</dt>
              <dd className="mt-1 font-semibold">{plan.limits.agents}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Monthly requests</dt>
              <dd className="mt-1 font-semibold">
                {plan.limits.monthly_requests.toLocaleString()}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500">Knowledge bases</dt>
              <dd className="mt-1 font-semibold">
                {plan.limits.knowledge_bases}
              </dd>
            </div>
          </dl>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        {tiers.map((t) => (
          <section
            key={t.plan}
            className={`flex flex-col rounded-2xl border p-5 sm:p-6 ${
              effective === t.plan && plan
                ? "border-violet-400/70 bg-violet-500/10"
                : "border-white/10 bg-[#14131e]"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-lg font-semibold">
                {t.plan === "FREE"
                  ? "Free"
                  : t.plan === "PRO"
                    ? "Pro"
                    : "Business"}
              </h3>
              {plan && effective === t.plan && (
                <span className="rounded-full bg-violet-500/20 px-3 py-1 text-xs text-violet-200">
                  Current
                </span>
              )}
            </div>
            <p className="mt-4">
              <span className="text-4xl font-bold">${t.price}</span>
              <span className="text-sm text-zinc-400"> / month</span>
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              Proposed development pricing
            </p>
            <div className="my-6 h-px bg-white/10" />
            <ul className="mb-6 flex-1 space-y-3 text-sm text-zinc-300">
              <li className="flex items-center gap-2">
                <Check className="size-4 text-violet-300" />
                {t.agents} AI agents
              </li>
              <li className="flex items-center gap-2">
                <Check className="size-4 text-violet-300" />
                {t.requests.toLocaleString()} AI requests/month
              </li>
              <li className="flex items-center gap-2">
                <Check className="size-4 text-violet-300" />
                {t.knowledge} knowledge bases
              </li>
            </ul>
            {t.plan === "FREE" ? (
              <div className="rounded-xl border border-white/10 px-4 py-3 text-center text-sm text-zinc-400">
                Default free tier
              </div>
            ) : (
              <button
                type="button"
                disabled={
                  !canManage || busy !== null || effective === t.plan || !plan
                }
                onClick={() => checkout(t.plan)}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-500 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-zinc-500"
              >
                {busy === t.plan
                  ? "Opening checkout..."
                  : effective === t.plan
                    ? "Current plan"
                    : `Test ${t.plan.toLowerCase()} checkout`}
                <ArrowUpRight className="size-4" />
              </button>
            )}
          </section>
        ))}
      </div>

      <section className="rounded-2xl border border-white/10 bg-[#14131e] p-5 sm:p-7">
        <h2 className="text-lg font-semibold">Monthly usage</h2>
        <p className="mt-2 text-sm text-zinc-400">
          The backend does not yet provide a usage summary endpoint. We
          intentionally do not display fabricated counts or progress bars.
        </p>
        <div className="mt-4 flex items-start gap-3 rounded-xl border border-white/10 bg-[#0e0d16] p-4 text-sm text-zinc-400">
          <LockKeyhole className="size-5 shrink-0 text-violet-300" />
          Next backend integration: authenticated monthly usage endpoint
          returning requests, prompt tokens, completion tokens, and plan
          limits. Quota reservations must be concurrency-safe before
          production.
        </div>
      </section>

      {!canManage && (
        <p className="text-sm text-zinc-400">
          Only organization Owners can initiate subscription changes.
        </p>
      )}
    </div>
  );
}
