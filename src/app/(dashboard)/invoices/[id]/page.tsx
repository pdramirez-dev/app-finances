import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText } from "lucide-react";

import {
  deleteInvoiceAction,
  sendInvoiceEmailAction,
  sendPaymentReminderAction,
  updateInvoiceStatusAction,
} from "@/actions/invoices";
import { InvoicePreview } from "@/components/invoices/invoice-preview";
import { SendInvoiceEmailForm } from "@/components/invoices/send-invoice-email-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { getInvoiceById, listInvoiceReminders } from "@/lib/appsync/invoices";
import { listClients } from "@/lib/appsync/workspace";
import { INVOICE_STATUSES } from "@/lib/invoice-types";
import { formatInvoiceNumber } from "@/lib/invoices";
import { requireAuth } from "@/lib/require-auth";

function reminderOffsetLabel(offsetDays: number) {
  if (offsetDays === 0) return "el día del vencimiento";
  const days = Math.abs(offsetDays);
  return `${days} día${days === 1 ? "" : "s"} ${offsetDays < 0 ? "antes" : "después"} del vencimiento`;
}

function reminderStatusLabel(status: string) {
  return status === "SENT" ? "Enviado" : status === "FAILED" ? "Falló" : "Pendiente";
}

export default async function InvoiceDetailPage({
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

  const [client, reminders] = await Promise.all([
    invoice.clientId
      ? listClients().then((clients) => clients.find((item) => item.clientId === invoice.clientId))
      : undefined,
    listInvoiceReminders(invoice.invoiceId),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-sm font-medium text-cyan-700">
            <FileText className="size-4" />
            Finanzas · Factura
          </p>
          <h1 className="brand-heading mt-2 text-3xl text-slate-950">Factura #{formatInvoiceNumber(invoice)}</h1>
          <p className="mt-1 text-sm text-slate-500">Detalle, estado y formato de impresión</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" className="border-slate-200 bg-white text-slate-700 hover:bg-slate-50">
            <Link href="/invoices">Volver</Link>
          </Button>
          {invoice.status !== "PAID" ? (
            <Button asChild variant="outline" className="border-slate-200 bg-white text-slate-700 hover:bg-slate-50">
              <Link href={`/invoices/${invoice.invoiceId}/edit`}>Editar</Link>
            </Button>
          ) : null}
          <Button asChild className="bg-[#0a1226] text-white hover:bg-[#162448]">
            <Link href={`/invoices/${invoice.invoiceId}/print`} target="_blank">
              Imprimir / PDF
            </Link>
          </Button>
        </div>
      </div>

      <Card className="rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle className="brand-heading text-xl">Gestión</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end justify-between gap-4">
          <form action={updateInvoiceStatusAction} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="invoiceId" value={invoice.invoiceId} />
            <div className="space-y-2">
              <Label htmlFor="status">Estado</Label>
              <select
                key={invoice.status}
                id="status"
                name="status"
                defaultValue={invoice.status}
                className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm"
              >
                {INVOICE_STATUSES.map((statusValue) => (
                  <option key={statusValue} value={statusValue}>
                    {statusValue === "DRAFT" ? "Borrador" : statusValue === "SENT" ? "Enviada" : "Pagada"}
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit" variant="secondary" className="bg-slate-200 text-slate-900 hover:bg-slate-300">
              Actualizar estado
            </Button>
          </form>

          <form action={deleteInvoiceAction}>
            <input type="hidden" name="invoiceId" value={invoice.invoiceId} />
            <Button type="submit" variant="destructive">
              Eliminar factura
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle className="brand-heading text-xl">Enviar al cliente</CardTitle>
        </CardHeader>
        <CardContent>
          <SendInvoiceEmailForm
            action={sendInvoiceEmailAction.bind(null, invoice.invoiceId)}
            defaultTo={client?.email}
          />
        </CardContent>
      </Card>

      {invoice.status === "SENT" || reminders.length > 0 ? (
        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle className="brand-heading text-xl">Recordatorios de pago</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {invoice.status === "SENT" ? (
              <SendInvoiceEmailForm
                kind="reminder"
                action={sendPaymentReminderAction.bind(null, invoice.invoiceId)}
                defaultTo={client?.email}
              />
            ) : null}
            {reminders.length ? (
              <ul className="divide-y rounded-xl border text-sm">
                {reminders.map((reminder) => (
                  <li key={reminder.reminderId} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
                    <span className="text-slate-700">
                      {reminder.kind === "SCHEDULED"
                        ? `Automático (${reminderOffsetLabel(reminder.offsetDays ?? 0)})`
                        : "Manual"}{" "}
                      · {reminder.recipient}
                    </span>
                    <span className="text-xs text-slate-500">
                      {reminderStatusLabel(reminder.status)} ·{" "}
                      {new Intl.DateTimeFormat("es", { dateStyle: "medium", timeStyle: "short" }).format(new Date(reminder.createdAt))}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500">Aún no se han enviado recordatorios para esta factura.</p>
            )}
          </CardContent>
        </Card>
      ) : null}

      <InvoicePreview invoice={invoice} />
    </div>
  );
}
