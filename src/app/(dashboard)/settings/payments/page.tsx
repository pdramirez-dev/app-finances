import { CreditCard, ShieldCheck } from "lucide-react";
import { BankForm } from "@/components/workspace/forms";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function PaymentsPage() {
  return <div className="space-y-6"><div><p className="flex items-center gap-2 text-sm font-medium text-cyan-700"><CreditCard className="size-4" />Configuración</p><h1 className="brand-heading mt-2 text-3xl text-slate-950">Datos de pago</h1><p className="mt-1 text-sm text-slate-500">Información bancaria que acompañará tus facturas.</p></div><Card className="rounded-2xl shadow-sm"><CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="size-5 text-emerald-600" />Cuenta bancaria protegida</CardTitle><CardDescription>Por seguridad, solo aceptamos identificadores enmascarados. Nunca guardes números completos.</CardDescription></CardHeader><CardContent><BankForm /></CardContent></Card></div>;
}
