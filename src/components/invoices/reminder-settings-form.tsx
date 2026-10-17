"use client";

import { useActionState } from "react";

import { saveReminderSettingsAction, type ReminderSettingsFormState } from "@/actions/invoices";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: ReminderSettingsFormState = {};

export function ReminderSettingsForm({ enabled, offsets }: { enabled: boolean; offsets: number[] }) {
  const [state, formAction, isPending] = useActionState(saveReminderSettingsAction, initialState);

  return (
    <form action={formAction} className="space-y-5">
      <label className="flex items-start gap-3 text-sm text-slate-700">
        <input type="checkbox" name="enabled" defaultChecked={enabled} className="mt-0.5 size-4 rounded border-slate-300" />
        <span>
          <strong className="block text-slate-900">Enviar recordatorios automáticos</strong>
          Solo para facturas enviadas, con saldo pendiente y un cliente con email. Las facturas que ya estaban vencidas al
          activarlos no reciben recordatorios atrasados.
        </span>
      </label>
      <div className="space-y-2">
        <Label htmlFor="reminder-offsets">Días respecto al vencimiento</Label>
        <Input id="reminder-offsets" name="offsets" defaultValue={offsets.join(", ")} placeholder="-3, 0, 7, 14" />
        <p className="text-xs text-slate-500">
          Números separados por comas: negativos antes del vencimiento, 0 el mismo día y positivos después. De -30 a 90, máximo
          6. Se envía como mucho un recordatorio por factura cada 2 días.
        </p>
      </div>
      {state.error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p> : null}
      {state.success ? <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{state.success}</p> : null}
      <Button disabled={isPending}>{isPending ? "Guardando…" : "Guardar recordatorios"}</Button>
    </form>
  );
}
