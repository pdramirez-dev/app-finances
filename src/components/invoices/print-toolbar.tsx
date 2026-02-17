"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";

export function PrintToolbar({ invoiceId }: { invoiceId: string }) {
  return (
    <div className="mx-auto mb-4 flex w-full max-w-4xl justify-between gap-3 print:hidden">
      <Button asChild variant="outline" className="border-white/25 bg-white/10 text-white hover:bg-white/20">
        <Link href={`/invoices/${invoiceId}`}>Back</Link>
      </Button>
      <Button onClick={() => window.print()} className="bg-white text-slate-900 hover:bg-slate-100">
        Save as PDF / Print
      </Button>
    </div>
  );
}
