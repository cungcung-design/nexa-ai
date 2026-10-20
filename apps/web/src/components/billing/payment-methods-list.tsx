"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CreditCardIcon, PlusIcon } from "@/components/billing/icons";
import {
  BillingEmptyState,
  BillingErrorState,
  BillingNote,
} from "@/components/billing/shared";
import type { BillingPaymentMethod } from "@/lib/api";

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

function isProviderHost(hostname: string) {
  return hostname === "stripe.com" || hostname.endsWith(".stripe.com");
}

export function PaymentMethodsList({
  organizationId,
  methods,
  canManage,
  providerConfigured,
}: {
  organizationId: string;
  methods: BillingPaymentMethod[];
  canManage: boolean;
  providerConfigured: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  async function openPortal() {
    setBusy("portal");
    setError("");
    setNotice("");
    try {
      const response = await fetch(
        `/api/workspace/${organizationId}/billing/payment-methods/portal`,
        { method: "POST" }
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setError(
          readError(
            payload,
            "The payment provider could not open the card form."
          )
        );
        return;
      }
      const url =
        payload && typeof payload === "object"
          ? (payload as { url?: unknown }).url
          : undefined;
      if (typeof url !== "string") {
        setError("The payment provider did not return a session.");
        return;
      }
      let parsed: URL;
      try {
        parsed = new URL(url);
      } catch {
        setError("The payment provider returned an invalid session link.");
        return;
      }
      if (parsed.protocol !== "https:" || !isProviderHost(parsed.hostname)) {
        setError("The payment provider returned an unexpected destination.");
        return;
      }
      window.location.assign(parsed.href);
    } catch {
      setError("The payment provider could not be reached.");
    } finally {
      setBusy("");
    }
  }

  async function remove(id: string) {
    setBusy(id);
    setError("");
    setNotice("");
    try {
      const response = await fetch(
        `/api/workspace/${organizationId}/billing/payment-methods/${id}`,
        { method: "DELETE" }
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setError(
          readError(payload, "The payment method could not be removed.")
        );
        return;
      }
      setNotice("The payment method was removed.");
      setConfirmRemove(null);
      router.refresh();
    } catch {
      setError("The billing service could not be reached.");
    } finally {
      setBusy("");
    }
  }

  async function setDefault(id: string) {
    setBusy(id);
    setError("");
    setNotice("");
    try {
      const response = await fetch(
        `/api/workspace/${organizationId}/billing/payment-methods/${id}/default`,
        { method: "POST" }
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setError(
          readError(payload, "The default payment method could not be changed.")
        );
        return;
      }
      setNotice("The default payment method was updated.");
      router.refresh();
    } catch {
      setError("The billing service could not be reached.");
    } finally {
      setBusy("");
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-4 mb-5">
        <h1 className="m-0 text-[16px] font-semibold leading-[22px]">
          Payment Methods
        </h1>
        <button
          type="button"
          onClick={openPortal}
          disabled={!canManage || !providerConfigured || busy === "portal"}
          title={
            !providerConfigured
              ? "The payment provider is not connected to this deployment"
              : !canManage
                ? "Only workspace owners can change payment methods"
                : undefined
          }
          className="inline-flex items-center justify-center gap-1.5 h-[32px] px-3.5 border border-[#dedede] rounded-full bg-white text-[#666] font-sans text-[13px] font-medium cursor-pointer hover:bg-gray-50 transition-colors shrink-0 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <PlusIcon />
          Add Method
        </button>
      </div>

      {error ? (
        <div className="mb-3">
          <BillingErrorState message={error} />
        </div>
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
          Only workspace owners can change the payment methods. You can review
          the cards that are stored for this workspace.
        </p>
      ) : null}

      {methods.length === 0 ? (
        <BillingEmptyState
          title="No payment methods"
          description={
            providerConfigured
              ? "Add a card to be able to pay for this workspace."
              : "The payment provider is not connected to this deployment, so no card can be stored yet."
          }
        />
      ) : (
        methods.map((method) => (
          <div
            key={method.id}
            className="p-4 border border-[#dedede] rounded-[11px] bg-white mb-4 last:mb-0"
          >
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-[#f1f5ff] text-[#6366ff] flex items-center justify-center shrink-0">
                  <CreditCardIcon />
                </div>
                <div className="min-w-0">
                  <h2 className="m-0 text-[13px] font-semibold leading-[18px]">
                    {method.brand === "card"
                      ? "Card"
                      : method.brand.charAt(0).toUpperCase() +
                        method.brand.slice(1)}{" "}
                    ending in {method.last4 || "----"}
                  </h2>
                  <p className="m-0 text-[11px] text-[#666]">
                    {method.exp_month && method.exp_year
                      ? `Expires ${String(method.exp_month).padStart(2, "0")}/${method.exp_year}`
                      : "Expiry date not provided"}
                  </p>
                </div>
              </div>
              {method.is_default ? (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#e0f2df] text-[#28a745] shrink-0">
                  Default
                </span>
              ) : null}
            </div>

            <hr className="border-0 border-t border-[#dedede] mb-4" />

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setConfirmRemove(confirmRemove === method.id ? null : method.id);
                  setError("");
                }}
                disabled={!canManage || busy === method.id}
                className="h-[32px] px-3.5 border border-[#dedede] rounded-full text-[#666] bg-transparent font-medium text-[12px] cursor-pointer hover:bg-gray-50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                Remove
              </button>
              <button
                type="button"
                onClick={() => setDefault(method.id)}
                disabled={!canManage || method.is_default || busy === method.id}
                className="h-[32px] px-3.5 border border-[#dedede] rounded-full text-[#666] bg-transparent font-medium text-[12px] cursor-pointer hover:bg-gray-50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {method.is_default ? "Default" : "Make default"}
              </button>
              <button
                type="button"
                onClick={openPortal}
                disabled={!canManage || !providerConfigured || busy === "portal"}
                className="h-[32px] px-3.5 border border-[#dedede] rounded-full text-[#666] bg-transparent font-medium text-[12px] cursor-pointer hover:bg-gray-50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                Update
              </button>
            </div>

            {confirmRemove === method.id ? (
              <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
                <span className="text-[12px] text-[#b42318]">
                  Remove this card from the workspace?
                </span>
                <button
                  type="button"
                  onClick={() => setConfirmRemove(null)}
                  disabled={busy === method.id}
                  className="h-[32px] px-3.5 border border-[#dedede] rounded-full text-[#666] bg-transparent font-medium text-[12px] cursor-pointer hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => remove(method.id)}
                  disabled={busy === method.id}
                  className="h-[32px] px-3.5 border border-[#f3c9c9] rounded-full bg-transparent text-[#b42318] font-medium text-[12px] cursor-pointer hover:bg-[#fff4f4] transition-colors disabled:opacity-60"
                >
                  {busy === method.id ? "Removing..." : "Confirm removal"}
                </button>
              </div>
            ) : null}
          </div>
        ))
      )}

      {methods.length > 0 ? (
        <BillingNote className="m-0 mt-3 text-[12px] leading-[17px] text-[#666]">
          Card details are collected by the payment provider. This workspace
          only stores the provider token and the masked card details.
        </BillingNote>
      ) : null}
    </div>
  );
}
