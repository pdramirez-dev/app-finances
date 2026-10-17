import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { FilePenLine } from "lucide-react";

import { updateInvoiceAction } from "@/actions/invoices";
import { InvoiceForm } from "@/components/invoices/invoice-form";
import { Button } from "@/components/ui/button";
import { getInvoiceById } from "@/lib/appsync/invoices";
import { listClients } from "@/lib/appsync/workspace";
import { requireAuth } from "@/lib/require-auth";

export default async function EditInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireAuth();

  const [invoice, clients] = await Promise.all([getInvoiceById(id), listClients()]);

  if (!invoice) {
    notFound();
  }

  // Paid invoices are immutable; the backend rejects the edit as well.
  if (invoice.status === "PAID") {
    redirect(`/invoices/${invoice.invoiceId}`);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-sm font-medium text-cyan-700">
            <FilePenLine className="size-4" />
            Finanzas · Editar factura
          </p>
          <h1 className="brand-heading mt-2 text-3xl text-slate-950">Editar factura #{invoice.invoiceNumber}</h1>
          <p className="mt-1 text-sm text-slate-500">
            Ajusta los datos y conceptos. El número y el estado de la factura no cambian.
          </p>
        </div>
        <Button asChild variant="outline" className="border-slate-200 bg-white text-slate-700 hover:bg-slate-50">
          <Link href={`/invoices/${invoice.invoiceId}`}>Cancelar</Link>
        </Button>
      </div>

      <InvoiceForm
        clients={clients}
        invoice={invoice}
        action={updateInvoiceAction.bind(null, invoice.invoiceId)}
      />
    </div>
  );
}
