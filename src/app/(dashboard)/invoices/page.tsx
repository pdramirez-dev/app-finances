import Link from "next/link";
import { Sparkles } from "lucide-react";

import { InvoiceListTable } from "@/components/invoices/invoice-list-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { listInvoices } from "@/lib/appsync/invoices";
import { requireAuth } from "@/lib/require-auth";

export default async function InvoiceListPage() {
  await requireAuth();
  const invoices = await listInvoices();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="brand-chip border-white/25 bg-white/10 text-slate-100">
            <Sparkles className="size-3.5 text-cyan-300" />
            Invoice Workspace
          </p>
          <h1 className="brand-heading mt-3 text-3xl text-white">Invoices</h1>
          <p className="mt-1 text-sm text-slate-200">
            Gestión inicial de invoices para el MVP.
          </p>
        </div>
        <Button asChild className="bg-white text-slate-900 hover:bg-slate-100">
          <Link href="/invoices/new">New Invoice</Link>
        </Button>
      </div>

      <Card className="brand-surface">
        <CardHeader>
          <CardTitle className="brand-heading text-xl">Listado</CardTitle>
          <CardDescription>{invoices.length} registros</CardDescription>
        </CardHeader>
        <CardContent>
          <InvoiceListTable invoices={invoices} />
        </CardContent>
      </Card>
    </div>
  );
}
