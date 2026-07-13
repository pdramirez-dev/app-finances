import { Building2 } from "lucide-react";
import { AccountForm } from "@/components/workspace/forms";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getAccount } from "@/lib/appsync/workspace";

export default async function AccountPage() {
  const account = await getAccount();
  return <div className="space-y-6">
    <div><p className="brand-chip border-white/25 bg-white/10 text-slate-100"><Building2 className="size-3.5 text-cyan-300" />Cuenta activa</p><h1 className="brand-heading mt-3 text-3xl text-white">Perfil de cuenta</h1><p className="mt-1 text-sm text-slate-200">Datos comerciales, fiscales y de contacto usados en tu espacio.</p></div>
    <Card className="brand-surface"><CardHeader><CardTitle>Información de la cuenta</CardTitle><CardDescription>{account ? `ID ${account.accountId}` : "Completa el perfil para comenzar"}</CardDescription></CardHeader><CardContent><AccountForm account={account} /></CardContent></Card>
  </div>;
}
