import Link from "next/link";
import { Building2, CreditCard, ListOrdered } from "lucide-react";
import { AccountForm } from "@/components/workspace/forms";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getAccount } from "@/lib/appsync/workspace";

export default async function AccountPage() {
  const account = await getAccount();
  return <div className="space-y-6">
    <div><p className="flex items-center gap-2 text-sm font-medium text-cyan-700"><Building2 className="size-4" />Configuración</p><h1 className="brand-heading mt-2 text-3xl text-slate-950">Perfil de empresa</h1><p className="mt-1 text-sm text-slate-500">Datos comerciales, fiscales y de contacto usados en tu espacio.</p></div>
    <div className="grid gap-3 sm:grid-cols-2">
      <Link href="/settings/invoice-series" className="flex items-center gap-3 rounded-2xl border bg-white p-4 shadow-sm hover:bg-slate-50"><ListOrdered className="size-5 text-cyan-700" /><span><strong className="block text-sm text-slate-900">Series de facturación</strong><span className="text-xs text-slate-500">Prefijos y contadores de tus facturas</span></span></Link>
      <Link href="/settings/payments" className="flex items-center gap-3 rounded-2xl border bg-white p-4 shadow-sm hover:bg-slate-50"><CreditCard className="size-5 text-cyan-700" /><span><strong className="block text-sm text-slate-900">Datos de pago</strong><span className="text-xs text-slate-500">Cuenta bancaria que acompaña tus facturas</span></span></Link>
    </div>
    <Card className="rounded-2xl shadow-sm"><CardHeader><CardTitle>Información de la cuenta</CardTitle><CardDescription>{account ? `ID ${account.accountId}` : "Completa el perfil para comenzar"}</CardDescription></CardHeader><CardContent><AccountForm account={account} /></CardContent></Card>
  </div>;
}
