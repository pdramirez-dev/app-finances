import Link from "next/link";
import { FilePlus2 } from "lucide-react";

import { InvoiceForm } from "@/components/invoices/invoice-form";
import { Button } from "@/components/ui/button";
import { requireAuth } from "@/lib/require-auth";
import { listInvoiceSeries } from "@/lib/appsync/invoices";
import { listClients } from "@/lib/appsync/workspace";

export default async function NewInvoicePage() {
  await requireAuth();
  const [clients, series] = await Promise.all([listClients(), listInvoiceSeries()]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-sm font-medium text-cyan-700">
            <FilePlus2 className="size-4" />
            Finanzas · Nueva factura
          </p>
          <h1 className="brand-heading mt-2 text-3xl text-slate-950">Crear factura</h1>
          <p className="mt-1 text-sm text-slate-500">
            Vincula un cliente, añade conceptos y revisa el total.
          </p>
        </div>
        <Button asChild variant="outline" className="border-slate-200 bg-white text-slate-700 hover:bg-slate-50">
          <Link href="/invoices">Volver</Link>
        </Button>
      </div>

      <InvoiceForm clients={clients} series={series} />
    </div>
  );
}
