import { AccountForm } from "@/components/workspace/forms";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function OnboardingPage() {
  return <div className="mx-auto max-w-2xl space-y-6"><div className="text-center"><p className="text-sm font-semibold uppercase tracking-widest text-cyan-300">Primer paso</p><h1 className="brand-heading mt-2 text-4xl text-white">Configura tu espacio</h1><p className="mt-2 text-slate-200">Elige cómo trabajas y añade los datos básicos de tu negocio.</p></div><Card className="brand-surface"><CardHeader><CardTitle>Tu cuenta</CardTitle><CardDescription>Podrás modificar estos datos más adelante.</CardDescription></CardHeader><CardContent><AccountForm onboarding /></CardContent></Card></div>;
}
