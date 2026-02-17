import Link from "next/link";
import { notFound } from "next/navigation";
import { Sparkles } from "lucide-react";

import { deleteInvoiceAction, updateInvoiceStatusAction } from "@/actions/invoices";
import { InvoicePreview } from "@/components/invoices/invoice-preview";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { getInvoiceById } from "@/lib/appsync/invoices";
import { INVOICE_STATUSES } from "@/lib/invoice-types";
import { requireAuth } from "@/lib/require-auth";

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireAuth();

  const invoice = await getInvoiceById(id);

  if (!invoice) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="brand-chip border-white/25 bg-white/10 text-slate-100">
            <Sparkles className="size-3.5 text-cyan-300" />
            Invoice Detail
          </p>
          <h1 className="brand-heading mt-3 text-3xl text-white">Invoice #{invoice.invoiceNumber}</h1>
          <p className="mt-1 text-sm text-slate-200">Detalle y formato de impresión</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" className="border-white/25 bg-white/10 text-white hover:bg-white/20">
            <Link href="/invoices">Back</Link>
          </Button>
          <Button asChild className="bg-white text-slate-900 hover:bg-slate-100">
            <Link href={`/invoices/${invoice.invoiceId}/print`} target="_blank">
              Print View
            </Link>
          </Button>
        </div>
      </div>

      <Card className="brand-surface">
        <CardHeader>
          <CardTitle className="brand-heading text-xl">Management</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end justify-between gap-4">
          <form action={updateInvoiceStatusAction} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="invoiceId" value={invoice.invoiceId} />
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <select
                id="status"
                name="status"
                defaultValue={invoice.status}
                className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm"
              >
                {INVOICE_STATUSES.map((statusValue) => (
                  <option key={statusValue} value={statusValue}>
                    {statusValue}
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit" variant="secondary" className="bg-slate-200 text-slate-900 hover:bg-slate-300">
              Update Status
            </Button>
          </form>

          <form action={deleteInvoiceAction}>
            <input type="hidden" name="invoiceId" value={invoice.invoiceId} />
            <Button type="submit" variant="destructive">
              Delete Invoice
            </Button>
          </form>
        </CardContent>
      </Card>

      <InvoicePreview invoice={invoice} />
    </div>
  );
}
