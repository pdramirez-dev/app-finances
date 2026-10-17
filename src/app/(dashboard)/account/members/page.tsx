import { ShieldCheck, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getMyMembership } from "@/lib/appsync/workspace";

export default async function MembersPage() {
  const membership = await getMyMembership();
  return <div className="space-y-6"><div><p className="flex items-center gap-2 text-sm font-medium text-cyan-700"><Users className="size-4" />Espacio de trabajo</p><h1 className="brand-heading mt-2 text-3xl text-slate-950">Equipo y permisos</h1><p className="mt-1 text-sm text-slate-500">Gestiona el acceso al espacio activo.</p></div><Card className="rounded-2xl shadow-sm"><CardHeader><CardTitle>Tu membresía</CardTitle><CardDescription>Los permisos se validan en cada operación del backend.</CardDescription></CardHeader><CardContent><div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-slate-50 p-5"><div><p className="font-semibold text-slate-900">Usuario {membership.userId}</p><p className="mt-1 text-sm text-slate-500">Cuenta {membership.accountId}</p></div><div className="flex gap-2"><Badge>{membership.role}</Badge><Badge variant="outline" className="text-emerald-700"><ShieldCheck />{membership.status}</Badge></div></div><p className="mt-5 text-sm text-slate-500">La administración e invitación de otros miembros estará disponible cuando el backend exponga el directorio de membresías.</p></CardContent></Card></div>;
}
