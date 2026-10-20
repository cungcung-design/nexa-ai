"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BillingErrorState } from "@/components/billing/shared";
import type { BillingSettings } from "@/lib/api";

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

const FIELD_CLASS =
  "w-full h-[38px] px-3 border border-[#dedede] rounded-[11px] bg-white text-[13px] text-[#171717] outline-none focus:border-[#8b5cf6] focus:ring-2 focus:ring-[#8b5cf6]/20 disabled:bg-[#fafafa] disabled:text-[#777]";

export function BillingSettingsForm({
  organizationId,
  settings,
  canManage,
}: {
  organizationId: string;
  settings: BillingSettings | null;
  canManage: boolean;
}) {
  const router = useRouter();
  const [companyName, setCompanyName] = useState(settings?.company_name ?? "");
  const [billingEmail, setBillingEmail] = useState(
    settings?.billing_email ?? ""
  );
  const [address, setAddress] = useState(settings?.address ?? "");
  const [taxId, setTaxId] = useState(settings?.tax_id ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(
        `/api/workspace/${organizationId}/billing/settings`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            company_name: companyName,
            billing_email: billingEmail || null,
            address: address || null,
            tax_id: taxId || null,
          }),
        }
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setError(
          readError(payload, "The billing information could not be saved.")
        );
        return;
      }
      setNotice("The billing information was saved.");
      router.refresh();
    } catch {
      setError("The billing service could not be reached.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save}>
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
          Only workspace owners can change the billing information.
        </p>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <label
            htmlFor="billing-company-name"
            className="block mb-1.5 text-[12px] font-medium text-[#171717]"
          >
            Company name
          </label>
          <input
            id="billing-company-name"
            name="company_name"
            value={companyName}
            onChange={(event) => setCompanyName(event.target.value)}
            disabled={!canManage}
            placeholder="Acme Inc."
            className={FIELD_CLASS}
          />
        </div>
        <div>
          <label
            htmlFor="billing-email"
            className="block mb-1.5 text-[12px] font-medium text-[#171717]"
          >
            Billing email
          </label>
          <input
            id="billing-email"
            name="billing_email"
            type="email"
            value={billingEmail}
            onChange={(event) => setBillingEmail(event.target.value)}
            disabled={!canManage}
            placeholder="billing@company.com"
            className={FIELD_CLASS}
          />
        </div>
        <div className="md:col-span-2">
          <label
            htmlFor="billing-address"
            className="block mb-1.5 text-[12px] font-medium text-[#171717]"
          >
            Address
          </label>
          <input
            id="billing-address"
            name="address"
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            disabled={!canManage}
            placeholder="Street, city, country"
            className={FIELD_CLASS}
          />
        </div>
        <div>
          <label
            htmlFor="billing-tax-id"
            className="block mb-1.5 text-[12px] font-medium text-[#171717]"
          >
            Tax ID
          </label>
          <input
            id="billing-tax-id"
            name="tax_id"
            value={taxId}
            onChange={(event) => setTaxId(event.target.value)}
            disabled={!canManage}
            placeholder="VAT or tax number"
            className={FIELD_CLASS}
          />
        </div>
      </div>

      <div className="flex items-center justify-end">
        <button
          type="submit"
          disabled={!canManage || busy}
          className="h-[36px] px-4 border-0 rounded-full bg-[#171717] text-white font-sans text-[13px] font-medium cursor-pointer hover:bg-black transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {busy ? "Saving..." : "Save billing information"}
        </button>
      </div>
    </form>
  );
}
