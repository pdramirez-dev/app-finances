import Link from "next/link";

import { InvoiceForm } from "@/components/invoices/invoice-form";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";

export default async function NewInvoicePage() {
  const latestInvoice = await prisma.invoice.findFirst({
    orderBy: { invoiceNumber: "desc" },
    select: { invoiceNumber: true },
  });

  const nextInvoiceNumber = latestInvoice ? latestInvoice.invoiceNumber + 1 : 1;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">New Invoice</h1>
          <p className="text-sm text-muted-foreground">
            Usa la estructura basada en tu plantilla actual.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/invoices">Back</Link>
        </Button>
      </div>

      <InvoiceForm nextInvoiceNumber={nextInvoiceNumber} />
    </div>
  );
}
