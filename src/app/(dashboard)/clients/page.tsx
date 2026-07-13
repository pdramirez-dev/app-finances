import { Contact } from "lucide-react";
import { ClientDirectory, ClientForm } from "@/components/workspace/forms";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { listClients } from "@/lib/appsync/workspace";

export default async function ClientsPage() {
  const clients = await listClients();
  return <div className="space-y-6"><div><p className="brand-chip border-white/25 bg-white/10 text-slate-100"><Contact className="size-3.5 text-cyan-300" />Directorio</p><h1 className="brand-heading mt-3 text-3xl text-white">Clientes</h1><p className="mt-1 text-sm text-slate-200">Administra destinatarios y reutiliza sus datos en facturas.</p></div><div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]"><Card className="brand-surface"><CardHeader><CardTitle>Directorio</CardTitle><CardDescription>{clients.length} clientes</CardDescription></CardHeader><CardContent><ClientDirectory clients={clients} /></CardContent></Card><Card className="brand-surface self-start"><CardHeader><CardTitle>Nuevo cliente</CardTitle><CardDescription>Añade sus datos comerciales.</CardDescription></CardHeader><CardContent><ClientForm /></CardContent></Card></div></div>;
}
