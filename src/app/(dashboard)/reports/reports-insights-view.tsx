"use client";

import { useMemo, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  BriefcaseBusiness,
  Check,
  ChevronDown,
  CircleDollarSign,
  Download,
  Filter,
  Gauge,
  Lightbulb,
  PieChart,
  RefreshCw,
  Sparkles,
  TrendingUp,
  UsersRound,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { CrmSummary } from "@/lib/appsync/crm";

type Period = "Últimos 6 meses" | "Este trimestre" | "Este año";
type ReportScope = "Toda la empresa" | "Comercial" | "Operaciones";

const revenueSeries: Record<Period, { label: string; revenue: number; goal: number }[]> = {
  "Últimos 6 meses": [
    { label: "Feb", revenue: 21.4, goal: 24 }, { label: "Mar", revenue: 27.8, goal: 26 }, { label: "Abr", revenue: 25.2, goal: 28 },
    { label: "May", revenue: 32.6, goal: 30 }, { label: "Jun", revenue: 35.9, goal: 33 }, { label: "Jul", revenue: 42.1, goal: 36 },
  ],
  "Este trimestre": [
    { label: "Abr", revenue: 25.2, goal: 28 }, { label: "May", revenue: 32.6, goal: 30 }, { label: "Jun", revenue: 35.9, goal: 33 }, { label: "Jul", revenue: 42.1, goal: 36 },
  ],
  "Este año": [
    { label: "Ene", revenue: 19.8, goal: 22 }, { label: "Feb", revenue: 21.4, goal: 24 }, { label: "Mar", revenue: 27.8, goal: 26 },
    { label: "Abr", revenue: 25.2, goal: 28 }, { label: "May", revenue: 32.6, goal: 30 }, { label: "Jun", revenue: 35.9, goal: 33 }, { label: "Jul", revenue: 42.1, goal: 36 },
  ],
};

const teamRows = [
  { name: "Pablo Díaz", initials: "PD", role: "Dirección", clients: 14, projects: 6, revenue: 68400, goal: 94, color: "bg-blue-100 text-blue-700" },
  { name: "María Santos", initials: "MS", role: "Ventas", clients: 9, projects: 8, revenue: 47850, goal: 88, color: "bg-cyan-100 text-cyan-700" },
  { name: "Jordan Reed", initials: "JR", role: "Operaciones", clients: 11, projects: 5, revenue: 42100, goal: 82, color: "bg-rose-100 text-rose-700" },
  { name: "Alex Rivera", initials: "AR", role: "Proyectos", clients: 8, projects: 4, revenue: 26570, goal: 71, color: "bg-amber-100 text-amber-700" },
];

const expenses = [
  { name: "Equipo", value: 44, amount: "$51,920", color: "bg-blue-500" },
  { name: "Proveedores", value: 26, amount: "$30,680", color: "bg-cyan-500" },
  { name: "Marketing", value: 18, amount: "$21,240", color: "bg-amber-400" },
  { name: "Operaciones", value: 12, amount: "$14,160", color: "bg-rose-400" },
];

const scopeFactor: Record<ReportScope, number> = { "Toda la empresa": 1, Comercial: 0.64, Operaciones: 0.36 };
const money = new Intl.NumberFormat("es-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export function ReportsInsightsView({ crmSummary }: { crmSummary: CrmSummary }) {
  const [period, setPeriod] = useState<Period>("Últimos 6 meses");
  const [scope, setScope] = useState<ReportScope>("Toda la empresa");
  const [exported, setExported] = useState(false);
  const [updated, setUpdated] = useState(false);
  const series = revenueSeries[period];

  const summary = useMemo(() => {
    const factor = scopeFactor[scope];
    const revenue = crmSummary.invoicedAmount * factor;
    return {
      revenue,
      margin: crmSummary.grossMargin,
      pipeline: crmSummary.weightedPipelineValue * factor,
      conversion: crmSummary.conversionRate,
    };
  }, [crmSummary, scope]);

  function exportCsv() {
    const rows = ["mes,ingresos_objetivo,ingresos_reales", ...series.map((item) => `${item.label},${item.goal * 1000},${item.revenue * 1000}`)];
    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "reporte-crm.csv";
    anchor.click();
    URL.revokeObjectURL(url);
    setExported(true);
    window.setTimeout(() => setExported(false), 2200);
  }

  function refreshData() {
    setUpdated(true);
    window.setTimeout(() => setUpdated(false), 1800);
  }

  return (
    <>
      <Card className="brand-surface gap-0 py-0">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="flex flex-col gap-2 sm:flex-row">
            <ReportSelect icon={Filter} value={period} onChange={(value) => setPeriod(value as Period)} options={["Últimos 6 meses", "Este trimestre", "Este año"]} label="Periodo" />
            <ReportSelect icon={BriefcaseBusiness} value={scope} onChange={(value) => setScope(value as ReportScope)} options={["Toda la empresa", "Comercial", "Operaciones"]} label="Área" />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={refreshData} className={cn("flex-1 sm:flex-none", updated && "border-emerald-300 bg-emerald-50 text-emerald-700")}>
              {updated ? <Check /> : <RefreshCw />} {updated ? "Actualizado" : "Actualizar"}
            </Button>
            <Button size="sm" onClick={exportCsv} className={cn("flex-1 bg-slate-950 text-white hover:bg-slate-800 sm:flex-none", exported && "bg-emerald-600 hover:bg-emerald-600")}>
              {exported ? <Check /> : <Download />} {exported ? "Exportado" : "Exportar CSV"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Indicadores clave">
        <KpiCard icon={CircleDollarSign} label="Ingresos" value={money.format(summary.revenue)} change="12,8%" direction="up" context="vs. periodo anterior" tone="cyan" />
        <KpiCard icon={Gauge} label="Margen bruto" value={`${summary.margin.toLocaleString("es-ES")}%`} change="3,4 pts" direction="up" context="sobre ingresos" tone="blue" />
        <KpiCard icon={CircleDollarSign} label="Pipeline comercial" value={money.format(summary.pipeline)} change="8,1%" direction="up" context="valor ponderado" tone="amber" />
        <KpiCard icon={UsersRound} label="Conversión" value={`${summary.conversion.toLocaleString("es-ES")}%`} change="1,2 pts" direction="down" context="lead a cliente" tone="rose" />
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.65fr)_minmax(280px,0.75fr)]">
        <Card className="brand-surface gap-4">
          <CardHeader className="flex-row items-start justify-between gap-3">
            <div><CardTitle className="brand-heading text-lg">Evolución de ingresos</CardTitle><p className="mt-1 text-xs text-slate-500">Miles de dólares · {scope.toLocaleLowerCase("es")}</p></div>
            <div className="flex gap-3 text-[10px] font-semibold text-slate-500"><span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-cyan-500" />Real</span><span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-slate-300" />Objetivo</span></div>
          </CardHeader>
          <CardContent>
            <RevenueChart data={series} />
            <div className="mt-5 grid grid-cols-3 gap-3 border-t border-slate-100 pt-4">
              <ChartStat label="Promedio mensual" value={money.format(summary.revenue / series.length)} />
              <ChartStat label="Mejor mes" value="Julio" />
              <ChartStat label="Objetivo superado" value="117%" positive />
            </div>
          </CardContent>
        </Card>

        <Card className="brand-surface gap-4">
          <CardHeader><div className="flex items-center justify-between"><div><CardTitle className="brand-heading text-lg">Distribución de gastos</CardTitle><p className="mt-1 text-xs text-slate-500">$118,000 en total</p></div><PieChart className="size-5 text-slate-400" /></div></CardHeader>
          <CardContent>
            <div className="mx-auto grid size-40 place-items-center rounded-full" style={{ background: "conic-gradient(#2563eb 0 44%, #06b6d4 44% 70%, #fbbf24 70% 88%, #fb7185 88% 100%)" }}><div className="grid size-24 place-items-center rounded-full bg-white text-center shadow-inner"><span><strong className="block text-xl text-slate-950">$118k</strong><span className="text-[10px] text-slate-500">gasto total</span></span></div></div>
            <div className="mt-5 space-y-3">{expenses.map((expense) => <div key={expense.name} className="flex items-center justify-between text-xs"><span className="flex items-center gap-2 text-slate-600"><span className={cn("size-2 rounded-full", expense.color)} />{expense.name} <span className="text-slate-400">{expense.value}%</span></span><strong className="text-slate-800">{expense.amount}</strong></div>)}</div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(300px,0.75fr)]">
        <Card className="brand-surface gap-4 overflow-hidden">
          <CardHeader><div className="flex items-center justify-between"><div><CardTitle className="brand-heading text-lg">Rendimiento del equipo</CardTitle><p className="mt-1 text-xs text-slate-500">Actividad e ingresos atribuidos</p></div><BarChart3 className="size-5 text-slate-400" /></div></CardHeader>
          <CardContent className="px-0">
            <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500"><tr><th className="px-6 py-3 font-semibold">Persona</th><th className="px-3 py-3 font-semibold">Clientes</th><th className="px-3 py-3 font-semibold">Proyectos</th><th className="px-3 py-3 font-semibold">Ingresos</th><th className="px-6 py-3 font-semibold">Objetivo</th></tr></thead><tbody className="divide-y divide-slate-100">{teamRows.map((person) => <tr key={person.name} className="hover:bg-slate-50/80"><td className="px-6 py-3"><div className="flex items-center gap-3"><span className={cn("flex size-8 items-center justify-center rounded-full text-[10px] font-bold", person.color)}>{person.initials}</span><span><strong className="block text-xs text-slate-900">{person.name}</strong><span className="text-[10px] text-slate-500">{person.role}</span></span></div></td><td className="px-3 py-3 font-semibold text-slate-700">{person.clients}</td><td className="px-3 py-3 font-semibold text-slate-700">{person.projects}</td><td className="px-3 py-3 font-semibold text-slate-900">{money.format(person.revenue)}</td><td className="px-6 py-3"><div className="flex items-center gap-2"><div className="h-1.5 w-20 rounded-full bg-slate-100"><div className="h-full rounded-full bg-cyan-500" style={{ width: `${person.goal}%` }} /></div><span className="text-[10px] font-bold text-slate-600">{person.goal}%</span></div></td></tr>)}</tbody></table></div>
          </CardContent>
        </Card>

        <Card className="brand-surface gap-4">
          <CardHeader><div className="flex items-center justify-between"><div><CardTitle className="brand-heading text-lg">Embudo comercial</CardTitle><p className="mt-1 text-xs text-slate-500">Conversión de oportunidades</p></div><TrendingUp className="size-5 text-slate-400" /></div></CardHeader>
          <CardContent className="space-y-4">
            <FunnelRow label="Leads cualificados" value={126} width="100%" color="bg-blue-500" />
            <FunnelRow label="Propuestas enviadas" value={74} width="79%" color="bg-cyan-500" />
            <FunnelRow label="En negociación" value={43} width="61%" color="bg-amber-400" />
            <FunnelRow label="Clientes ganados" value={28} width="45%" color="bg-emerald-500" />
            <div className="rounded-xl bg-slate-950 p-4 text-white"><div className="flex items-start gap-3"><Sparkles className="mt-0.5 size-4 shrink-0 text-cyan-300" /><div><p className="text-xs font-semibold">Tasa lead → cliente</p><p className="mt-1 text-2xl font-bold">22,2%</p><p className="mt-1 text-[10px] text-slate-400">+2,6 puntos frente al periodo anterior</p></div></div></div>
          </CardContent>
        </Card>
      </section>

      <Card className="brand-surface gap-4 border-cyan-200 bg-gradient-to-r from-white to-cyan-50">
        <CardContent className="flex flex-col gap-4 pt-0 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-cyan-100 text-cyan-700"><Lightbulb className="size-5" /></span><div><p className="font-semibold text-slate-900">Lectura ejecutiva</p><p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">Los ingresos crecen por encima del objetivo desde mayo. El mayor potencial está en acelerar las 43 negociaciones abiertas y revisar el ligero descenso de conversión antes del cierre mensual.</p></div></div><Badge variant="outline" className="w-fit border-cyan-200 bg-white text-cyan-700">Actualizado hoy</Badge>
        </CardContent>
      </Card>
    </>
  );
}

function ReportSelect({ icon: Icon, value, options, onChange, label }: { icon: typeof Filter; value: string; options: string[]; onChange: (value: string) => void; label: string }) {
  return <label className="relative"><span className="sr-only">{label}</span><Icon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><select value={value} onChange={(event) => onChange(event.target.value)} className="h-9 w-full appearance-none rounded-md border border-slate-300 bg-white pl-9 pr-9 text-sm font-medium text-slate-700 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200 sm:w-auto">{options.map((option) => <option key={option}>{option}</option>)}</select><ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" /></label>;
}

function KpiCard({ icon: Icon, label, value, change, direction, context, tone }: { icon: typeof CircleDollarSign; label: string; value: string; change: string; direction: "up" | "down"; context: string; tone: "cyan" | "blue" | "amber" | "rose" }) {
  const iconStyle = { cyan: "bg-cyan-50 text-cyan-700", blue: "bg-blue-50 text-blue-700", amber: "bg-amber-50 text-amber-700", rose: "bg-rose-50 text-rose-700" }[tone];
  const positive = direction === "up";
  return <div className="rounded-xl border border-white/40 bg-white/95 p-4 shadow-lg shadow-slate-950/10"><div className="flex items-center justify-between"><span className={cn("rounded-lg p-2", iconStyle)}><Icon className="size-4" /></span><span className={cn("flex items-center gap-1 text-[11px] font-bold", positive ? "text-emerald-600" : "text-rose-600")}>{positive ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}{change}</span></div><p className="mt-3 text-xl font-bold text-slate-950">{value}</p><div className="mt-0.5 flex items-center justify-between gap-2"><p className="text-xs font-medium text-slate-500">{label}</p><p className="text-[10px] text-slate-400">{context}</p></div></div>;
}

function RevenueChart({ data }: { data: { label: string; revenue: number; goal: number }[] }) {
  const max = Math.max(...data.flatMap((item) => [item.revenue, item.goal])) * 1.15;
  return <div className="relative h-64"><div className="absolute inset-0 flex flex-col justify-between pb-7"><span className="border-t border-dashed border-slate-200" /><span className="border-t border-dashed border-slate-200" /><span className="border-t border-dashed border-slate-200" /><span className="border-t border-dashed border-slate-200" /></div><div className="absolute inset-0 flex items-end justify-around gap-2 pb-7 pt-2">{data.map((item) => <div key={item.label} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end"><div className="group flex h-full w-full max-w-16 items-end justify-center gap-1"><div className="relative w-2.5 rounded-t bg-slate-300 transition hover:bg-slate-400 sm:w-3.5" style={{ height: `${(item.goal / max) * 100}%` }}><span className="pointer-events-none absolute -top-6 left-1/2 hidden -translate-x-1/2 rounded bg-slate-950 px-1.5 py-1 text-[9px] text-white group-hover:block">{item.goal}k</span></div><div className="relative w-3 rounded-t bg-cyan-500 transition hover:bg-cyan-400 sm:w-5" style={{ height: `${(item.revenue / max) * 100}%` }}><span className="pointer-events-none absolute -top-6 left-1/2 hidden -translate-x-1/2 rounded bg-slate-950 px-1.5 py-1 text-[9px] text-white group-hover:block">{item.revenue}k</span></div></div><span className="mt-2 text-[10px] font-semibold text-slate-500">{item.label}</span></div>)}</div></div>;
}

function ChartStat({ label, value, positive }: { label: string; value: string; positive?: boolean }) {
  return <div><p className="text-[10px] text-slate-400">{label}</p><p className={cn("mt-1 text-sm font-bold text-slate-800", positive && "text-emerald-600")}>{value}</p></div>;
}

function FunnelRow({ label, value, width, color }: { label: string; value: number; width: string; color: string }) {
  return <div><div className="mb-1.5 flex items-center justify-between"><span className="text-xs font-medium text-slate-600">{label}</span><strong className="text-xs text-slate-900">{value}</strong></div><div className="h-2.5 overflow-hidden rounded-full bg-slate-100"><div className={cn("h-full rounded-full", color)} style={{ width }} /></div></div>;
}
