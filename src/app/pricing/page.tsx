import Link from "next/link";
import { ArrowRight, Check, ShieldCheck, Sparkles, Zap } from "lucide-react";

import { BrandMark } from "@/components/brand/brand-mark";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Plan = {
  name: string;
  monthlyPrice: number;
  annualMonthlyPrice: number;
  annualTotal: number;
  description: string;
  audience: string;
  features: string[];
  highlighted?: boolean;
};

const plans: Plan[] = [
  {
    name: "Inicial",
    monthlyPrice: 19,
    annualMonthlyPrice: 15,
    annualTotal: 180,
    description: "Lo esencial para organizar clientes y empezar a facturar.",
    audience: "Profesionales independientes",
    features: [
      "1 usuario incluido",
      "Hasta 40 facturas al mes",
      "Contactos y oportunidades",
      "Facturas y exportación en PDF",
      "Soporte por correo electrónico",
    ],
  },
  {
    name: "Negocio",
    monthlyPrice: 49,
    annualMonthlyPrice: 39,
    annualTotal: 468,
    description: "El CRM completo para gestionar la operación diaria de tu equipo.",
    audience: "Pequeñas empresas en crecimiento",
    highlighted: true,
    features: [
      "3 usuarios incluidos",
      "Facturas ilimitadas",
      "Proyectos, tareas y calendario",
      "Reportes y seguimiento de cobros",
      "Recordatorios de pago",
    ],
  },
  {
    name: "Empresa",
    monthlyPrice: 99,
    annualMonthlyPrice: 79,
    annualTotal: 948,
    description: "Más control, permisos y capacidad para operaciones consolidadas.",
    audience: "Equipos con varias áreas o proyectos",
    features: [
      "10 usuarios incluidos",
      "Roles, permisos y auditoría",
      "Gestión de múltiples proyectos",
      "Reportes y exportaciones avanzadas",
      "Soporte prioritario",
    ],
  },
];

const comparison = [
  { feature: "Usuarios incluidos", values: ["1", "3", "10"] },
  { feature: "Facturas mensuales", values: ["40", "Ilimitadas", "Ilimitadas"] },
  { feature: "CRM de clientes", values: ["Incluido", "Incluido", "Incluido"] },
  { feature: "Proyectos y tareas", values: ["—", "Incluido", "Incluido"] },
  { feature: "Roles y permisos", values: ["—", "Básicos", "Avanzados"] },
  { feature: "Reportes", values: ["Básicos", "Completos", "Avanzados"] },
  { feature: "Soporte", values: ["Correo", "Prioritario", "Prioritario"] },
];

const addOns = [
  { name: "Usuario adicional", price: "+$8 USD al mes" },
  { name: "Configuración asistida", price: "$199 USD, pago único" },
  { name: "Marca personalizada", price: "+$79 USD al mes" },
];

const faq = [
  {
    question: "¿La prueba gratis requiere tarjeta?",
    answer: "No. Puedes probar todas las funciones del plan Negocio durante 14 días sin ingresar una tarjeta.",
  },
  {
    question: "¿Puedo cambiar de plan?",
    answer: "Sí. Puedes subir o bajar de plan cuando cambien las necesidades de tu equipo.",
  },
  {
    question: "¿Qué ocurre si alcanzo un límite?",
    answer: "Te avisaremos antes de llegar al límite para que puedas cambiar de plan sin interrumpir tu operación.",
  },
  {
    question: "¿Cómo funciona el pago anual?",
    answer: "Se cobra el año completo por adelantado y obtienes aproximadamente dos meses de ahorro frente al pago mensual.",
  },
];

export default function PricingPage() {
  return (
    <main className="brand-page-bg min-h-screen text-slate-950">
      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 md:px-8 md:py-10">
        <header className="flex items-center justify-between gap-3">
          <BrandMark tone="dark" />
          <nav className="flex items-center gap-2" aria-label="Acceso a la aplicación">
            <Button
              asChild
              variant="outline"
              size="sm"
              className="hidden border-white/25 bg-white/10 text-slate-100 hover:bg-white/20 hover:text-white sm:inline-flex"
            >
              <Link href="/login">Iniciar sesión</Link>
            </Button>
            <Button asChild size="sm" className="bg-white text-slate-950 hover:bg-slate-100">
              <Link href="/login">
                Probar gratis
                <ArrowRight className="size-3.5" />
              </Link>
            </Button>
          </nav>
        </header>

        <section className="mx-auto mt-14 max-w-3xl text-center md:mt-20">
          <Badge className="border-cyan-200/25 bg-cyan-300/10 text-cyan-100 hover:bg-cyan-300/10">
            14 días gratis · Sin tarjeta
          </Badge>
          <h1 className="brand-heading mt-5 text-balance text-4xl leading-tight text-white md:text-6xl">
            Un plan claro para cada etapa de tu empresa
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-pretty text-base leading-7 text-slate-200 md:text-lg">
            Centraliza clientes, ventas, proyectos, facturación y cobros. Empieza con lo necesario y amplía tu plan cuando tu equipo crezca.
          </p>
          <p className="mt-3 text-sm text-slate-400">Precios en USD. Impuestos no incluidos.</p>
        </section>

        <section className="mt-10 grid items-stretch gap-5 lg:mt-14 lg:grid-cols-3" aria-label="Planes disponibles">
          {plans.map((plan) => {
            const annualSavings = plan.monthlyPrice * 12 - plan.annualTotal;

            return (
              <Card
                key={plan.name}
                className={
                  plan.highlighted
                    ? "relative flex h-full flex-col border-cyan-300 bg-white shadow-2xl shadow-cyan-950/25 lg:-translate-y-2"
                    : "flex h-full flex-col border-white/35 bg-white/95 shadow-xl shadow-slate-950/15"
                }
              >
                {plan.highlighted ? (
                  <div className="absolute inset-x-0 top-0 h-1 rounded-t-xl bg-gradient-to-r from-cyan-400 to-blue-500" />
                ) : null}
                <CardHeader className="pb-4">
                  <div className="flex min-h-7 items-center justify-between gap-3">
                    <CardTitle className="text-xl">{plan.name}</CardTitle>
                    {plan.highlighted ? (
                      <Badge className="bg-slate-950 text-white hover:bg-slate-950">
                        <Sparkles className="size-3" />
                        Más elegido
                      </Badge>
                    ) : null}
                  </div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-cyan-700">{plan.audience}</p>
                  <CardDescription className="min-h-10 leading-5">{plan.description}</CardDescription>
                </CardHeader>
                <CardContent className="flex-1 space-y-5">
                  <div>
                    <div className="flex items-end gap-1">
                      <span className="text-4xl font-bold tracking-tight">${plan.monthlyPrice}</span>
                      <span className="pb-1 text-sm text-muted-foreground">USD / mes</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">Pago mensual, cancela cuando quieras.</p>
                  </div>

                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-sm text-emerald-950">
                    <p>
                      <span className="font-bold">${plan.annualMonthlyPrice} USD / mes</span> con pago anual
                    </p>
                    <p className="mt-0.5 text-xs text-emerald-700">
                      ${plan.annualTotal} al año · Ahorras ${annualSavings}
                    </p>
                  </div>

                  <Separator />
                  <div>
                    <p className="mb-3 text-sm font-semibold text-slate-900">Incluye:</p>
                    <ul className="space-y-2.5 text-sm text-slate-700">
                      {plan.features.map((feature) => (
                        <li key={feature} className="flex items-start gap-2.5">
                          <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-cyan-50">
                            <Check className="size-3.5 text-cyan-700" aria-hidden="true" />
                          </span>
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </CardContent>
                <CardFooter className="pt-6">
                  <Button
                    asChild
                    size="lg"
                    className={plan.highlighted ? "w-full bg-slate-950 text-white hover:bg-slate-800" : "w-full"}
                    variant={plan.highlighted ? "default" : "outline"}
                  >
                    <Link href="/login">
                      Probar {plan.name} gratis
                      <ArrowRight className="size-4" />
                    </Link>
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </section>

        <section className="mt-10 rounded-2xl border border-white/20 bg-white/10 px-5 py-5 text-white backdrop-blur-sm md:px-7">
          <div className="grid gap-4 text-sm sm:grid-cols-3">
            {["Prueba gratis por 14 días", "Sin permanencia ni cargos ocultos", "Tus datos protegidos"].map((benefit) => (
              <div key={benefit} className="flex items-center gap-2.5">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-cyan-300/15">
                  <Check className="size-4 text-cyan-200" aria-hidden="true" />
                </span>
                <span className="font-medium text-slate-100">{benefit}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-14" aria-labelledby="comparison-title">
          <Card className="overflow-hidden border-white/35 bg-white/95 shadow-xl shadow-slate-950/15">
            <CardHeader>
              <CardTitle id="comparison-title" className="text-2xl">Compara los planes</CardTitle>
              <CardDescription>Encuentra rápidamente las funciones que necesita tu equipo.</CardDescription>
            </CardHeader>
            <CardContent className="px-0 pb-0 sm:px-6 sm:pb-6">
              <Table className="min-w-[660px]">
                <TableCaption className="sr-only">Comparación detallada de los planes Inicial, Negocio y Empresa.</TableCaption>
                <TableHeader>
                  <TableRow className="bg-slate-50 hover:bg-slate-50">
                    <TableHead className="w-[36%] px-4 sm:px-3">Función</TableHead>
                    {plans.map((plan) => (
                      <TableHead key={plan.name} className={plan.highlighted ? "bg-cyan-50/70 font-bold text-cyan-900" : "font-bold text-slate-900"}>
                        {plan.name}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {comparison.map((row) => (
                    <TableRow key={row.feature}>
                      <TableCell className="px-4 font-medium text-slate-700 sm:px-3">{row.feature}</TableCell>
                      {row.values.map((value, index) => (
                        <TableCell
                          key={`${row.feature}-${plans[index].name}`}
                          className={plans[index].highlighted ? "bg-cyan-50/40 font-medium text-slate-900" : "text-slate-600"}
                        >
                          {value}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <p className="px-4 pb-4 pt-3 text-xs text-slate-500 sm:hidden">Desliza horizontalmente para comparar todos los planes.</p>
            </CardContent>
          </Card>
        </section>

        <section className="mt-14 grid gap-5 md:grid-cols-2">
          <Card className="border-white/35 bg-white/95 shadow-xl shadow-slate-950/15">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="size-5 text-amber-500" aria-hidden="true" />
                Servicios opcionales
              </CardTitle>
              <CardDescription>Añade capacidad sin tener que cambiar de plan.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2.5 text-sm">
              {addOns.map((item) => (
                <div key={item.name} className="flex flex-col gap-1 rounded-lg border border-slate-200 px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <span className="font-medium text-slate-700">{item.name}</span>
                  <span className="font-semibold text-slate-950">{item.price}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-white/35 bg-white/95 shadow-xl shadow-slate-950/15">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="size-5 text-blue-600" aria-hidden="true" />
                Cobros en línea
              </CardTitle>
              <CardDescription>Solo pagas esta tarifa cuando cobras una factura en línea.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-200 p-4">
                <p className="text-3xl font-bold tracking-tight">0.7%</p>
                <p className="mt-1 text-sm leading-5 text-muted-foreground">por factura cobrada, adicional a la comisión del procesador.</p>
              </div>
              <div className="rounded-xl border border-slate-200 p-4">
                <p className="text-lg font-bold">Máximo $15 USD</p>
                <p className="mt-1 text-sm leading-5 text-muted-foreground">de tarifa de plataforma por transacción.</p>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="mt-14" aria-labelledby="faq-title">
          <div className="text-center text-white">
            <h2 id="faq-title" className="brand-heading text-3xl">Preguntas frecuentes</h2>
            <p className="mt-2 text-slate-300">Lo importante antes de elegir tu plan.</p>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {faq.map((item) => (
              <Card key={item.question} className="border-white/35 bg-white/95 shadow-lg shadow-slate-950/10">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base leading-6">{item.question}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-6 text-muted-foreground">{item.answer}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="mt-14 rounded-2xl border border-cyan-200/25 bg-gradient-to-r from-cyan-300/15 to-blue-400/10 p-7 text-center text-white shadow-xl backdrop-blur md:p-10">
          <h2 className="brand-heading text-3xl">Empieza a organizar tu empresa hoy</h2>
          <p className="mx-auto mt-3 max-w-xl leading-7 text-slate-200">
            Prueba el plan Negocio durante 14 días. Sin tarjeta, sin compromiso y con todas sus funciones.
          </p>
          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="w-full bg-white text-slate-950 hover:bg-slate-100 sm:w-auto">
              <Link href="/login">
                Comenzar prueba gratis
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="w-full border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white sm:w-auto">
              <Link href="/login">Ya tengo una cuenta</Link>
            </Button>
          </div>
        </section>

        <footer className="pb-2 pt-8 text-center text-xs text-slate-400">
          Los precios y funciones pueden cambiar. Consulta las condiciones aplicables antes de contratar.
        </footer>
      </div>
    </main>
  );
}
