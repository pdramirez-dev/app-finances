"use client";

import { useActionState, useState } from "react";
import { Search, Trash2 } from "lucide-react";

import { deleteClientAction, finishOnboardingAction, saveAccountAction, saveBankAction, saveClientAction, type FormState } from "@/actions/workspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Account, Client } from "@/lib/appsync/workspace";

const initial: FormState = {};

function Feedback({ state }: { state: FormState }) {
  if (!state.error && !state.success) return null;
  return <p className={`rounded-lg px-3 py-2 text-sm ${state.error ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>{state.error ?? state.success}</p>;
}

function Submit({ pending, children }: { pending: boolean; children: React.ReactNode }) {
  return <Button disabled={pending}>{pending ? "Guardando…" : children}</Button>;
}

export function AccountForm({ account, onboarding = false }: { account?: Account | null; onboarding?: boolean }) {
  const action = onboarding ? finishOnboardingAction : saveAccountAction;
  const [state, formAction, pending] = useActionState(action, initial);
  return <form action={formAction} className="grid gap-5 md:grid-cols-2">
    <div className="space-y-2"><Label htmlFor="type">Tipo de cuenta</Label><select id="type" name="type" defaultValue={account?.type ?? "SELF_EMPLOYED"} className="h-9 w-full rounded-md border bg-white px-3 text-sm"><option value="SELF_EMPLOYED">Trabajador independiente</option><option value="COMPANY">Empresa</option></select></div>
    <div className="space-y-2"><Label htmlFor="displayName">Nombre visible</Label><Input id="displayName" name="displayName" defaultValue={account?.displayName ?? ""} required /></div>
    <div className="space-y-2"><Label htmlFor="legalName">Razón social</Label><Input id="legalName" name="legalName" defaultValue={account?.legalName ?? ""} /></div>
    <div className="space-y-2"><Label htmlFor="taxId">Identificación fiscal</Label><Input id="taxId" name="taxId" defaultValue={account?.taxId ?? ""} /></div>
    <div className="space-y-2"><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" defaultValue={account?.email ?? ""} /></div>
    <div className="space-y-2"><Label htmlFor="phone">Teléfono</Label><Input id="phone" name="phone" defaultValue={account?.phone ?? ""} /></div>
    <div className="space-y-2 md:col-span-2"><Label htmlFor="address">Dirección</Label><Textarea id="address" name="address" defaultValue={account?.address ?? ""} /></div>
    <div className="md:col-span-2"><Feedback state={state} /></div>
    <div className="md:col-span-2"><Submit pending={pending}>{onboarding ? "Crear mi espacio" : "Guardar cambios"}</Submit></div>
  </form>;
}

export function ClientForm({ client }: { client?: Client }) {
  const [state, action, pending] = useActionState(saveClientAction, initial);
  return <form action={action} className="grid gap-4 md:grid-cols-2">
    <input type="hidden" name="clientId" value={client?.clientId ?? ""} />
    <div className="space-y-2"><Label htmlFor={`name-${client?.clientId ?? "new"}`}>Nombre</Label><Input id={`name-${client?.clientId ?? "new"}`} name="name" defaultValue={client?.name ?? ""} required /></div>
    <div className="space-y-2"><Label>Email</Label><Input name="email" type="email" defaultValue={client?.email ?? ""} /></div>
    <div className="space-y-2"><Label>Teléfono</Label><Input name="phone" defaultValue={client?.phone ?? ""} /></div>
    <div className="space-y-2"><Label>ID fiscal</Label><Input name="taxId" defaultValue={client?.taxId ?? ""} /></div>
    <div className="space-y-2 md:col-span-2"><Label>Dirección</Label><Textarea name="address" defaultValue={client?.address ?? ""} /></div>
    <div className="md:col-span-2"><Feedback state={state} /></div>
    <div className="md:col-span-2 flex justify-end"><Submit pending={pending}>{client ? "Actualizar" : "Añadir cliente"}</Submit></div>
  </form>;
}

export function ClientDirectory({ clients }: { clients: Client[] }) {
  const [query, setQuery] = useState("");
  const shown = clients.filter((client) => `${client.name} ${client.email ?? ""}`.toLowerCase().includes(query.toLowerCase()));
  return <div className="space-y-4">
    <div className="relative"><Search className="absolute left-3 top-2.5 size-4 text-slate-400" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nombre o email" className="pl-9" /></div>
    {shown.length ? shown.map((client) => <details key={client.clientId} className="rounded-xl border bg-slate-50 p-4"><summary className="cursor-pointer font-semibold text-slate-900">{client.name}<span className="ml-2 font-normal text-slate-500">{client.email}</span></summary><div className="mt-4"><ClientForm client={client} /><form action={deleteClientAction} className="mt-3"><input type="hidden" name="clientId" value={client.clientId} /><Button variant="destructive" size="sm"><Trash2 />Eliminar</Button></form></div></details>) : <div className="rounded-xl border border-dashed p-8 text-center text-sm text-slate-500">No hay clientes que coincidan.</div>}
  </div>;
}

export function BankForm() {
  const [state, action, pending] = useActionState(saveBankAction, initial);
  return <form action={action} className="grid gap-4 md:grid-cols-2">
    <div className="space-y-2"><Label>Beneficiario</Label><Input name="beneficiaryName" required /></div>
    <div className="space-y-2"><Label>Banco</Label><Input name="bankName" required /></div>
    <div className="space-y-2"><Label>Número de cuenta</Label><Input name="accountNumberMasked" placeholder="•••• 1234" /></div>
    <div className="space-y-2"><Label>Routing</Label><Input name="routingNumberMasked" placeholder="•••• 5678" /></div>
    <div className="space-y-2"><Label>IBAN</Label><Input name="ibanMasked" placeholder="•••••• 123456" /></div>
    <div className="space-y-2"><Label>SWIFT</Label><Input name="swiftCode" /></div>
    <div className="space-y-2"><Label>Moneda</Label><Input name="currency" defaultValue="USD" maxLength={3} required /></div>
    <div className="space-y-2"><Label>País</Label><Input name="country" /></div>
    <div className="md:col-span-2"><Feedback state={state} /></div>
    <div className="md:col-span-2"><Submit pending={pending}>Guardar datos de pago</Submit></div>
  </form>;
}
