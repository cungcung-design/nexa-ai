"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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

export function SubscriptionActions({
  organizationId,
  canManage,
  providerConfigured,
  hasProviderSubscription,
  cancelAtPeriodEnd,
}: {
  organizationId: string;
  canManage: boolean;
  providerConfigured: boolean;
  hasProviderSubscription: boolean;
  cancelAtPeriodEnd: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [confirming, setConfirming] = useState(false);

  async function openPortal() {
    setBusy("portal");
    setError("");
    setNotice("");
    try {
      const response = await fetch(
        `/api/workspace/${organizationId}/billing/portal`,
        { method: "POST" }
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setError(
          readError(payload, "The billing portal could not be opened.")
        );
        return;
      }
      const url =
        payload && typeof payload === "object"
          ? (payload as { url?: unknown }).url
          : undefined;
      if (typeof url !== "string") {
        setError("The billing portal did not return a session.");
        return;
      }
      let parsed: URL;
      try {
        parsed = new URL(url);
      } catch {
        setError("The billing portal returned an invalid session link.");
        return;
      }
      if (parsed.protocol !== "https:" || !isProviderHost(parsed.hostname)) {
        setError("The billing portal returned an unexpected destination.");
        return;
      }
      window.location.assign(parsed.href);
    } catch {
      setError("The billing service could not be reached.");
    } finally {
      setBusy("");
    }
  }

  async function cancel() {
    setBusy("cancel");
    setError("");
    setNotice("");
    try {
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
          readError(payload, "The cancellation could not be scheduled.")
        );
        return;
      }
      setNotice(
        "The subscription is canceled at the end of the paid period. It stays active until then."
      );
      setConfirming(false);
      router.refresh();
    } catch {
      setError("The billing service could not be reached.");
    } finally {
      setBusy("");
    }
  }

  async function resume() {
    setBusy("resume");
    setError("");
    setNotice("");
    try {
      const response = await fetch(
        `/api/workspace/${organizationId}/billing/subscription/resume`,
        { method: "POST" }
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setError(readError(payload, "The subscription could not be resumed."));
        return;
      }
      setNotice("The scheduled cancellation was undone.");
      router.refresh();
    } catch {
      setError("The billing service could not be reached.");
    } finally {
      setBusy("");
    }
  }

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
          Only workspace owners can change the subscription.
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          onClick={openPortal}
          disabled={
            !canManage || !providerConfigured || !hasProviderSubscription
          }
          title={
            !providerConfigured
              ? "The payment provider is not connected to this deployment"
              : !hasProviderSubscription
                ? "This workspace has no provider billing account yet"
                : undefined
          }
          className="h-[32px] px-3.5 border border-[#dedede] rounded-full bg-white text-[#666] font-sans text-[13px] font-medium cursor-pointer hover:bg-gray-50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {busy === "portal" ? "Opening..." : "Manage in portal"}
        </button>

        {cancelAtPeriodEnd ? (
          <button
            type="button"
            onClick={resume}
            disabled={!canManage || busy === "resume"}
            className="h-[32px] px-3.5 border-0 rounded-full bg-[#171717] text-white font-sans text-[13px] font-medium cursor-pointer hover:bg-black transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {busy === "resume" ? "Resuming..." : "Resume subscription"}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              setConfirming(true);
              setError("");
            }}
            disabled={!canManage || busy === "cancel"}
            className="h-[32px] px-3.5 border border-[#f3c9c9] rounded-full bg-transparent text-[#b42318] font-sans text-[13px] font-medium cursor-pointer hover:bg-[#fff4f4] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            Cancel subscription
          </button>
        )}
      </div>

      {confirming ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Confirm subscription cancellation"
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#171717]/20 p-4"
        >
          <div className="w-full max-w-[420px] p-[19px_16px_16px] border border-[#e0e0e0] rounded-[21px] bg-white shadow-lg">
            <h3 className="m-0 text-[17px] font-semibold leading-[24px]">
              Cancel subscription
            </h3>
            <p className="m-[7px_0_0] text-[13px] leading-[19px] text-[#666]">
              The subscription stays active until the end of the paid period.
              The workspace then returns to the free plan. You can undo this
              until the period ends.
            </p>

            {error ? (
              <p className="m-[12px_0_0] text-[12px] font-medium text-[#b42318]">
                {error}
              </p>
            ) : null}

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirming(false)}
                disabled={busy === "cancel"}
                className="h-[36px] px-4 border border-[#d5d5d5] rounded-full bg-transparent text-[#666] font-semibold text-[14px] cursor-pointer hover:bg-gray-50 transition-colors disabled:opacity-60"
              >
                Keep subscription
              </button>
              <button
                type="button"
                onClick={cancel}
                disabled={busy === "cancel"}
                className="h-[36px] px-4 border-0 rounded-full bg-[#b42318] text-white font-semibold text-[14px] cursor-pointer hover:bg-[#9a1d13] transition-colors disabled:opacity-60"
              >
                {busy === "cancel" ? "Working..." : "Cancel at period end"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
