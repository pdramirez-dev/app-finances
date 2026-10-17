import Link from "next/link";
import { CircleDollarSign, Clock3, FileCheck2, Plus, ReceiptText } from "lucide-react";

import { InvoiceListTable } from "@/components/invoices/invoice-list-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { listInvoices } from "@/lib/appsync/invoices";
import { requireAuth } from "@/lib/require-auth";

export default async function InvoiceListPage() {
  await requireAuth();
  const invoices = await listInvoices();
  const total = invoices.reduce((sum, invoice) => sum + invoice.grandTotal, 0);
  const paid = invoices.filter((invoice) => invoice.status === "PAID").reduce((sum, invoice) => sum + invoice.grandTotal, 0);
  const pending = invoices.filter((invoice) => invoice.status === "SENT").reduce((sum, invoice) => sum + invoice.grandTotal, 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-sm font-medium text-cyan-700">
            <ReceiptText className="size-4" />
            Finanzas · Cuentas por cobrar
          </p>
          <h1 className="brand-heading mt-2 text-3xl text-slate-950">Facturas</h1>
          <p className="mt-1 text-sm text-slate-500">
            Crea, envía y controla el cobro de cada factura.
          </p>
        </div>
        <Button asChild className="h-10 rounded-lg bg-[#0a1226] text-white hover:bg-[#162448]">
          <Link href="/invoices/new"><Plus />Nueva factura</Link>
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: "Facturado", value: total, note: `${invoices.length} facturas`, icon: CircleDollarSign, tone: "bg-blue-50 text-blue-700" },
          { label: "Cobrado", value: paid, note: "Pagos confirmados", icon: FileCheck2, tone: "bg-emerald-50 text-emerald-700" },
          { label: "Pendiente", value: pending, note: "Requiere seguimiento", icon: Clock3, tone: "bg-amber-50 text-amber-700" },
        ].map((metric) => <Card key={metric.label} className="gap-0 rounded-2xl py-4 shadow-sm"><CardContent className="flex items-center gap-4 px-4"><span className={`flex size-10 items-center justify-center rounded-xl ${metric.tone}`}><metric.icon className="size-5" /></span><div><p className="text-xs font-medium text-slate-500">{metric.label}</p><p className="brand-heading mt-1 text-xl text-slate-950">{new Intl.NumberFormat("es-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(metric.value)}</p><p className="mt-0.5 text-xs text-slate-400">{metric.note}</p></div></CardContent></Card>)}
      </div>

      <Card className="gap-4 rounded-2xl border-slate-200 py-5 shadow-sm">
        <CardHeader>
          <CardTitle className="brand-heading text-xl">Todas las facturas</CardTitle>
          <CardDescription>{invoices.length} registros en el espacio activo</CardDescription>
        </CardHeader>
        <CardContent>
          <InvoiceListTable invoices={invoices} />
        </CardContent>
      </Card>
    </div>
  );
}
