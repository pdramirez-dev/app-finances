import { ListOrdered } from "lucide-react";

import { InvoiceSeriesRow, NewInvoiceSeriesForm } from "@/components/invoices/invoice-series-forms";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { listInvoiceSeries } from "@/lib/appsync/invoices";
import { requireAuth } from "@/lib/require-auth";

export default async function InvoiceSeriesPage() {
  await requireAuth();
  const series = await listInvoiceSeries();

  return (
    <div className="space-y-6">
      <div>
        <p className="flex items-center gap-2 text-sm font-medium text-cyan-700">
          <ListOrdered className="size-4" />
          Configuración
        </p>
        <h1 className="brand-heading mt-2 text-3xl text-slate-950">Series de facturación</h1>
        <p className="mt-1 text-sm text-slate-500">
          Cada serie lleva su propio contador, por ejemplo A-0001. Las facturas sin serie usan la numeración general.
        </p>
      </div>

      <Card className="rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle>Nueva serie</CardTitle>
          <CardDescription>El código y el número inicial se fijan al crear la serie.</CardDescription>
        </CardHeader>
        <CardContent>
          <NewInvoiceSeriesForm />
        </CardContent>
      </Card>

      <Card className="rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle>Series existentes</CardTitle>
          <CardDescription>Archivar una serie la oculta en nuevas facturas; sus facturas se conservan.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {series.length ? (
            series.map((item) => <InvoiceSeriesRow key={item.seriesId} series={item} />)
          ) : (
            <div className="rounded-xl border border-dashed p-8 text-center text-sm text-slate-500">
              Aún no hay series. Las facturas usan la numeración general.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
