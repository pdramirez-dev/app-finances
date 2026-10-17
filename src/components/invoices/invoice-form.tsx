"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { Trash2 } from "lucide-react";

import { createInvoiceAction, type CreateInvoiceActionState } from "@/actions/invoices";
import type { InvoiceRecord, InvoiceSeries } from "@/lib/invoice-types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { defaultSectionTemplate } from "@/lib/company";
import type { Client } from "@/lib/appsync/workspace";
import { formatInvoiceNumber, formatMoney, toDateInputValue } from "@/lib/invoices";

type EditableItem = {
  description: string;
  quantity: string;
  amount: string;
};

type EditableSection = {
  title: string;
  items: EditableItem[];
};

const initialState: CreateInvoiceActionState = {};

function newItem(): EditableItem {
  return {
    description: "",
    quantity: "1",
    amount: "0",
  };
}

function parseNumeric(value: string) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

type InvoiceFormAction = (
  state: CreateInvoiceActionState,
  formData: FormData,
) => Promise<CreateInvoiceActionState>;

function sectionsFromInvoice(invoice: InvoiceRecord): EditableSection[] {
  return invoice.sections.map((section) => ({
    title: section.title,
    items: section.lineItems.map((item) => ({
      description: item.description,
      quantity: String(item.quantity),
      amount: String(item.amount),
    })),
  }));
}

export function InvoiceForm({
  clients = [],
  series = [],
  invoice,
  action = createInvoiceAction,
}: {
  clients?: Client[];
  series?: InvoiceSeries[];
  invoice?: InvoiceRecord;
  action?: InvoiceFormAction;
}) {
  const activeSeries = series.filter((item) => !item.archived);
  const defaultSeriesId = activeSeries.find((item) => item.isDefault)?.seriesId ?? "";
  const isEditing = Boolean(invoice);
  const [state, formAction, isPending] = useActionState(action, initialState);
  const [defaultDates] = useState(() => {
    if (invoice) {
      return {
        issueDate: toDateInputValue(invoice.date),
        dueDate: invoice.dueDate ? toDateInputValue(invoice.dueDate) : "",
      };
    }
    const issueDate = new Date();
    const dueDate = new Date(issueDate);
    dueDate.setDate(dueDate.getDate() + 30);
    return {
      issueDate: toDateInputValue(issueDate),
      dueDate: toDateInputValue(dueDate),
    };
  });
  const [sections, setSections] = useState<EditableSection[]>(() =>
    invoice && invoice.sections.length > 0
      ? sectionsFromInvoice(invoice)
      : defaultSectionTemplate.map((section) => ({
          title: section.title,
          items: section.items.map((item) => ({
            description: item.description,
            quantity: String(item.quantity),
            amount: String(item.amount),
          })),
        })),
  );

  const sectionsPayload = useMemo(
    () =>
      sections.map((section) => ({
        title: section.title,
        items: section.items.map((item) => ({
          description: item.description,
          quantity: parseNumeric(item.quantity),
          amount: parseNumeric(item.amount),
        })),
      })),
    [sections],
  );

  const grandTotal = useMemo(
    () =>
      sectionsPayload.reduce(
        (sum, section) =>
          sum +
          section.items.reduce((sectionSum, item) => sectionSum + item.quantity * item.amount, 0),
        0,
      ),
    [sectionsPayload],
  );

  function updateSection(sectionIndex: number, key: keyof EditableSection, value: string) {
    setSections((previous) =>
      previous.map((section, currentIndex) =>
        currentIndex === sectionIndex ? { ...section, [key]: value } : section,
      ),
    );
  }

  function updateItem(
    sectionIndex: number,
    itemIndex: number,
    key: keyof EditableItem,
    value: string,
  ) {
    setSections((previous) =>
      previous.map((section, currentSectionIndex) => {
        if (currentSectionIndex !== sectionIndex) {
          return section;
        }

        return {
          ...section,
          items: section.items.map((item, currentItemIndex) =>
            currentItemIndex === itemIndex ? { ...item, [key]: value } : item,
          ),
        };
      }),
    );
  }

  function addSection() {
    setSections((previous) => [
      ...previous,
      {
        title: `Cuadrilla (${previous.length + 1})`,
        items: [newItem()],
      },
    ]);
  }

  function removeSection(sectionIndex: number) {
    setSections((previous) => previous.filter((_, index) => index !== sectionIndex));
  }

  function addItem(sectionIndex: number) {
    setSections((previous) =>
      previous.map((section, index) =>
        index === sectionIndex ? { ...section, items: [...section.items, newItem()] } : section,
      ),
    );
  }

  function removeItem(sectionIndex: number, itemIndex: number) {
    setSections((previous) =>
      previous.map((section, index) => {
        if (index !== sectionIndex) {
          return section;
        }

        return {
          ...section,
          items: section.items.filter((_, currentItemIndex) => currentItemIndex !== itemIndex),
        };
      }),
    );
  }

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="sections" value={JSON.stringify(sectionsPayload)} />

      <Card className="brand-surface">
        <CardHeader>
          <CardTitle className="brand-heading text-xl">Datos principales</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="clientId">Cliente guardado</Label>
            <select id="clientId" name="clientId" defaultValue={invoice?.clientId ?? ""} className="h-9 w-full rounded-md border bg-white px-3 text-sm">
              <option value="">Sin cliente vinculado</option>
              {clients.map((client) => <option key={client.clientId} value={client.clientId}>{client.name}</option>)}
            </select>
            <p className="text-xs text-slate-500">Vincula la factura al cliente dentro de la cuenta activa.</p>
          </div>
          {invoice ? (
            <div className="space-y-2 md:col-span-2">
              <Label>Numeración</Label>
              <p className="text-sm text-slate-700">
                {invoice.seriesCode ? `Serie ${invoice.seriesCode}` : "Numeración general"} · Factura #{formatInvoiceNumber(invoice)}
              </p>
              <p className="text-xs text-slate-500">La serie y el número no cambian al editar.</p>
            </div>
          ) : (
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="seriesId">Serie de numeración</Label>
              <select id="seriesId" name="seriesId" defaultValue={defaultSeriesId} className="h-9 w-full rounded-md border bg-white px-3 text-sm">
                <option value="">Numeración general</option>
                {activeSeries.map((item) => (
                  <option key={item.seriesId} value={item.seriesId}>
                    {item.code} · {item.name} (siguiente {formatInvoiceNumber({ seriesCode: item.code, invoiceNumber: item.nextNumber })})
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-500">
                Gestiona las series en <Link href="/settings/invoice-series" className="font-medium text-cyan-700 hover:underline">Configuración · Series de facturación</Link>.
              </p>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="weekNumber">Número de semana</Label>
            <Input id="weekNumber" name="weekNumber" type="number" min={1} max={53} defaultValue={invoice?.weekNumber} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="date">Fecha</Label>
            <Input id="date" name="date" type="date" defaultValue={defaultDates.issueDate} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dueDate">Fecha de vencimiento</Label>
            <Input id="dueDate" name="dueDate" type="date" defaultValue={defaultDates.dueDate} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="project">Proyecto</Label>
            <Input id="project" name="project" placeholder="Mantenimiento regional" defaultValue={invoice?.project} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="billToName">Facturar a</Label>
            <Input id="billToName" name="billToName" placeholder="Nombre de la empresa" defaultValue={invoice?.billToName} required />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="billToAddress">Dirección de facturación</Label>
            <Textarea id="billToAddress" name="billToAddress" rows={3} defaultValue={invoice?.billToAddress} required />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="notes">Notas (opcional)</Label>
            <Textarea id="notes" name="notes" rows={3} defaultValue={invoice?.notes ?? ""} />
          </div>
        </CardContent>
      </Card>

      <Card className="brand-surface">
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle className="brand-heading text-xl">Conceptos y cuadrillas</CardTitle>
          <Button type="button" variant="secondary" className="bg-slate-200 text-slate-900 hover:bg-slate-300" onClick={addSection}>
            Añadir sección
          </Button>
        </CardHeader>
        <CardContent className="space-y-6">
          {sections.map((section, sectionIndex) => {
            const sectionTotal = section.items.reduce(
              (sum, item) => sum + parseNumeric(item.quantity) * parseNumeric(item.amount),
              0,
            );

            return (
              <div
                key={sectionIndex}
                className="space-y-4 rounded-lg border border-slate-200 bg-slate-50/70 p-4"
              >
                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-60 flex-1 space-y-2">
                    <Label>Título de la sección</Label>
                    <Input
                      value={section.title}
                      onChange={(event) =>
                        updateSection(sectionIndex, "title", event.target.value)
                      }
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="border-slate-300 bg-white hover:bg-slate-100"
                    onClick={() => removeSection(sectionIndex)}
                    disabled={sections.length === 1}
                    aria-label="Eliminar sección"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>

                <div className="space-y-3">
                  {section.items.map((item, itemIndex) => (
                    <div
                      key={`${sectionIndex}-${itemIndex}`}
                      className="grid gap-3 rounded-md border border-slate-200 bg-white p-3 md:grid-cols-12"
                    >
                      <div className="space-y-2 md:col-span-6">
                        <Label>Descripción</Label>
                        <Input
                          value={item.description}
                          onChange={(event) =>
                            updateItem(sectionIndex, itemIndex, "description", event.target.value)
                          }
                        />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <Label>Cant.</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.quantity}
                          onChange={(event) =>
                            updateItem(sectionIndex, itemIndex, "quantity", event.target.value)
                          }
                        />
                      </div>
                      <div className="space-y-2 md:col-span-3">
                        <Label>Precio</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={item.amount}
                          onChange={(event) =>
                            updateItem(sectionIndex, itemIndex, "amount", event.target.value)
                          }
                        />
                      </div>
                      <div className="flex items-end md:col-span-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="border-slate-300 bg-white hover:bg-slate-100"
                          onClick={() => removeItem(sectionIndex, itemIndex)}
                          disabled={section.items.length === 1}
                          aria-label="Eliminar concepto"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="border-slate-300 bg-white hover:bg-slate-100"
                    onClick={() => addItem(sectionIndex)}
                  >
                    Añadir concepto
                  </Button>
                  <p className="text-sm font-medium">Subtotal: {formatMoney(sectionTotal)}</p>
                </div>
              </div>
            );
          })}

          <Separator />
          <p className="brand-heading text-right text-xl text-slate-900">Total: {formatMoney(grandTotal)}</p>

          {state.error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
              <p className="text-sm font-medium text-red-700">
                {isEditing ? "No se pudo guardar la factura" : "No se pudo crear la factura"}
              </p>
              <p className="mt-1 text-sm text-red-600">{state.error}</p>
            </div>
          ) : null}

          <div className="flex justify-end">
            <Button type="submit" className="bg-[#0a1226] text-white hover:bg-[#162448]" disabled={isPending}>
              {isEditing
                ? isPending ? "Guardando…" : "Guardar cambios"
                : isPending ? "Creando…" : "Crear factura"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
