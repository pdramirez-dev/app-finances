import { Invoice, InvoiceLineItem, InvoiceSection } from "@prisma/client";
import { format } from "date-fns";

import { companyProfile } from "@/lib/company";
import { formatMoney } from "@/lib/invoices";

type InvoiceWithSections = Invoice & {
  sections: (InvoiceSection & {
    lineItems: InvoiceLineItem[];
  })[];
};

export function InvoicePreview({ invoice }: { invoice: InvoiceWithSections }) {
  const sections = [...invoice.sections].sort((a, b) => a.position - b.position);

  return (
    <article className="mx-auto w-full max-w-4xl rounded-xl border bg-card p-6 text-sm shadow-sm md:p-10">
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
            <div key={section.id} className="space-y-3">
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
                      <tr key={item.id} className="border-t">
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
