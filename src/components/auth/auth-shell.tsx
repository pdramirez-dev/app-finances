import Link from "next/link";
import { ArrowRight, Building2, FileText, ShieldCheck, Sparkles } from "lucide-react";

import { BrandMark } from "@/components/brand/brand-mark";
import { Button } from "@/components/ui/button";

export function AuthShell({
  children,
  topActionHref = "/pricing",
  topActionLabel = "Pricing",
}: {
  children: React.ReactNode;
  topActionHref?: string;
  topActionLabel?: string;
}) {
  return (
    <main className="brand-page-bg relative min-h-screen overflow-hidden px-6 py-8">
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
        <section className="brand-panel p-8 text-slate-100 md:p-10">
          <p className="brand-chip border-white/20 bg-white/10 text-slate-200">
            <Sparkles className="h-3.5 w-3.5 text-cyan-300" />
            Lightning Workspace
          </p>
          <h1 className="brand-heading mt-5 max-w-2xl text-4xl leading-tight md:text-6xl">
            Control total de invoices para operaciones de campo.
          </h1>
          <p className="mt-5 max-w-xl text-sm leading-relaxed text-slate-300 md:text-base">
            Desde crew logs hasta PDF final, todo el ciclo en una sola plataforma: AppSync, DynamoDB y almacenamiento
            seguro en S3.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <article className="rounded-2xl border border-white/15 bg-white/5 p-5 backdrop-blur">
              <ShieldCheck className="h-5 w-5 text-emerald-300" />
              <p className="mt-3 text-sm font-semibold text-white">Acceso empresarial</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-300">
                Cognito con politicas fuertes y control por ambientes.
              </p>
            </article>
            <article className="rounded-2xl border border-white/15 bg-white/5 p-5 backdrop-blur">
              <FileText className="h-5 w-5 text-sky-300" />
              <p className="mt-3 text-sm font-semibold text-white">Formato unificado</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-300">
                PDF consistente por template con versionado y trazabilidad.
              </p>
            </article>
            <article className="rounded-2xl border border-white/15 bg-white/5 p-5 backdrop-blur sm:col-span-2">
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-orange-300" />
                <p className="text-sm font-semibold text-white">Pensado para crews, PMs y operaciones financieras</p>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-slate-300">
                Flujo de punta a punta para capturar costos, validar secciones y publicar invoices listos para cobro.
              </p>
            </article>
          </div>

          <div className="mt-8 inline-flex items-center gap-2 text-sm font-medium text-cyan-200">
            <span>Entrar al portal seguro</span>
            <ArrowRight className="h-4 w-4" />
          </div>
        </section>

        <section className="min-h-[420px]">{children}</section>
      </div>
    </main>
  );
}
