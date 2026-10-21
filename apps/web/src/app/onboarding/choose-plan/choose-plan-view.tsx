"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { useOnboardingState } from "@/hooks/use-onboarding-state";
import {
  errorMessage,
  type PlanList,
  type PlanOption,
} from "@/lib/onboarding";

/**
 * The plan selection of the onboarding.
 *
 * The plans, the prices, and the currency come from the backend. The free
 * plan is confirmed right away, a paid plan opens the checkout of the
 * provider, and the enterprise plan is handled by the sales team.
 */
export function ChoosePlanView({ checkout }: { checkout: string | null }) {
  const router = useRouter();
  const { state, error, loading, reload } = useOnboardingState(
    "/onboarding/choose-plan"
  );
  const [catalog, setCatalog] = useState<PlanList | null>(null);
  const [selected, setSelected] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("");

  // A canceled checkout is reported by the billing provider.
  const notice =
    message ||
    (checkout === "canceled"
      ? "The checkout was canceled. Your plan was not changed."
      : "");

  useEffect(() => {
    if (!state) return;
    let cancelled = false;
    (async () => {
      const response = await fetch("/api/onboarding/plans", {
        cache: "no-store",
      });
      if (!response.ok) return;
      const data = (await response.json()) as PlanList;
      if (cancelled) return;
      setCatalog(data);
      const popular = data.plans.find((plan) => plan.popular);
      setSelected(
        state.plan ||
          data.plans.find((plan) => plan.current)?.key ||
          popular?.key ||
          data.plans[0]?.key ||
          ""
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [state]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !state?.workspace) return;
    setBusy(true);
    setMessage("");
    setStatus("Confirming the plan...");
    try {
      const response = await fetch("/api/onboarding/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspace_id: state.workspace.id,
          plan: selected,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setStatus("");
        setMessage(errorMessage(data, "The plan could not be activated."));
        return;
      }
      if (data.checkout_url) {
        window.location.assign(data.checkout_url);
        return;
      }
      setStatus(data.message || "The plan is active.");
      router.push("/onboarding/first-agent");
    } catch {
      setStatus("");
      setMessage("Network error. Please retry.");
    } finally {
      setBusy(false);
    }
  }

  if (loading || (!state && !error)) {
    return (
      <main className="nx-ob-page">
        <p className="nx-ob-status">Loading the plans...</p>
      </main>
    );
  }

  if (!state) {
    return (
      <main className="nx-ob-page">
        <div className="nx-ob-card nx-ob-center-status">
          <p className="nx-ob-status nx-ob-status-error">{error}</p>
          <button
            className="nx-ob-continue"
            type="button"
            onClick={() => void reload()}
          >
            Try again
          </button>
        </div>
      </main>
    );
  }

  if (!catalog) {
    return (
      <main className="nx-ob-page">
        <p className="nx-ob-status">Loading the plans...</p>
      </main>
    );
  }

  return (
    <main className="nx-ob-page">
      <div className="nx-ob-card nx-ob-plan-card">
        <h1 className="nx-ob-plan-title" id="plan-heading">
          Choose your plan
        </h1>
        <p className="nx-ob-plan-description">You can change this later.</p>

        <form onSubmit={submit}>
          <fieldset className="nx-ob-plans" aria-labelledby="plan-heading">
            {catalog.plans.map((plan: PlanOption) => (
              <label key={plan.key} className="nx-ob-plan">
                {plan.popular ? <span className="nx-ob-badge">Popular</span> : null}
                <span className="nx-ob-plan-name">{plan.label}</span>
                <span
                  className={`nx-ob-price${
                    plan.contact_sales ? " nx-ob-price-custom" : ""
                  }`}
                >
                  {plan.contact_sales ? "Custom" : plan.price}
                </span>
                <span className="nx-ob-plan-radio">
                  <input
                    type="radio"
                    name="plan"
                    value={plan.key}
                    aria-label={`${plan.label}, ${plan.contact_sales ? "custom pricing" : plan.price}`}
                    checked={selected === plan.key}
                    onChange={() => setSelected(plan.key)}
                    required
                  />
                  <span className="nx-ob-plan-radio-mark" />
                </span>
              </label>
            ))}
          </fieldset>

          <button
            className="nx-ob-continue nx-ob-plan-continue"
            type="submit"
            disabled={busy || !selected}
          >
            Continue
          </button>

          <p
            className={`nx-ob-status${notice ? " nx-ob-status-error" : ""}`}
            role={notice ? "alert" : "status"}
          >
            {notice || status}
          </p>
        </form>
      </div>
    </main>
  );
}
