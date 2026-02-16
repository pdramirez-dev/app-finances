"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";

export function PrintToolbar({ invoiceId }: { invoiceId: string }) {
  return (
    <div className="mx-auto mb-4 flex w-full max-w-4xl justify-between gap-3 print:hidden">
      <Button asChild variant="outline">
        <Link href={`/invoices/${invoiceId}`}>Back</Link>
      </Button>
      <Button onClick={() => window.print()}>Save as PDF / Print</Button>
    </div>
  );
}
