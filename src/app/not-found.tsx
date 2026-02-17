import Link from "next/link";
import { AlertTriangle } from "lucide-react";

import { BrandMark } from "@/components/brand/brand-mark";
import { Button } from "@/components/ui/button";

export default function NotFoundPage() {
  return (
    <main className="brand-page-bg min-h-screen px-6 py-8">
      <div className="mx-auto w-full max-w-5xl">
        <header className="flex items-center justify-between">
          <BrandMark tone="dark" />
          <Button asChild variant="outline" size="sm" className="border-white/25 bg-white/10 text-slate-100 hover:bg-white/20">
            <Link href="/pricing">Pricing</Link>
          </Button>
        </header>

        <section className="mx-auto mt-20 max-w-2xl brand-panel p-10 text-center text-slate-100">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-white/20 bg-white/10">
            <AlertTriangle className="h-5 w-5 text-amber-300" />
          </div>
          <p className="mt-6 text-xs font-semibold uppercase tracking-[0.22em] text-slate-300">404</p>
          <h1 className="brand-heading mt-3 text-4xl">Pagina no encontrada</h1>
          <p className="mt-3 text-sm text-slate-300">
            La ruta que intentaste abrir no existe o fue movida.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild className="bg-white text-slate-900 hover:bg-slate-100">
              <Link href="/invoices">Ir a Invoices</Link>
            </Button>
            <Button asChild variant="outline" className="border-white/30 bg-white/10 text-white hover:bg-white/20">
              <Link href="/login">Volver a Login</Link>
            </Button>
          </div>
        </section>
      </div>
    </main>
  );
}
