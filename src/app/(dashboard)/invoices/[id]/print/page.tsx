import { notFound } from "next/navigation";

import { InvoicePreview } from "@/components/invoices/invoice-preview";
import { PrintToolbar } from "@/components/invoices/print-toolbar";
import { getInvoiceById } from "@/lib/appsync/invoices";
import { requireAuth } from "@/lib/require-auth";

export default async function InvoicePrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireAuth();

  const invoice = await getInvoiceById(id);

  if (!invoice) {
    notFound();
  }

  return (
    <main className="brand-page-bg min-h-screen p-4 md:p-8">
      <PrintToolbar invoiceId={invoice.invoiceId} />
      <InvoicePreview invoice={invoice} variant="template361" />

      <style>{`
        @page {
          size: Letter;
          margin: 0.35in 0.25in 0.5in;
        }

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
