import Link from "next/link";
import { ArrowRight, Building2, FileText, ShieldCheck, Sparkles } from "lucide-react";

import { BrandMark } from "@/components/brand/brand-mark";
import { Button } from "@/components/ui/button";

export function AuthShell({
  children,
  topActionHref = "/pricing",
  topActionLabel = "Ver planes",
}: {
  children: React.ReactNode;
  topActionHref?: string;
  topActionLabel?: string;
}) {
  return (
    <main className="brand-page-bg relative min-h-screen overflow-hidden px-4 py-6 sm:px-6 sm:py-8">
      <div className="relative mx-auto flex w-full max-w-6xl items-center justify-between">
        <BrandMark tone="dark" />
        <Button
          asChild
          variant="outline"
          size="sm"
          className="border-white/25 bg-white/10 text-slate-100 hover:bg-white/20"
        >
          <Link href={topActionHref}>{topActionLabel}</Link>
        </Button>
      </div>

      <div className="relative mx-auto mt-8 grid w-full max-w-6xl gap-8 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="brand-panel order-2 p-6 text-slate-100 sm:p-8 md:p-10 lg:order-1">
          <p className="brand-chip border-white/20 bg-white/10 text-slate-200">
            <Sparkles className="h-3.5 w-3.5 text-cyan-300" />
            Gestión empresarial conectada
          </p>
          <h1 className="brand-heading mt-5 max-w-2xl text-4xl leading-tight md:text-6xl">
            Tu empresa, en un solo lugar.
          </h1>
          <p className="mt-5 max-w-xl text-sm leading-relaxed text-slate-300 md:text-base">
            Organiza clientes, oportunidades, proyectos, tareas, facturación y cobros desde un espacio de trabajo claro
            para todo tu equipo.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <article className="rounded-2xl border border-white/15 bg-white/5 p-5 backdrop-blur">
              <ShieldCheck className="h-5 w-5 text-emerald-300" />
              <p className="mt-3 text-sm font-semibold text-white">Acceso protegido</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-300">
                Inicio de sesión seguro y verificación adicional cuando tu organización lo requiera.
              </p>
            </article>
            <article className="rounded-2xl border border-white/15 bg-white/5 p-5 backdrop-blur">
              <FileText className="h-5 w-5 text-sky-300" />
              <p className="mt-3 text-sm font-semibold text-white">Operación centralizada</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-300">
                Información comercial, proyectos y finanzas conectados de principio a fin.
              </p>
            </article>
            <article className="rounded-2xl border border-white/15 bg-white/5 p-5 backdrop-blur sm:col-span-2">
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-orange-300" />
                <p className="text-sm font-semibold text-white">Creado para equipos que quieren crecer con control</p>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-slate-300">
                Un flujo compartido para vender, ejecutar el trabajo, facturar y dar seguimiento a cada cobro.
              </p>
            </article>
          </div>

          <div className="mt-8 inline-flex items-center gap-2 text-sm font-medium text-cyan-200">
            <span>Entrar al portal seguro</span>
            <ArrowRight className="h-4 w-4" />
          </div>
        </section>

        <section className="order-1 min-h-[420px] lg:order-2">{children}</section>
      </div>
    </main>
  );
}
