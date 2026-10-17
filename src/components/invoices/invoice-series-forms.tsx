"use client";

import { useActionState } from "react";

import { saveInvoiceSeriesAction, type InvoiceSeriesFormState } from "@/actions/invoices";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { InvoiceSeries } from "@/lib/invoice-types";
import { formatInvoiceNumber } from "@/lib/invoices";

const initialState: InvoiceSeriesFormState = {};

function Feedback({ state }: { state: InvoiceSeriesFormState }) {
  if (!state.error && !state.success) return null;
  return (
    <p className={`rounded-lg px-3 py-2 text-sm ${state.error ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>
      {state.error ?? state.success}
    </p>
  );
}

function Checkbox({ name, label, defaultChecked }: { name: string; label: string; defaultChecked?: boolean }) {
  return (
    <label className="flex items-center gap-2 text-sm text-slate-700">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="size-4 rounded border-slate-300" />
      {label}
    </label>
  );
}

export function NewInvoiceSeriesForm() {
  const [state, formAction, isPending] = useActionState(saveInvoiceSeriesAction, initialState);
  return (
    <form action={formAction} className="grid gap-4 md:grid-cols-3">
      <div className="space-y-2">
        <Label htmlFor="series-code">Código</Label>
        <Input id="series-code" name="code" placeholder="A, R, 2026" defaultValue={state.values?.code ?? ""} maxLength={12} required className="uppercase" />
        <p className="text-xs text-slate-500">Letras, números o guiones. No se puede cambiar después.</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="series-name">Nombre</Label>
        <Input id="series-name" name="name" placeholder="Facturas de servicio" defaultValue={state.values?.name ?? ""} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="series-start">Número inicial</Label>
        <Input id="series-start" name="startNumber" type="number" min={1} defaultValue={state.values?.startNumber ?? "1"} />
        <p className="text-xs text-slate-500">Útil si continúas la numeración de otro sistema.</p>
      </div>
      <div className="md:col-span-3">
        <Checkbox name="isDefault" label="Usar como serie predeterminada en nuevas facturas" />
      </div>
      <div className="md:col-span-3"><Feedback state={state} /></div>
      <div className="md:col-span-3">
        <Button disabled={isPending}>{isPending ? "Guardando…" : "Crear serie"}</Button>
      </div>
    </form>
  );
}

export function InvoiceSeriesRow({ series }: { series: InvoiceSeries }) {
  const [state, formAction, isPending] = useActionState(saveInvoiceSeriesAction, initialState);
  return (
    <form action={formAction} className="space-y-3 rounded-xl border bg-slate-50 p-4">
      <input type="hidden" name="seriesId" value={series.seriesId} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold text-slate-900">
          {series.code}
          {series.isDefault ? <span className="ml-2 rounded-full bg-cyan-100 px-2 py-0.5 text-xs font-medium text-cyan-800">Predeterminada</span> : null}
          {series.archived ? <span className="ml-2 rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-700">Archivada</span> : null}
        </p>
        <p className="text-sm text-slate-500">
          Siguiente: {formatInvoiceNumber({ seriesCode: series.code, invoiceNumber: series.nextNumber })}
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-[1fr_auto_auto] md:items-end">
        <div className="space-y-2">
          <Label htmlFor={`series-name-${series.seriesId}`}>Nombre</Label>
          <Input id={`series-name-${series.seriesId}`} name="name" defaultValue={series.name} required />
        </div>
        <Checkbox name="isDefault" label="Predeterminada" defaultChecked={series.isDefault} />
        <Checkbox name="archived" label="Archivada" defaultChecked={series.archived} />
      </div>
      <Feedback state={state} />
      <Button size="sm" variant="outline" disabled={isPending}>{isPending ? "Guardando…" : "Guardar"}</Button>
    </form>
  );
}
