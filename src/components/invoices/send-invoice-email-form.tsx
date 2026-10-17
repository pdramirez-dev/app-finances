"use client";

import { useActionState } from "react";
import { Mail } from "lucide-react";

import type { SendInvoiceEmailFormState } from "@/actions/invoices";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const initialState: SendInvoiceEmailFormState = {};

export function SendInvoiceEmailForm({
  action,
  defaultTo,
  kind = "invoice",
}: {
  action: (state: SendInvoiceEmailFormState, formData: FormData) => Promise<SendInvoiceEmailFormState>;
  defaultTo?: string | null;
  kind?: "invoice" | "reminder";
}) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const reminder = kind === "reminder";
  const idPrefix = reminder ? "remind" : "send";

  return (
    <form action={formAction} className="grid gap-4 md:grid-cols-2">
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-to`}>Para</Label>
        <Input id={`${idPrefix}-to`} name="to" type="email" defaultValue={defaultTo ?? ""} placeholder="cuentas@cliente.com" required />
      </div>
      <div className="space-y-2 md:col-span-2">
        <Label htmlFor={`${idPrefix}-message`}>Mensaje (opcional)</Label>
        <Textarea
          id={`${idPrefix}-message`}
          name="message"
          rows={3}
          maxLength={2000}
          placeholder={reminder ? "Quedamos atentos a tu pago." : "Gracias por tu confianza."}
        />
        <p className="text-xs text-slate-500">
          {reminder
            ? "El email indica el saldo pendiente e incluye el enlace para descargar la factura, válido 30 días."
            : "El cliente recibe un enlace para descargar el PDF, válido 30 días. Si la factura es un borrador, pasa a Enviada."}
        </p>
      </div>
      {state.error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 md:col-span-2">{state.error}</p> : null}
      {state.success ? <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 md:col-span-2">{state.success}</p> : null}
      {state.warning ? <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 md:col-span-2">{state.warning}</p> : null}
      <div className="md:col-span-2">
        <Button type="submit" disabled={isPending} className="bg-[#0a1226] text-white hover:bg-[#162448]">
          <Mail className="size-4" />
          {isPending ? "Enviando…" : reminder ? "Enviar recordatorio de pago" : "Enviar por email"}
        </Button>
      </div>
    </form>
  );
}
