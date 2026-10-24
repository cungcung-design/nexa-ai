"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckIcon } from "@/components/billing/icons";
import { formatMoney } from "@/components/billing/format";
import type { BillingCatalogPlan, BillingPrice } from "@/lib/api";

type Interval = "monthly" | "yearly";

function priceOf(
  plan: BillingCatalogPlan,
  interval: Interval
): BillingPrice | null {
  return interval === "yearly" ? plan.yearly : plan.monthly;
}

/**
 * The yearly selection shows the monthly equivalent of the annual price, so
 * the amount stays comparable with the monthly selection.
 */
function displayAmount(price: BillingPrice | null): string {
  if (!price) return "Custom";
  const amount = price.interval === "yearly" ? price.monthly_equivalent : price.amount;
  return `$${(amount / 100).toFixed(amount % 100 === 0 ? 0 : 2)}`;
}

function readError(payload: unknown, fallback: string) {
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    if (typeof record.detail === "string" && record.detail.trim())
      return record.detail;
    if (typeof record.error === "string" && record.error.trim())
      return record.error;
  }
  return fallback;
}

export function PlansGrid({
  organizationId,
  plans,
  canManage,
  currentPlan,
  providerConfigured,
}: {
  organizationId: string;
  plans: BillingCatalogPlan[];
  canManage: boolean;
  currentPlan: string;
  providerConfigured: boolean;
}) {
  const router = useRouter();
  const [interval, setInterval] = useState<Interval>("monthly");
  const [pending, setPending] = useState<BillingCatalogPlan | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function confirm() {
    if (!pending) return;
    const plan = pending;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (plan.key === "FREE") {
        const response = await fetch(
          `/api/workspace/${organizationId}/billing/subscription/cancel`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ cancel_at_period_end: true }),
          }
        );
        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          setError(
            readError(payload, "The plan change could not be applied.")
          );
          return;
        }
        setNotice(
          "The downgrade is scheduled. The workspace keeps the current plan until the paid period ends."
        );
        setPending(null);
        router.refresh();
        return;
      }

      const response = await fetch(
        `/api/workspace/${organizationId}/billing/checkout`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plan: plan.key, interval }),
        }
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setError(
          readError(payload, "The checkout session could not be created.")
        );
        return;
      }
      const url =
        payload && typeof payload === "object"
          ? (payload as { checkout_url?: unknown }).checkout_url
          : undefined;
      if (typeof url !== "string") {
        setError("The checkout session did not return a payment link.");
        return;
      }
      let parsed: URL;
      try {
        parsed = new URL(url);
      } catch {
        setError("The checkout session returned an invalid payment link.");
        return;
      }
      if (
        parsed.protocol !== "https:" ||
        !(
          parsed.hostname === "checkout.stripe.com" ||
          parsed.hostname.endsWith(".checkout.stripe.com")
        )
      ) {
        setError("The checkout session returned an unexpected destination.");
        return;
      }
      setPending(null);
      window.location.assign(parsed.href);
    } catch {
      setError("The billing service could not be reached.");
    } finally {
      setBusy(false);
    }
  }

  const pendingPrice = pending ? priceOf(pending, interval) : null;

  return (
    <div>
      {error ? (
        <p
          role="alert"
          className="m-0 mb-3 p-3 border border-[#f3c9c9] rounded-[11px] bg-[#fff4f4] text-[12px] font-medium text-[#b42318]"
        >
          {error}
        </p>
      ) : null}
      {notice ? (
        <p
          role="status"
          className="m-0 mb-3 p-3 border border-[#cfe8cf] rounded-[11px] bg-[#f4fbf4] text-[12px] font-medium text-[#1f7a34]"
        >
          {notice}
        </p>
      ) : null}
      {!canManage ? (
        <p className="m-0 mb-3 text-[12px] text-[#777]">
          Only workspace owners can change the plan. You can review the plans
          and the current subscription.
        </p>
      ) : null}
      {!providerConfigured ? (
        <p className="m-0 mb-3 text-[12px] text-[#777]">
          The payment provider is not connected to this deployment, so paid
          plans cannot be purchased yet. The prices below are the catalog
          prices.
        </p>
      ) : null}

      <div className="flex items-center justify-center gap-1 p-1 mb-4 border border-[#dedede] rounded-full bg-white w-fit">
        {(["monthly", "yearly"] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setInterval(option)}
            aria-pressed={interval === option}
            className={`inline-flex items-center h-[30px] px-4 rounded-full text-[13px] font-medium transition-colors ${
              interval === option
                ? "bg-[#171717] text-white"
                : "text-[#666] hover:bg-[#f4f4f4] hover:text-[#171717]"
            }`}
          >
            {option === "monthly" ? "Monthly" : "Yearly"}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-[9px]">
        {plans.map((plan) => {
          const price = priceOf(plan, interval);
          const isCurrent = plan.key === currentPlan;
          const highlighted = plan.popular || isCurrent;
          const checkoutUnavailable =
            !providerConfigured && plan.key !== "FREE" && !plan.contact_sales;
          const selectable =
            !isCurrent && !plan.contact_sales && !checkoutUnavailable;

          return (
            <article
              key={plan.key}
              className={`plan flex flex-col min-h-[320px] ${
                highlighted
                  ? "p-[18px_14px_14px] border-2 border-[#7047ff]"
                  : "p-[19px_14px_15px] border border-[#dfdfdf]"
              } rounded-[21px] bg-white`}
            >
              <div className="flex items-center justify-between gap-3">
                <h2 className="m-0 text-[19px] font-semibold leading-[26px]">
                  {plan.label}
                </h2>
                {plan.popular ? (
                  <span className="popular px-2 py-1 rounded-full bg-[#e5ecff] text-[#6084ff] text-[14px] font-semibold leading-[16px] tracking-[0.3px]">
                    Popular
                  </span>
                ) : null}
                {isCurrent ? (
                  <span className="px-2 py-1 rounded-full bg-[#e0f2df] text-[#28a745] text-[14px] font-semibold leading-[16px] tracking-[0.3px]">
                    Current
                  </span>
                ) : null}
              </div>

              <p className="m-[7px_0_0] text-[14px] text-[#666] tracking-[0.1px]">
                {plan.tagline}
              </p>

              <div className="flex items-baseline mt-4 min-h-[32px]">
                <span className="amount text-[25px] font-medium leading-[32px]">
                  {displayAmount(price)}
                </span>
                {price ? (
                  <span className="unit text-[14px] font-semibold text-[#666]">
                    /mo
                  </span>
                ) : null}
              </div>

              {price && price.interval === "yearly" ? (
                <p className="m-[2px_0_0] text-[12px] text-[#777]">
                  {formatMoney(price.annual_total, price.currency)} billed
                  yearly
                </p>
              ) : null}

              <ul className="flex flex-col gap-5 m-[17px_0_25px] p-0 list-none">
                {plan.features.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-center gap-3 text-[14px] leading-[21px]"
                  >
                    <CheckIcon />
                    {feature}
                  </li>
                ))}
              </ul>

              {plan.contact_sales ? (
                <Link
                  href="/contact"
                  className="plan-button flex items-center justify-center w-full min-h-[43px] mt-auto p-[9px_12px] rounded-full border border-[#d5d5d5] bg-transparent text-[#666] font-semibold text-[16px]"
                >
                  Contact Sales
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setError("");
                    setNotice("");
                    setPending(plan);
                  }}
                  disabled={!selectable || !canManage || busy}
                  className={`plan-button flex items-center justify-center w-full min-h-[43px] mt-auto p-[9px_12px] rounded-full font-semibold text-[16px] ${
                    highlighted
                      ? "border border-[#101010] bg-[#101010] text-white cursor-pointer"
                      : "border border-[#d5d5d5] bg-transparent text-[#666]"
                  } ${
                    !selectable || !canManage
                      ? "opacity-60 cursor-not-allowed"
                      : "cursor-pointer"
                  }`}
                >
                  {isCurrent
                    ? "Current Plan"
                    : checkoutUnavailable
                      ? "Checkout unavailable"
                      : plan.key === "FREE"
                        ? "Downgrade"
                        : "Choose Plan"}
                </button>
              )}
            </article>
          );
        })}
      </div>

      {pending ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Confirm plan change"
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#171717]/20 p-4"
        >
          <div className="w-full max-w-[420px] p-[19px_16px_16px] border border-[#e0e0e0] rounded-[21px] bg-white shadow-lg">
            <h3 className="m-0 text-[17px] font-semibold leading-[24px]">
              {pending.key === "FREE"
                ? "Downgrade to Free"
                : `Switch to ${pending.label}`}
            </h3>
            <p className="m-[7px_0_0] text-[13px] leading-[19px] text-[#666]">
              {pending.key === "FREE"
                ? "The workspace keeps the current plan until the paid period ends. Resources above the Free limits are preserved."
                : "You will continue with a payment link to complete the change."}
            </p>

            <dl className="mt-4 m-[16px_0_0] p-3 border border-[#dedede] rounded-[11px] bg-[#fafafa] text-[13px]">
              <div className="flex items-center justify-between gap-3 py-1">
                <dt className="text-[#777]">Plan</dt>
                <dd className="m-0 font-medium text-[#171717]">
                  {pending.label}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3 py-1">
                <dt className="text-[#777]">Billing period</dt>
                <dd className="m-0 font-medium text-[#171717]">
                  {interval === "yearly" ? "Yearly" : "Monthly"}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3 py-1">
                <dt className="text-[#777]">Price</dt>
                <dd className="m-0 font-medium text-[#171717]">
                  {pendingPrice
                    ? formatMoney(pendingPrice.amount, pendingPrice.currency)
                    : "Custom"}
                  {pendingPrice && pendingPrice.interval === "yearly" ? (
                    <span className="text-[#777]">
                      {" "}
                      / year ({formatMoney(
                        pendingPrice.monthly_equivalent,
                        pendingPrice.currency
                      )}{" "}
                      per month)
                    </span>
                  ) : null}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3 py-1">
                <dt className="text-[#777]">Effective</dt>
                <dd className="m-0 font-medium text-[#171717]">
                  {pending.key === "FREE"
                    ? "End of the current period"
                    : "After the payment is confirmed"}
                </dd>
              </div>
            </dl>

            {error ? (
              <p className="m-[12px_0_0] text-[12px] font-medium text-[#b42318]">
                {error}
              </p>
            ) : null}

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setPending(null)}
                disabled={busy}
                className="h-[36px] px-4 border border-[#d5d5d5] rounded-full bg-transparent text-[#666] font-semibold text-[14px] cursor-pointer hover:bg-gray-50 transition-colors disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirm}
                disabled={busy}
                className="h-[36px] px-4 border-0 rounded-full bg-[#101010] text-white font-semibold text-[14px] cursor-pointer hover:bg-black transition-colors disabled:opacity-60"
              >
                {busy
                  ? "Working..."
                  : pending.key === "FREE"
                    ? "Schedule downgrade"
                    : "Continue to payment"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
