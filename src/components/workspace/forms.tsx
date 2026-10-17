"use client";

import { useActionState, useState } from "react";
import { Search, Trash2 } from "lucide-react";

import { deleteClientAction, finishOnboardingAction, saveAccountAction, saveBankAction, saveClientAction, type FormState } from "@/actions/workspace";
import { Button } from "@/components/ui/button";
import { fieldA11y, FormFeedback, FormField, submitted } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { Account, Client } from "@/lib/appsync/workspace";

const initial: FormState = {};
const selectClassName = "h-9 w-full rounded-md border bg-white px-3 text-sm aria-[invalid=true]:border-red-500";

// React's form reset restores a <select> to its first default; keying it on the
// submitted value remounts it with what the user picked.
function Submit({ pending, children }: { pending: boolean; children: React.ReactNode }) {
  return <Button disabled={pending}>{pending ? "Guardando…" : children}</Button>;
}

export function AccountForm({ account, onboarding = false }: { account?: Account | null; onboarding?: boolean }) {
  const action = onboarding ? finishOnboardingAction : saveAccountAction;
  const [state, formAction, pending] = useActionState(action, initial);
  return <form action={formAction} className="grid gap-5 md:grid-cols-2" noValidate>
    <FormField state={state} name="type" id="type" label="Tipo de cuenta">
      <select key={submitted(state, "type", account?.type ?? "SELF_EMPLOYED")} {...fieldA11y(state, "type", "type")} defaultValue={submitted(state, "type", account?.type ?? "SELF_EMPLOYED")} className={selectClassName}><option value="SELF_EMPLOYED">Trabajador independiente</option><option value="COMPANY">Empresa</option></select>
    </FormField>
    <FormField state={state} name="displayName" id="displayName" label="Nombre visible">
      <Input {...fieldA11y(state, "displayName", "displayName")} defaultValue={submitted(state, "displayName", account?.displayName)} autoComplete="organization" />
    </FormField>
    <FormField state={state} name="legalName" id="legalName" label="Razón social">
      <Input {...fieldA11y(state, "legalName", "legalName")} defaultValue={submitted(state, "legalName", account?.legalName)} />
    </FormField>
    <FormField state={state} name="taxId" id="taxId" label="Identificación fiscal">
      <Input {...fieldA11y(state, "taxId", "taxId")} defaultValue={submitted(state, "taxId", account?.taxId)} />
    </FormField>
    <FormField state={state} name="email" id="email" label="Email">
      <Input {...fieldA11y(state, "email", "email")} type="email" defaultValue={submitted(state, "email", account?.email)} autoComplete="email" />
    </FormField>
    <FormField state={state} name="phone" id="phone" label="Teléfono">
      <Input {...fieldA11y(state, "phone", "phone")} type="tel" defaultValue={submitted(state, "phone", account?.phone)} autoComplete="tel" />
    </FormField>
    <FormField state={state} name="address" id="address" label="Dirección" className="md:col-span-2">
      <Textarea {...fieldA11y(state, "address", "address")} defaultValue={submitted(state, "address", account?.address)} autoComplete="street-address" />
    </FormField>
    <div className="md:col-span-2"><FormFeedback state={state} /></div>
    <div className="md:col-span-2"><Submit pending={pending}>{onboarding ? "Crear mi espacio" : "Guardar cambios"}</Submit></div>
  </form>;
}

export function ClientForm({ client }: { client?: Client }) {
  const [state, action, pending] = useActionState(saveClientAction, initial);
  const prefix = `client-${client?.clientId ?? "new"}`;
  return <form action={action} className="grid gap-4 md:grid-cols-2" noValidate>
    <input type="hidden" name="clientId" value={client?.clientId ?? ""} />
    <FormField state={state} name="name" id={`${prefix}-name`} label="Nombre">
      <Input {...fieldA11y(state, "name", `${prefix}-name`)} defaultValue={submitted(state, "name", client?.name)} />
    </FormField>
    <FormField state={state} name="email" id={`${prefix}-email`} label="Email">
      <Input {...fieldA11y(state, "email", `${prefix}-email`)} type="email" defaultValue={submitted(state, "email", client?.email)} />
    </FormField>
    <FormField state={state} name="phone" id={`${prefix}-phone`} label="Teléfono">
      <Input {...fieldA11y(state, "phone", `${prefix}-phone`)} type="tel" defaultValue={submitted(state, "phone", client?.phone)} />
    </FormField>
    <FormField state={state} name="taxId" id={`${prefix}-taxId`} label="ID fiscal">
      <Input {...fieldA11y(state, "taxId", `${prefix}-taxId`)} defaultValue={submitted(state, "taxId", client?.taxId)} />
    </FormField>
    <FormField state={state} name="address" id={`${prefix}-address`} label="Dirección" className="md:col-span-2">
      <Textarea {...fieldA11y(state, "address", `${prefix}-address`)} defaultValue={submitted(state, "address", client?.address)} />
    </FormField>
    <div className="md:col-span-2"><FormFeedback state={state} /></div>
    <div className="md:col-span-2 flex justify-end"><Submit pending={pending}>{client ? "Actualizar" : "Añadir cliente"}</Submit></div>
  </form>;
}

export function ClientDirectory({ clients }: { clients: Client[] }) {
  const [query, setQuery] = useState("");
  const shown = clients.filter((client) => `${client.name} ${client.email ?? ""}`.toLowerCase().includes(query.toLowerCase()));
  return <div className="space-y-4">
    <div className="relative"><Search className="absolute left-3 top-2.5 size-4 text-slate-400" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nombre o email" aria-label="Buscar clientes" className="pl-9" /></div>
    {shown.length ? shown.map((client) => <details key={client.clientId} className="rounded-xl border bg-slate-50 p-4"><summary className="cursor-pointer font-semibold text-slate-900">{client.name}<span className="ml-2 font-normal text-slate-500">{client.email}</span></summary><div className="mt-4"><ClientForm client={client} /><form action={deleteClientAction} className="mt-3"><input type="hidden" name="clientId" value={client.clientId} /><Button variant="destructive" size="sm"><Trash2 />Eliminar</Button></form></div></details>) : <div className="rounded-xl border border-dashed p-8 text-center text-sm text-slate-500">No hay clientes que coincidan.</div>}
  </div>;
}

export function BankForm() {
  const [state, action, pending] = useActionState(saveBankAction, initial);
  return <form action={action} className="grid gap-4 md:grid-cols-2" noValidate>
    <FormField state={state} name="beneficiaryName" id="bank-beneficiary" label="Beneficiario">
      <Input {...fieldA11y(state, "beneficiaryName", "bank-beneficiary")} defaultValue={submitted(state, "beneficiaryName")} />
    </FormField>
    <FormField state={state} name="bankName" id="bank-name" label="Banco">
      <Input {...fieldA11y(state, "bankName", "bank-name")} defaultValue={submitted(state, "bankName")} />
    </FormField>
    <FormField state={state} name="accountNumberMasked" id="bank-account" label="Número de cuenta" hint="Solo los últimos dígitos, por ejemplo •••• 1234">
      <Input {...fieldA11y(state, "accountNumberMasked", "bank-account")} defaultValue={submitted(state, "accountNumberMasked")} placeholder="•••• 1234" />
    </FormField>
    <FormField state={state} name="routingNumberMasked" id="bank-routing" label="Routing">
      <Input {...fieldA11y(state, "routingNumberMasked", "bank-routing")} defaultValue={submitted(state, "routingNumberMasked")} placeholder="•••• 5678" />
    </FormField>
    <FormField state={state} name="ibanMasked" id="bank-iban" label="IBAN">
      <Input {...fieldA11y(state, "ibanMasked", "bank-iban")} defaultValue={submitted(state, "ibanMasked")} placeholder="•••••• 123456" />
    </FormField>
    <FormField state={state} name="swiftCode" id="bank-swift" label="SWIFT">
      <Input {...fieldA11y(state, "swiftCode", "bank-swift")} defaultValue={submitted(state, "swiftCode")} />
    </FormField>
    <FormField state={state} name="currency" id="bank-currency" label="Moneda">
      <Input {...fieldA11y(state, "currency", "bank-currency")} defaultValue={submitted(state, "currency", "USD")} maxLength={3} />
    </FormField>
    <FormField state={state} name="country" id="bank-country" label="País">
      <Input {...fieldA11y(state, "country", "bank-country")} defaultValue={submitted(state, "country")} />
    </FormField>
    <div className="md:col-span-2"><FormFeedback state={state} /></div>
    <div className="md:col-span-2"><Submit pending={pending}>Guardar datos de pago</Submit></div>
  </form>;
}
