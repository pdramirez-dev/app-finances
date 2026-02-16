import Link from "next/link";
import { InvoiceStatus } from "@prisma/client";
import { notFound } from "next/navigation";

import { deleteInvoiceAction, updateInvoiceStatusAction } from "@/actions/invoices";
import { InvoicePreview } from "@/components/invoices/invoice-preview";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { prisma } from "@/lib/prisma";

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      sections: {
        orderBy: { position: "asc" },
        include: {
          lineItems: {
            orderBy: { position: "asc" },
          },
        },
      },
    },
  });

  if (!invoice) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Invoice #{invoice.invoiceNumber}</h1>
          <p className="text-sm text-muted-foreground">Detalle y formato de impresión</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/invoices">Back</Link>
          </Button>
          <Button asChild>
            <Link href={`/invoices/${invoice.id}/print`} target="_blank">
              Print View
            </Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Management</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end justify-between gap-4">
          <form action={updateInvoiceStatusAction} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="invoiceId" value={invoice.id} />
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <select
                id="status"
                name="status"
                defaultValue={invoice.status}
                className="h-9 rounded-md border bg-background px-3 text-sm"
              >
                {Object.values(InvoiceStatus).map((statusValue) => (
                  <option key={statusValue} value={statusValue}>
                    {statusValue}
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit" variant="secondary">
              Update Status
            </Button>
          </form>

          <form action={deleteInvoiceAction}>
            <input type="hidden" name="invoiceId" value={invoice.id} />
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
