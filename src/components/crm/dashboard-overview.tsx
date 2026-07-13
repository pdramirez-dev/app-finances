"use client";

import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Banknote,
  CalendarDays,
  Check,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  FileText,
  Plus,
  ReceiptText,
  Sparkles,
  Target,
  TrendingUp,
  UsersRound,
} from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CrmSummary } from "@/lib/appsync/crm";

const metrics = [
  {
    label: "Pipeline activo",
    value: "$184,500",
    note: "+12.4% vs. mes anterior",
    positive: true,
    icon: Target,
    accent: "bg-cyan-50 text-cyan-700",
  },
  {
    label: "Pendiente por cobrar",
    value: "$68,250",
    note: "5 facturas abiertas",
    positive: null,
    icon: ReceiptText,
    accent: "bg-amber-50 text-amber-700",
  },
  {
    label: "Cobrado este mes",
    value: "$94,820",
    note: "+8.1% vs. mes anterior",
    positive: true,
    icon: CircleDollarSign,
    accent: "bg-emerald-50 text-emerald-700",
  },
  {
    label: "Ciclo medio de cobro",
    value: "23 días",
    note: "4 días más rápido",
    positive: true,
    icon: Clock3,
    accent: "bg-blue-50 text-blue-700",
  },
];

const revenue = [
  { month: "Feb", collected: 58, target: 68 },
  { month: "Mar", collected: 71, target: 72 },
  { month: "Abr", collected: 66, target: 76 },
  { month: "May", collected: 83, target: 80 },
  { month: "Jun", collected: 88, target: 86 },
  { month: "Jul", collected: 95, target: 92 },
];

const stages = [
  { name: "Contacto inicial", count: 3, value: "$38.4k", width: 42, color: "bg-slate-300" },
  { name: "Calificado", count: 4, value: "$76k", width: 72, color: "bg-cyan-400" },
  { name: "Propuesta", count: 2, value: "$42.8k", width: 54, color: "bg-blue-500" },
  { name: "Negociación", count: 1, value: "$31.5k", width: 36, color: "bg-emerald-500" },
];

const initialPriorities = [
  { id: 1, time: "09:30", title: "Llamar a Northline Logistics", meta: "Oportunidad · $42,800" },
  { id: 2, time: "11:00", title: "Revisar propuesta Harborview", meta: "Propuesta comercial" },
  { id: 3, time: "14:00", title: "Enviar factura #1048", meta: "Northline · $24,500" },
  { id: 4, time: "16:30", title: "Confirmar cuadrilla Greenridge", meta: "Proyecto Solar Q3" },
];

const invoices = [
  { id: "#1046", client: "MetroCare Facilities", due: "8 días vencida", total: "$12,800", urgent: true },
  { id: "#1048", client: "Northline Logistics", due: "Vence en 6 días", total: "$24,500", urgent: false },
  { id: "#1049", client: "Greenridge Properties", due: "Vence en 11 días", total: "$18,750", urgent: false },
];

export function DashboardOverview({ firstName, summary }: { firstName: string; summary: CrmSummary }) {
  const [completed, setCompleted] = useState<number[]>([]);
  const [period, setPeriod] = useState("Este mes");
  const liveMetrics = [
    { ...metrics[0], value: new Intl.NumberFormat("en-US", { style: "currency", currency: summary.currency, maximumFractionDigits: 0 }).format(summary.openPipelineValue), note: `${summary.openOpportunities} oportunidades abiertas` },
    { ...metrics[1], label: "Cobros por conciliar", value: new Intl.NumberFormat("en-US", { style: "currency", currency: summary.currency, maximumFractionDigits: 0 }).format(summary.unreconciledAmount), note: `${summary.unreconciledPayments} movimientos pendientes` },
    { ...metrics[2], label: "Proyectos activos", value: String(summary.activeProjects), note: `${summary.totalClients} clientes en el CRM` },
    { ...metrics[3], label: "Tareas pendientes", value: String(summary.pendingTasks), note: `${summary.overdueTasks} vencidas` },
  ];

  function togglePriority(id: number) {
    setCompleted((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  return (
    <div className="space-y-6 pb-8">
      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-500">
            <Sparkles className="size-4 text-cyan-600" />
            Centro operativo
          </div>
          <h1 className="brand-heading text-3xl text-slate-950 md:text-4xl">Buenos días, {firstName}</h1>
          <p className="mt-2 text-sm text-slate-500">Esto es lo que requiere tu atención hoy, 12 de julio.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="sr-only" htmlFor="dashboard-period">Periodo</label>
          <select
            id="dashboard-period"
            value={period}
            onChange={(event) => setPeriod(event.target.value)}
            className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
          >
            <option>Este mes</option>
            <option>Últimos 30 días</option>
            <option>Este trimestre</option>
          </select>
          <Button asChild className="h-10 rounded-lg bg-[#0a1226] px-4 text-white shadow-sm hover:bg-[#162448]">
            <Link href="/pipeline"><Plus />Nueva oportunidad</Link>
          </Button>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Indicadores principales">
        {liveMetrics.map((metric) => (
          <Card key={metric.label} className="gap-4 rounded-2xl border-slate-200 bg-white py-5 shadow-sm">
            <CardContent className="px-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-slate-500">{metric.label}</p>
                  <p className="brand-heading mt-2 text-2xl text-slate-950">{metric.value}</p>
                </div>
                <span className={`flex size-10 items-center justify-center rounded-xl ${metric.accent}`}>
                  <metric.icon className="size-5" />
                </span>
              </div>
              <p className={`mt-4 flex items-center gap-1.5 text-xs font-medium ${metric.positive ? "text-emerald-700" : "text-slate-500"}`}>
                {metric.positive ? <TrendingUp className="size-3.5" /> : null}
                {metric.note}
              </p>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.8fr)]">
        <Card className="gap-4 rounded-2xl border-slate-200 py-5 shadow-sm">
          <CardHeader className="flex-row items-start justify-between gap-4 px-5">
            <div>
              <CardTitle className="brand-heading text-lg">Ingresos cobrados</CardTitle>
              <p className="mt-1 text-sm text-slate-500">Cobrado frente al objetivo mensual</p>
            </div>
            <div className="text-right">
              <p className="brand-heading text-2xl text-slate-950">$460,820</p>
              <p className="mt-1 flex items-center justify-end gap-1 text-xs font-semibold text-emerald-700"><ArrowUpRight className="size-3.5" />14.2%</p>
            </div>
          </CardHeader>
          <CardContent className="px-5">
            <div className="relative flex h-56 items-end gap-3 border-b border-slate-200 pt-6 sm:gap-5">
              <div className="pointer-events-none absolute inset-x-0 top-6 border-t border-dashed border-slate-200" />
              <div className="pointer-events-none absolute inset-x-0 top-[42%] border-t border-dashed border-slate-200" />
              <div className="pointer-events-none absolute inset-x-0 top-[70%] border-t border-dashed border-slate-200" />
              {revenue.map((item) => (
                <div key={item.month} className="relative z-10 flex h-full flex-1 flex-col items-center justify-end gap-2">
                  <div className="relative flex w-full max-w-12 items-end justify-center" style={{ height: `${item.target}%` }}>
                    <div className="absolute inset-x-0 bottom-0 h-full rounded-t-md bg-slate-100" title={`Objetivo $${item.target}k`} />
                    <div className="absolute inset-x-1 bottom-0 rounded-t-md bg-[#0a1226] transition-all hover:bg-cyan-600" style={{ height: `${(item.collected / item.target) * 100}%` }} title={`Cobrado $${item.collected}k`} />
                  </div>
                  <span className="text-xs font-medium text-slate-500">{item.month}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center gap-5 text-xs text-slate-500">
              <span className="flex items-center gap-2"><i className="size-2.5 rounded-sm bg-[#0a1226]" />Cobrado</span>
              <span className="flex items-center gap-2"><i className="size-2.5 rounded-sm bg-slate-200" />Objetivo</span>
            </div>
          </CardContent>
        </Card>

        <Card className="gap-4 rounded-2xl border-slate-200 py-5 shadow-sm">
          <CardHeader className="flex-row items-center justify-between px-5">
            <div>
              <CardTitle className="brand-heading text-lg">Pipeline comercial</CardTitle>
              <p className="mt-1 text-sm text-slate-500">10 oportunidades · $188.7k</p>
            </div>
            <Button asChild variant="ghost" size="sm" className="text-slate-600"><Link href="/pipeline">Ver todo<ArrowRight /></Link></Button>
          </CardHeader>
          <CardContent className="space-y-5 px-5">
            {stages.map((stage) => (
              <div key={stage.name}>
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="font-medium text-slate-700">{stage.name} <span className="text-slate-400">({stage.count})</span></span>
                  <span className="font-semibold text-slate-950">{stage.value}</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100">
                  <div className={`h-2 rounded-full ${stage.color}`} style={{ width: `${stage.width}%` }} />
                </div>
              </div>
            ))}
            <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Conversión estimada</p>
              <div className="mt-1 flex items-end justify-between"><strong className="brand-heading text-2xl text-emerald-950">32.8%</strong><span className="text-xs font-medium text-emerald-700">+3.4 pts</span></div>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card className="gap-3 rounded-2xl border-slate-200 py-5 shadow-sm">
          <CardHeader className="flex-row items-center justify-between px-5">
            <div>
              <CardTitle className="brand-heading text-lg">Prioridades de hoy</CardTitle>
              <p className="mt-1 text-sm text-slate-500">{completed.length} de {initialPriorities.length} completadas</p>
            </div>
            <CalendarDays className="size-5 text-slate-400" />
          </CardHeader>
          <CardContent className="px-5">
            <div className="divide-y divide-slate-100">
              {initialPriorities.map((item) => {
                const done = completed.includes(item.id);
                return (
                  <button key={item.id} onClick={() => togglePriority(item.id)} className="group flex w-full items-center gap-3 py-3 text-left" aria-pressed={done}>
                    <span className={`flex size-5 shrink-0 items-center justify-center rounded-full border transition ${done ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300 bg-white group-hover:border-cyan-500"}`}>
                      {done ? <Check className="size-3" /> : null}
                    </span>
                    <span className="w-11 shrink-0 text-xs font-semibold text-slate-400">{item.time}</span>
                    <span className="min-w-0 flex-1">
                      <span className={`block truncate text-sm font-medium ${done ? "text-slate-400 line-through" : "text-slate-800"}`}>{item.title}</span>
                      <span className="mt-0.5 block truncate text-xs text-slate-400">{item.meta}</span>
                    </span>
                  </button>
                );
              })}
            </div>
            <Button asChild variant="ghost" className="mt-2 w-full justify-center text-slate-600"><Link href="/tasks">Ver todas las tareas<ArrowRight /></Link></Button>
          </CardContent>
        </Card>

        <Card className="gap-3 rounded-2xl border-slate-200 py-5 shadow-sm">
          <CardHeader className="flex-row items-center justify-between px-5">
            <div>
              <CardTitle className="brand-heading text-lg">Facturas que requieren atención</CardTitle>
              <p className="mt-1 text-sm text-slate-500">$56,050 en saldo abierto</p>
            </div>
            <FileText className="size-5 text-slate-400" />
          </CardHeader>
          <CardContent className="px-5">
            <div className="divide-y divide-slate-100">
              {invoices.map((invoice) => (
                <div key={invoice.id} className="flex items-center gap-3 py-3">
                  <span className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${invoice.urgent ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-700"}`}><FileText className="size-4" /></span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2"><p className="truncate text-sm font-semibold text-slate-850">{invoice.client}</p><span className="text-xs text-slate-400">{invoice.id}</span></div>
                    <p className={`mt-0.5 text-xs font-medium ${invoice.urgent ? "text-red-600" : "text-slate-500"}`}>{invoice.due}</p>
                  </div>
                  <p className="text-sm font-semibold text-slate-900">{invoice.total}</p>
                  <Button variant="outline" size="sm" className="hidden rounded-lg border-slate-200 bg-white sm:inline-flex">Recordar</Button>
                </div>
              ))}
            </div>
            <Button asChild variant="ghost" className="mt-2 w-full justify-center text-slate-600"><Link href="/invoices">Gestionar facturas<ArrowRight /></Link></Button>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <Card className="gap-3 rounded-2xl border-slate-200 py-5 shadow-sm">
          <CardHeader className="px-5"><CardTitle className="brand-heading text-lg">Actividad reciente</CardTitle></CardHeader>
          <CardContent className="grid gap-4 px-5 sm:grid-cols-3">
            {[
              { icon: UsersRound, text: "María movió Harborview a Negociación", time: "Hace 18 min", tone: "bg-cyan-50 text-cyan-700" },
              { icon: FileText, text: "Northline abrió la factura #1046", time: "Hace 1 h", tone: "bg-blue-50 text-blue-700" },
              { icon: CheckCircle2, text: "Pago de $18,750 confirmado", time: "Hace 3 h", tone: "bg-emerald-50 text-emerald-700" },
            ].map((activity) => (
              <div key={activity.text} className="flex items-start gap-3 rounded-xl bg-slate-50 p-3">
                <span className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${activity.tone}`}><activity.icon className="size-4" /></span>
                <div><p className="text-sm font-medium leading-snug text-slate-700">{activity.text}</p><p className="mt-1 text-xs text-slate-400">{activity.time}</p></div>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card className="overflow-hidden gap-0 rounded-2xl border-0 bg-[#0a1226] py-0 text-white shadow-sm">
          <CardContent className="relative px-5 py-5">
            <div className="absolute -right-8 -top-8 size-32 rounded-full bg-cyan-400/20 blur-2xl" />
            <Banknote className="size-7 text-cyan-300" />
            <p className="brand-heading mt-6 text-xl">Cierre de julio</p>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">Estás al 87% del objetivo. Faltan $14,180 para superarlo.</p>
            <div className="mt-4 h-1.5 rounded-full bg-white/10"><div className="h-full w-[87%] rounded-full bg-cyan-400" /></div>
            <Button asChild variant="outline" size="sm" className="mt-5 border-white/20 bg-white/10 text-white hover:bg-white/15 hover:text-white"><Link href="/reports">Ver proyección<ArrowRight /></Link></Button>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
