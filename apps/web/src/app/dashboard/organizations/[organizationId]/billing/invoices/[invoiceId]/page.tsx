import Link from "next/link";
import { DownloadIcon } from "@/components/billing/icons";
import {
  BillingCard,
  BillingEmptyState,
  BillingFooterNote,
  StatusPill,
} from "@/components/billing/shared";
import { formatMoney } from "@/components/billing/format";
import { formatLongDate } from "@/components/billing/dates";
import { billingInvoice } from "@/lib/api";
import { authorizedOrganization } from "@/lib/workspace";

export default async function BillingInvoiceDetailPage({
  params,
}: {
  params: Promise<{ organizationId: string; invoiceId: string }>;
}) {
  const { organizationId, invoiceId } = await params;
  const org = await authorizedOrganization(organizationId);

  if (!org) {
    return (
      <BillingCard>
        <p className="m-0 text-[13px] text-[#777]">
          Choose an organization to view its invoices.
        </p>
      </BillingCard>
    );
  }

  const invoice = await billingInvoice(org.id, invoiceId);
  const base = `/dashboard/organizations/${organizationId}/billing`;

  if (!invoice) {
    return (
      <BillingCard>
        <BillingEmptyState
          title="Invoice not found"
          description="This invoice does not belong to the current workspace."
          action={
            <Link
              href={`${base}/invoices`}
              className="text-[12px] font-medium text-[#6366f1] hover:underline"
            >
              Back to invoices
            </Link>
          }
        />
      </BillingCard>
    );
  }

  const rows: { label: string; value: React.ReactNode }[] = [
    {
      label: "Amount due",
      value: formatMoney(invoice.amount_due, invoice.currency),
    },
    {
      label: "Amount paid",
      value: formatMoney(invoice.amount_paid, invoice.currency),
    },
    {
      label: "Tax",
      value: formatMoney(invoice.tax_amount, invoice.currency),
    },
    {
      label: "Billing period",
      value: `${formatLongDate(invoice.period_start)} - ${formatLongDate(
        invoice.period_end
      )}`,
    },
    {
      label: "Issued",
      value: formatLongDate(invoice.created_at),
    },
  ];

  return (
    <BillingCard>
      <div className="flex items-center justify-between gap-4 mb-5">
        <div>
          <Link
            href={`${base}/invoices`}
            className="text-[12px] font-medium text-[#6366f1] hover:underline"
          >
            Back to invoices
          </Link>
          <h1 className="m-0 mt-1 text-[16px] font-semibold leading-[22px]">
            {invoice.number}
          </h1>
        </div>
        {invoice.invoice_pdf ? (
          <a
            href={invoice.invoice_pdf}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-1.5 h-[32px] px-3.5 border border-[#dedede] rounded-full bg-white text-[#666] font-sans text-[13px] font-medium cursor-pointer hover:bg-gray-50 transition-colors shrink-0"
          >
            <DownloadIcon />
            Download
          </a>
        ) : (
          <button
            type="button"
            disabled
            title="No downloadable invoice file is available yet"
            className="inline-flex items-center justify-center gap-1.5 h-[32px] px-3.5 border border-[#dedede] rounded-full bg-white text-[#666] font-sans text-[13px] font-medium cursor-not-allowed opacity-60 shrink-0"
          >
            <DownloadIcon />
            Download
          </button>
        )}
      </div>

      <div className="mb-5 flex items-center gap-2">
        <StatusPill
          status={invoice.status}
          className="inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-medium"
        />
        <span className="text-[12px] text-[#777]">
          {invoice.hosted_invoice_url
            ? "Hosted by the payment provider"
            : "Recorded by the payment provider"}
        </span>
      </div>

      <dl className="m-0 p-4 border border-[#dedede] rounded-[11px] bg-white">
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex items-center justify-between gap-4 py-1.5 border-b border-[#f2f2f2] last:border-b-0"
          >
            <dt className="text-[12px] text-[#777]">{row.label}</dt>
            <dd className="m-0 text-[13px] font-medium text-[#171717]">
              {row.value}
            </dd>
          </div>
        ))}
      </dl>

      <BillingFooterNote>
        This invoice is issued for {org.name}. Amounts are shown in the currency
        of the invoice.
      </BillingFooterNote>
    </BillingCard>
  );
}
