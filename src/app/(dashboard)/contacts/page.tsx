import { ContactRound } from "lucide-react";

import { ContactsCrmView } from "./contacts-crm-view";
import { listContacts } from "@/lib/appsync/crm";

export default async function ContactsPage() {
  const contacts = await listContacts();
  return (
    <div className="space-y-6">
      <div>
        <p className="flex items-center gap-2 text-sm font-medium text-cyan-700">
          <ContactRound className="size-4" />
          CRM · Personas
        </p>
        <h1 className="brand-heading mt-2 text-3xl text-slate-950">Contactos</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-500">
          Centraliza clientes, oportunidades y colaboradores en un solo lugar.
        </p>
      </div>

      <ContactsCrmView initialContacts={contacts} />
    </div>
  );
}
