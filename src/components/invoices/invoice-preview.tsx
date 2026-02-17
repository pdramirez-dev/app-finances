import { format } from "date-fns";
import { Fragment } from "react";

import { companyProfile } from "@/lib/company";
import type { InvoiceRecord, InvoiceSectionRecord } from "@/lib/invoice-types";
import { formatMoney, formatMoneyParts } from "@/lib/invoices";

type InvoicePreviewVariant = "default" | "template361";

type InvoicePreviewProps = {
  invoice: InvoiceRecord;
  variant?: InvoicePreviewVariant;
};

function formatQuantity(quantity: number) {
  if (Number.isInteger(quantity)) {
    return String(quantity);
  }

  return quantity.toFixed(2).replace(/\.?0+$/, "");
}

function getSectionTotalLabel(section: InvoiceSectionRecord) {
  if (section.total < 0 || section.title.toLowerCase().includes("refund")) {
    return "Total Refund:";
  }

  return "Total Pay:";
}

function MoneyValue({
  amount,
  currency,
  underline = false,
}: {
  amount: number;
  currency: string;
  underline?: boolean;
}) {
  const { symbol, value } = formatMoneyParts(amount, currency);

  return (
    <span
      className={`inline-flex min-w-[88px] items-baseline justify-end gap-2 tabular-nums ${
        underline ? "border-t border-black pt-px" : ""
      }`}
    >
      <span className="w-2 text-right">{symbol}</span>
      <span className="min-w-16 text-right">{value}</span>
    </span>
  );
}

function DefaultInvoicePreview({ invoice }: { invoice: InvoiceRecord }) {
  const sections = [...invoice.sections].sort((a, b) => a.position - b.position);

  return (
    <article className="mx-auto w-full max-w-4xl rounded-xl border border-white/40 bg-white p-6 text-sm text-slate-900 shadow-lg shadow-slate-950/10 md:p-10">
      <header className="grid gap-8 border-b pb-8 md:grid-cols-2">
        <div className="space-y-2">
          <p className="text-xs tracking-[0.3em] text-muted-foreground">INVOICE</p>
          <h1 className="text-2xl font-bold tracking-tight">{companyProfile.legalName}</h1>
          <p>{companyProfile.country}</p>
          <p>Account Number: {companyProfile.accountNumber}</p>
          <p>Route Number ACH and Direct Deposit: {companyProfile.routeAch}</p>
          <p>Route Number Wire Transfers: {companyProfile.routeWire}</p>
        </div>

        <div className="space-y-4 text-left md:text-right">
          <div>
            <p className="font-semibold">Invoice Number: {invoice.invoiceNumber}</p>
            <p>Date: {format(invoice.date, "MM/dd/yyyy")}</p>
            <p>Week Number: {invoice.weekNumber}</p>
            <p>Project: {invoice.project}</p>
          </div>
          <div>
            <p className="font-semibold">BILL TO</p>
            <p>{invoice.billToName}</p>
            <p className="whitespace-pre-line text-muted-foreground">{invoice.billToAddress}</p>
          </div>
        </div>
      </header>

      <section className="mt-6 space-y-8">
        {sections.map((section) => {
          const lineItems = [...section.lineItems].sort((a, b) => a.position - b.position);

          return (
            <div key={section.sectionId} className="space-y-3">
              <h2 className="text-base font-semibold">{section.title}</h2>
              <div className="overflow-hidden rounded-lg border">
                <table className="w-full border-collapse">
                  <thead className="bg-muted/60 text-xs uppercase tracking-wide">
                    <tr>
                      <th className="px-3 py-2 text-left">Description</th>
                      <th className="px-3 py-2 text-right">QTY</th>
                      <th className="px-3 py-2 text-right">Amount</th>
                      <th className="px-3 py-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineItems.map((item) => (
                      <tr key={item.lineItemId} className="border-t">
                        <td className="px-3 py-2">{item.description}</td>
                        <td className="px-3 py-2 text-right">{item.quantity}</td>
                        <td className="px-3 py-2 text-right">{formatMoney(item.amount, invoice.currency)}</td>
                        <td className="px-3 py-2 text-right">
                          {formatMoney(item.quantity * item.amount, invoice.currency)}
                        </td>
                      </tr>
                    ))}
                    <tr className="border-t bg-muted/30 font-semibold">
                      <td className="px-3 py-2" colSpan={3}>
                        Total Pay
                      </td>
                      <td className="px-3 py-2 text-right">{formatMoney(section.total, invoice.currency)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </section>

      <footer className="mt-8 border-t pt-6">
        {invoice.notes ? (
          <div className="mb-4">
            <p className="font-semibold">Notes</p>
            <p className="whitespace-pre-line text-muted-foreground">{invoice.notes}</p>
          </div>
        ) : null}

        <p className="text-right text-2xl font-bold">
          Grand Total: {formatMoney(invoice.grandTotal, invoice.currency)}
        </p>
      </footer>
    </article>
  );
}

function Template361InvoicePreview({ invoice }: { invoice: InvoiceRecord }) {
  const sections = [...invoice.sections].sort((a, b) => a.position - b.position);

  return (
    <article className="mx-auto w-full max-w-[8.5in] bg-white px-5 pb-16 pt-12 text-[12px] leading-tight text-black shadow-sm print:max-w-none print:shadow-none">
      <header className="mb-4 grid grid-cols-[1fr_auto] gap-4 font-[Times_New_Roman,Times,serif]">
        <div className="pt-[88px]">
          <p className="text-[12px] font-bold leading-none tracking-tight">BILL TO</p>
          <p className="mt-3 text-[11px] font-semibold leading-[1.1]">{invoice.billToName}</p>
          <p className="whitespace-pre-line text-[11px] leading-[1.1]">{invoice.billToAddress}</p>
        </div>

        <div className="text-right">
          <p className="text-[17px] font-bold">INVOICE</p>
          <p className="mt-1 text-[14px] font-bold">{companyProfile.legalName}</p>
          <p className="text-[11px]">{companyProfile.country}</p>

          <div className="mt-2 space-y-1 text-[11px] leading-none">
            <p>
              <span className="font-bold text-[#d10000]">Account Number:</span>{" "}
              <span className="font-bold text-[#123f73]">{companyProfile.accountNumber}</span>
            </p>
            <p>
              <span className="font-bold text-[#d10000]">Route Number ACH and Direct Deposit:</span>{" "}
              <span className="font-bold text-[#123f73]">{companyProfile.routeAch}</span>
            </p>
            <p>
              <span className="font-bold text-[#d10000]">Route Number Wire Transfers:</span>{" "}
              <span className="font-bold text-[#123f73]">{companyProfile.routeWire}</span>
            </p>
          </div>

          <div className="mt-4 space-y-[2px] text-[11px] font-bold leading-none">
            <p>Invoice Number: {invoice.invoiceNumber}</p>
            <p>Date:{format(invoice.date, "MM/dd/yyyy")}</p>
            <p>Week Number: {invoice.weekNumber}</p>
          </div>
        </div>
      </header>

      <table className="w-full border-collapse font-[Times_New_Roman,Times,serif] text-[12px]">
        <thead>
          <tr className="bg-[#123a63] text-[11px] font-semibold text-white">
            <th className="px-2 py-[6px] text-left">Project</th>
            <th className="px-2 py-[6px] text-left">Description</th>
            <th className="px-2 py-[6px] text-right">QTY</th>
            <th className="px-2 py-[6px] text-right">Amount</th>
            <th className="px-2 py-[6px] text-right">Total Sub Pay</th>
          </tr>
        </thead>
        <tbody>
          {sections.map((section) => {
            const lineItems = [...section.lineItems].sort((a, b) => a.position - b.position);

            return (
              <Fragment key={section.sectionId}>
                {lineItems.map((item, itemIndex) => (
                  <tr key={item.lineItemId} className="align-top">
                    <td className="w-[36%] px-1 py-px">{itemIndex === 0 ? section.title : ""}</td>
                    <td className="w-[24%] px-1 py-px">{item.description}</td>
                    <td className="w-[8%] px-1 py-px text-right tabular-nums">{formatQuantity(item.quantity)}</td>
                    <td className="w-[16%] px-1 py-px text-right">
                      <MoneyValue amount={item.amount} currency={invoice.currency} />
                    </td>
                    <td className="w-[16%] px-1 py-px text-right">
                      <MoneyValue amount={item.quantity * item.amount} currency={invoice.currency} />
                    </td>
                  </tr>
                ))}
                <tr className="font-bold">
                  <td className="px-1 py-px" colSpan={3} />
                  <td className="px-1 py-px text-right">
                    <span className="inline-block border-t border-black pt-px">{getSectionTotalLabel(section)}</span>
                  </td>
                  <td className="px-1 py-px text-right">
                    <MoneyValue amount={section.total} currency={invoice.currency} underline />
                  </td>
                </tr>
                <tr>
                  <td className="h-[8px]" colSpan={5} />
                </tr>
              </Fragment>
            );
          })}
        </tbody>
      </table>

      {invoice.notes ? (
        <section className="mt-3 font-[Times_New_Roman,Times,serif] text-[11px]">
          <p className="font-semibold">Notes</p>
          <p className="whitespace-pre-line">{invoice.notes}</p>
        </section>
      ) : null}

      <footer className="mt-6 flex justify-end font-[Times_New_Roman,Times,serif]">
        <div className="flex items-center gap-4 text-[14px] font-bold">
          <span>Gran Total:</span>
          <MoneyValue amount={invoice.grandTotal} currency={invoice.currency} />
        </div>
      </footer>
    </article>
  );
}

export function InvoicePreview({ invoice, variant = "default" }: InvoicePreviewProps) {
  if (variant === "template361") {
    return <Template361InvoicePreview invoice={invoice} />;
  }

  return <DefaultInvoicePreview invoice={invoice} />;
}
