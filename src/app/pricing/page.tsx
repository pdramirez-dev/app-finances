import Link from "next/link";
import { Check, ShieldCheck, Zap } from "lucide-react";

import { BrandMark } from "@/components/brand/brand-mark";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Plan = {
  name: string;
  monthly: string;
  annual: string;
  description: string;
  features: string[];
  highlighted?: boolean;
};

const plans: Plan[] = [
  {
    name: "Starter",
    monthly: "$19",
    annual: "$15",
    description: "Ideal para comenzar y facturar con control.",
    features: [
      "1 usuario",
      "Hasta 40 invoices/mes",
      "Exportación PDF",
      "Plantilla base",
      "Soporte por email",
    ],
  },
  {
    name: "Pro",
    monthly: "$49",
    annual: "$39",
    description: "Plan recomendado para operación diaria de equipos.",
    highlighted: true,
    features: [
      "3 usuarios",
      "Invoices ilimitadas",
      "Branding con logo",
      "Estados + reportes básicos",
      "Recordatorios de pago",
    ],
  },
  {
    name: "Team",
    monthly: "$99",
    annual: "$79",
    description: "Para compañías con múltiples proyectos y supervisión.",
    features: [
      "10 usuarios",
      "Roles y permisos",
      "Multi-proyecto",
      "Exportaciones avanzadas",
      "Soporte prioritario",
    ],
  },
];

const addOns = [
  { name: "Usuario adicional", price: "+$8/mes por usuario" },
  { name: "Onboarding y setup", price: "$199 pago único" },
  { name: "White-label", price: "+$79/mes" },
];

const faq = [
  {
    q: "¿Hay prueba gratis?",
    a: "Sí. Incluye 14 días sin tarjeta para validar el flujo completo de facturación.",
  },
  {
    q: "¿Qué pasa si supero el límite del plan Starter?",
    a: "Te avisamos al 80% del límite y podrás hacer upgrade inmediato al plan Pro.",
  },
  {
    q: "¿Puedo pagar anual?",
    a: "Sí. El pago anual aplica 20% de descuento frente al precio mensual.",
  },
];

export default function PricingPage() {
  return (
    <main className="brand-page-bg min-h-screen">
      <div className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8 md:py-12">
        <header className="flex items-center justify-between gap-3">
          <BrandMark tone="dark" />
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm" className="border-white/25 bg-white/10 text-slate-100 hover:bg-white/20">
              <Link href="/login">Login</Link>
            </Button>
            <Button asChild size="sm" className="bg-white text-slate-900 hover:bg-slate-100">
              <Link href="/invoices">Abrir App</Link>
            </Button>
          </div>
        </header>

        <section className="mt-12 text-center">
          <Badge className="border-white/20 bg-white/10 text-slate-100 hover:bg-white/10">Pricing 2026</Badge>
          <h1 className="brand-heading mt-4 text-4xl text-white md:text-5xl">Planes claros para facturar mejor</h1>
          <p className="mx-auto mt-4 max-w-2xl text-slate-200">
            Modelo SaaS con enfoque en equipos de campo y generación de invoices tipo crew. Precios en USD.
          </p>
        </section>

        <section className="mt-10 grid gap-4 md:grid-cols-3">
          {plans.map((plan) => (
            <Card
              key={plan.name}
              className={
                plan.highlighted
                  ? "border-cyan-300 bg-white shadow-xl shadow-cyan-900/20"
                  : "border-white/40 bg-white/95 shadow-lg shadow-slate-950/10"
              }
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{plan.name}</CardTitle>
                  {plan.highlighted ? (
                    <Badge className="bg-[#14233f] text-white hover:bg-[#14233f]">Recomendado</Badge>
                  ) : null}
                </div>
                <CardDescription>{plan.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1">
                  <p className="text-3xl font-bold">{plan.monthly}</p>
                  <p className="text-sm text-muted-foreground">por mes</p>
                </div>
                <p className="rounded-md bg-slate-100 px-3 py-2 text-sm">
                  Anual: <span className="font-semibold">{plan.annual}/mes</span>
                </p>
                <Separator />
                <ul className="space-y-2 text-sm">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <Check className="mt-0.5 size-4 text-emerald-600" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                <Button
                  asChild
                  className={plan.highlighted ? "w-full bg-[#0a1226] text-white hover:bg-[#162448]" : "w-full"}
                  variant={plan.highlighted ? "default" : "outline"}
                >
                  <Link href="/login">Comenzar</Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </section>

        <section className="mt-12 grid gap-4 md:grid-cols-2">
          <Card className="border-white/40 bg-white/95 shadow-lg shadow-slate-950/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="size-4 text-amber-500" />
                Add-ons
              </CardTitle>
              <CardDescription>Extensiones para crecer sin cambiar de plan.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {addOns.map((item) => (
                <div key={item.name} className="flex items-center justify-between rounded-md border px-3 py-2">
                  <span>{item.name}</span>
                  <span className="font-semibold">{item.price}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-white/40 bg-white/95 shadow-lg shadow-slate-950/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-blue-600" />
                Cobros en línea
              </CardTitle>
              <CardDescription>Al activar pasarela de pagos, aplica fee de plataforma.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="rounded-lg border p-4">
                <p className="text-2xl font-bold">0.7%</p>
                <p className="text-muted-foreground">Por invoice pagada (adicional al fee del procesador).</p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="font-semibold">Tope por transacción: $15</p>
                <p className="text-muted-foreground">Protege tickets altos y mejora previsibilidad del costo.</p>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="mt-12">
          <Card className="border-white/40 bg-white/95 shadow-lg shadow-slate-950/10">
            <CardHeader>
              <CardTitle>Comparativa rápida</CardTitle>
              <CardDescription>Resumen por plan para decisión comercial.</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Feature</TableHead>
                    <TableHead>Starter</TableHead>
                    <TableHead>Pro</TableHead>
                    <TableHead>Team</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell>Usuarios incluidos</TableCell>
                    <TableCell>1</TableCell>
                    <TableCell>3</TableCell>
                    <TableCell>10</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Invoices / mes</TableCell>
                    <TableCell>40</TableCell>
                    <TableCell>Ilimitadas</TableCell>
                    <TableCell>Ilimitadas</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Reportes</TableCell>
                    <TableCell>Básicos</TableCell>
                    <TableCell>Básicos + estados</TableCell>
                    <TableCell>Avanzados</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Soporte</TableCell>
                    <TableCell>Email</TableCell>
                    <TableCell>Prioritario</TableCell>
                    <TableCell>Prioritario</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </section>

        <section className="mt-12 grid gap-4 md:grid-cols-3">
          {faq.map((item) => (
            <Card key={item.q} className="border-white/40 bg-white/95 shadow-lg shadow-slate-950/10">
              <CardHeader>
                <CardTitle className="text-base">{item.q}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{item.a}</p>
              </CardContent>
            </Card>
          ))}
        </section>

        <section className="mt-12 rounded-xl border border-white/25 bg-white/10 p-6 text-center text-slate-100 shadow-sm backdrop-blur">
          <h2 className="brand-heading text-2xl">Empieza con 14 días gratis</h2>
          <p className="mx-auto mt-2 max-w-xl text-slate-200">
            Activa el MVP, crea tu primera invoice y valida el flujo real con tu equipo.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Button asChild className="bg-white text-slate-900 hover:bg-slate-100">
              <Link href="/login">Iniciar prueba</Link>
            </Button>
            <Button asChild variant="outline" className="border-white/30 bg-white/10 text-white hover:bg-white/20">
              <Link href="/invoices">Ir a la app</Link>
            </Button>
          </div>
        </section>
      </div>
    </main>
  );
}
