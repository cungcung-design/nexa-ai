import Link from "next/link";
import { DownloadIcon } from "@/components/billing/icons";
import {
  BillingCard,
  BillingEmptyState,
  BillingFooterNote,
  StatusPill,
} from "@/components/billing/shared";
import { formatMoney } from "@/components/billing/format";
import { billingInvoices } from "@/lib/api";
import { authorizedOrganization } from "@/lib/workspace";

export default async function BillingInvoicesPage({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;
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

  const invoices = await billingInvoices(org.id);
  const base = `/dashboard/organizations/${organizationId}/billing`;
  const downloadable = invoices.find((invoice) => invoice.invoice_pdf);

  return (
    <BillingCard>
      <div className="flex items-center justify-between gap-4 mb-5">
        <h1 className="m-0 text-[16px] font-semibold leading-[22px]">
          Invoices
        </h1>
        {downloadable?.invoice_pdf ? (
          <a
            href={downloadable.invoice_pdf}
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
            title={
              invoices.length
                ? "No downloadable invoice file is available yet"
                : "There is no invoice to download"
            }
            className="inline-flex items-center justify-center gap-1.5 h-[32px] px-3.5 border border-[#dedede] rounded-full bg-white text-[#666] font-sans text-[13px] font-medium cursor-not-allowed opacity-60 shrink-0"
          >
            <DownloadIcon />
            Download
          </button>
        )}
      </div>

      <div className="overflow-x-auto mb-6">
        {invoices.length === 0 ? (
          <BillingEmptyState
            title="No invoices yet"
            description="Invoices appear here as soon as the workspace is billed."
          />
        ) : (
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-[#dedede]">
                <th className="py-2.5 pr-4 text-left font-medium text-[#666]">
                  Invoice
                </th>
                <th className="py-2.5 px-4 text-left font-medium text-[#666]">
                  Amount
                </th>
                <th className="py-2.5 pl-4 text-right font-medium text-[#666]">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f2f2f2]">
              {invoices.map((invoice) => (
                <tr key={invoice.id}>
                  <td className="py-3.5 pr-4 font-medium text-[#171717]">
                    <Link
                      href={`${base}/invoices/${invoice.id}`}
                      className="hover:underline"
                    >
                      {invoice.number}
                    </Link>
                  </td>
                  <td className="py-3.5 px-4 text-[#171717]">
                    {formatMoney(invoice.amount_due, invoice.currency)}
                  </td>
                  <td className="py-3.5 pl-4 text-right">
                    <StatusPill
                      status={invoice.status}
                      className="inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-medium"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <BillingFooterNote>
        Invoices belong to this workspace and are recorded by the payment
        provider. Downloads are only available once the provider issued the
        invoice file.
      </BillingFooterNote>
    </BillingCard>
  );
}
