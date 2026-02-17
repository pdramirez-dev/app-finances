import Link from "next/link";
import { Sparkles } from "lucide-react";

import { InvoiceForm } from "@/components/invoices/invoice-form";
import { Button } from "@/components/ui/button";
import { getNextInvoiceNumber } from "@/lib/appsync/invoices";
import { requireAuth } from "@/lib/require-auth";

export default async function NewInvoicePage() {
  await requireAuth();
  const nextInvoiceNumber = await getNextInvoiceNumber();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="brand-chip border-white/25 bg-white/10 text-slate-100">
            <Sparkles className="size-3.5 text-cyan-300" />
            Create Flow
          </p>
          <h1 className="brand-heading mt-3 text-3xl text-white">New Invoice</h1>
          <p className="mt-1 text-sm text-slate-200">
            Usa la estructura basada en tu plantilla actual.
          </p>
        </div>
        <Button asChild variant="outline" className="border-white/25 bg-white/10 text-white hover:bg-white/20">
          <Link href="/invoices">Back</Link>
        </Button>
      </div>

      <InvoiceForm nextInvoiceNumber={nextInvoiceNumber} />
    </div>
  );
}
