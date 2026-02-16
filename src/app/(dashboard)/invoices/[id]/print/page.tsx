import { notFound } from "next/navigation";

import { InvoicePreview } from "@/components/invoices/invoice-preview";
import { PrintToolbar } from "@/components/invoices/print-toolbar";
import { prisma } from "@/lib/prisma";

export default async function InvoicePrintPage({
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
    <main className="min-h-screen bg-muted/20 p-4 md:p-8">
      <PrintToolbar invoiceId={invoice.id} />
      <InvoicePreview invoice={invoice} />

      <style>{`
        @media print {
          body {
            background: white;
          }

          article {
            box-shadow: none !important;
            border: none !important;
            padding: 0 !important;
            max-width: 100% !important;
          }
        }
      `}</style>
    </main>
  );
}
