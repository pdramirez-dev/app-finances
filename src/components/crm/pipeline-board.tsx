"use client";

import { useMemo, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Building2,
  CalendarClock,
  CircleDollarSign,
  Filter,
  Search,
  Sparkles,
  Target,
  TrendingUp,
  UserRound,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { updateOpportunityStageAction } from "@/actions/crm";
import { pipelineStages } from "@/components/crm/crm-data";
import type { Opportunity, PipelineStage } from "@/lib/appsync/crm";

const currency = new Intl.NumberFormat("es-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const compactCurrency = new Intl.NumberFormat("es-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

function ActionDate({ days }: { days: number }) {
  const label =
    days < 0
      ? `Vencida hace ${Math.abs(days)} ${Math.abs(days) === 1 ? "día" : "días"}`
      : days === 0
        ? "Para hoy"
        : days === 1
          ? "Mañana"
          : `En ${days} días`;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-[11px] font-semibold",
        days < 0 ? "text-rose-600" : days === 0 ? "text-amber-700" : "text-slate-500",
      )}
    >
      <CalendarClock className="size-3" aria-hidden="true" />
      {label}
    </span>
  );
}

function OpportunityCard({
  opportunity,
  onStageChange,
}: {
  opportunity: Opportunity;
  onStageChange: (id: string, stage: PipelineStage) => void;
}) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
            {opportunity.id}
          </p>
          <h3 className="mt-1 text-sm font-bold leading-snug text-slate-900">
            {opportunity.title}
          </h3>
        </div>
        <span
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#0a1226] text-[10px] font-bold text-white"
          title={opportunity.owner}
          aria-label={`Responsable: ${opportunity.owner}`}
        >
          {opportunity.ownerInitials}
        </span>
      </div>

      <div className="mb-3 flex items-center gap-2 text-xs font-medium text-slate-600">
        <Building2 className="size-3.5 shrink-0 text-slate-400" aria-hidden="true" />
        <span className="truncate">{opportunity.company}</span>
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {opportunity.tags.map((tag) => (
          <Badge key={tag} variant="secondary" className="bg-slate-100 text-[10px] text-slate-600">
            {tag}
          </Badge>
        ))}
      </div>

      <div className="mb-3 flex items-end justify-between border-y border-slate-100 py-2.5">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-slate-400">Valor</p>
          <p className="text-base font-bold tabular-nums text-slate-900">{currency.format(opportunity.value)}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-wider text-slate-400">Probabilidad</p>
          <p className="text-sm font-bold tabular-nums text-slate-700">{opportunity.probability}%</p>
        </div>
      </div>

      <div className="mb-3">
        <p className="mb-1 truncate text-xs text-slate-600" title={opportunity.nextAction}>
          {opportunity.nextAction}
        </p>
        <ActionDate days={opportunity.daysUntilAction} />
      </div>

      <label className="block">
        <span className="sr-only">Etapa de {opportunity.title}</span>
        <select
          value={opportunity.stage}
          onChange={(event) => onStageChange(opportunity.id, event.target.value as PipelineStage)}
          className="h-8 w-full rounded-md border border-slate-200 bg-slate-50 px-2 text-xs font-semibold text-slate-700 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-200"
          aria-label={`Cambiar etapa de ${opportunity.title}`}
        >
          {pipelineStages.map((stage) => (
            <option key={stage.id} value={stage.id}>
              Mover a: {stage.shortLabel}
            </option>
          ))}
        </select>
      </label>
    </article>
  );
}

export function PipelineBoard({ initialOpportunities }: { initialOpportunities: Opportunity[] }) {
  const [opportunities, setOpportunities] = useState(initialOpportunities);
  const [mutationError, setMutationError] = useState("");
  const [query, setQuery] = useState("");
  const [owner, setOwner] = useState("Todos");
  const [source, setSource] = useState("Todos");
  const [onlyUrgent, setOnlyUrgent] = useState(false);
  const owners = useMemo(() => ["Todos", ...Array.from(new Set(opportunities.map((item) => item.owner)))], [opportunities]);
  const sources = useMemo(() => ["Todos", ...Array.from(new Set(opportunities.map((item) => item.source)))], [opportunities]);

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("es");
    return opportunities.filter((opportunity) => {
      const matchesQuery =
        !normalizedQuery ||
        [opportunity.title, opportunity.company, opportunity.contact, opportunity.id].some((value) =>
          value.toLocaleLowerCase("es").includes(normalizedQuery),
        );
      const matchesOwner = owner === "Todos" || opportunity.owner === owner;
      const matchesSource = source === "Todos" || opportunity.source === source;
      const matchesUrgency = !onlyUrgent || opportunity.daysUntilAction <= 0;
      return matchesQuery && matchesOwner && matchesSource && matchesUrgency;
    });
  }, [opportunities, owner, onlyUrgent, query, source]);

  const metrics = useMemo(() => {
    const active = opportunities.filter((item) => item.stage !== "won");
    const total = active.reduce((sum, item) => sum + item.value, 0);
    const weighted = active.reduce((sum, item) => sum + item.value * (item.probability / 100), 0);
    const won = opportunities.filter((item) => item.stage === "won");
    return {
      total,
      weighted,
      average: opportunities.reduce((sum, item) => sum + item.value, 0) / opportunities.length,
      conversion: Math.round((won.length / opportunities.length) * 100),
      activeCount: active.length,
      wonCount: won.length,
    };
  }, [opportunities]);

  const hasFilters = query || owner !== "Todos" || source !== "Todos" || onlyUrgent;

  async function moveOpportunity(id: string, stage: PipelineStage) {
    const previous = opportunities;
    const probability = pipelineStages.findIndex((item) => item.id === stage);
    const stageProbabilities = [15, 35, 60, 80, 100];
    setOpportunities((current) =>
      current.map((item) =>
        item.id === id ? { ...item, stage, probability: stageProbabilities[probability] } : item,
      ),
    );
    setMutationError("");
    const result = await updateOpportunityStageAction(id, stage);
    if (!result.ok) {
      setOpportunities(previous);
      setMutationError(result.error);
    }
  }

  function clearFilters() {
    setQuery("");
    setOwner("Todos");
    setSource("Todos");
    setOnlyUrgent(false);
  }

  const metricItems = [
    {
      label: "Pipeline abierto",
      value: compactCurrency.format(metrics.total),
      helper: `${metrics.activeCount} oportunidades activas`,
      icon: CircleDollarSign,
      iconClass: "bg-cyan-50 text-cyan-700",
    },
    {
      label: "Previsión ponderada",
      value: compactCurrency.format(metrics.weighted),
      helper: "+12% vs. mes anterior",
      icon: TrendingUp,
      iconClass: "bg-emerald-50 text-emerald-700",
    },
    {
      label: "Ticket medio",
      value: compactCurrency.format(metrics.average),
      helper: "En todas las etapas",
      icon: Target,
      iconClass: "bg-blue-50 text-blue-700",
    },
    {
      label: "Conversión",
      value: `${metrics.conversion}%`,
      helper: `${metrics.wonCount} acuerdos ganados`,
      icon: Sparkles,
      iconClass: "bg-amber-50 text-amber-700",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="flex items-center gap-2 text-sm font-medium text-cyan-700">
            <Target className="size-4" aria-hidden="true" />
            CRM · Ventas
          </p>
          <h1 className="brand-heading mt-2 text-3xl text-slate-950">Oportunidades</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Prioriza cada acuerdo y mueve el trabajo hacia el cierre.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span className="size-2 rounded-full bg-emerald-400" aria-hidden="true" />
          Datos persistidos · actualización optimista
        </div>
      </div>
      {mutationError ? <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{mutationError}</p> : null}

      <section aria-label="Resumen del pipeline" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metricItems.map(({ label, value, helper, icon: Icon, iconClass }) => (
          <Card key={label} className="brand-surface gap-0 py-0">
            <CardContent className="flex items-center gap-3 p-4">
              <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", iconClass)}>
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-slate-500">{label}</p>
                <p className="mt-0.5 text-xl font-bold tabular-nums text-slate-950">{value}</p>
                <p className="mt-0.5 truncate text-[10px] text-slate-400">{helper}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="brand-surface overflow-hidden" aria-label="Tablero de oportunidades">
        <div className="border-b border-slate-200 p-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            <div className="relative min-w-0 flex-1">
              <label htmlFor="pipeline-search" className="sr-only">
                Buscar oportunidades
              </label>
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <Input
                id="pipeline-search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar empresa, contacto u oportunidad…"
                className="pl-9"
              />
            </div>

            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
              <label className="relative">
                <span className="sr-only">Filtrar por responsable</span>
                <UserRound className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                <select
                  value={owner}
                  onChange={(event) => setOwner(event.target.value)}
                  className="h-9 w-full rounded-md border border-slate-200 bg-white pl-8 pr-2 text-xs font-medium text-slate-700 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-200 sm:w-auto"
                >
                  {owners.map((item) => (
                    <option key={item} value={item}>
                      {item === "Todos" ? "Responsable: todos" : item}
                    </option>
                  ))}
                </select>
              </label>
              <label className="relative">
                <span className="sr-only">Filtrar por origen</span>
                <Filter className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                <select
                  value={source}
                  onChange={(event) => setSource(event.target.value)}
                  className="h-9 w-full rounded-md border border-slate-200 bg-white pl-8 pr-2 text-xs font-medium text-slate-700 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-200 sm:w-auto"
                >
                  {sources.map((item) => (
                    <option key={item} value={item}>
                      {item === "Todos" ? "Origen: todos" : item}
                    </option>
                  ))}
                </select>
              </label>
              <Button
                type="button"
                variant={onlyUrgent ? "default" : "outline"}
                size="sm"
                className={cn("col-span-2", onlyUrgent && "bg-rose-600 hover:bg-rose-700")}
                onClick={() => setOnlyUrgent((current) => !current)}
                aria-pressed={onlyUrgent}
              >
                <CalendarClock aria-hidden="true" />
                Acción pendiente
              </Button>
              {hasFilters && (
                <Button type="button" variant="ghost" size="sm" onClick={clearFilters} className="col-span-2 text-slate-500">
                  <X aria-hidden="true" />
                  Limpiar
                </Button>
              )}
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
            <p>
              Mostrando <span className="font-semibold text-slate-700">{filtered.length}</span> de {opportunities.length} oportunidades
            </p>
            <p className="hidden items-center gap-1 sm:flex">
              <ArrowUpRight className="size-3.5 text-emerald-600" aria-hidden="true" />
              Cambia la etapa desde cada tarjeta
            </p>
          </div>
        </div>

        <div className="relative overflow-x-auto p-4">
          <div className="grid min-w-[1380px] grid-cols-5 gap-3" role="list" aria-label="Etapas del pipeline">
            {pipelineStages.map((stage) => {
              const items = filtered.filter((opportunity) => opportunity.stage === stage.id);
              const total = items.reduce((sum, opportunity) => sum + opportunity.value, 0);
              return (
                <section
                  key={stage.id}
                  className={cn("min-h-[410px] rounded-xl border border-slate-200 border-t-4 bg-slate-50/90 p-3", stage.accent)}
                  aria-labelledby={`stage-${stage.id}`}
                  role="listitem"
                >
                  <div className="mb-3 flex items-start justify-between gap-2 px-0.5">
                    <div>
                      <h2 id={`stage-${stage.id}`} className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-slate-700">
                        <span className={cn("size-2 rounded-full", stage.dot)} aria-hidden="true" />
                        {stage.label}
                      </h2>
                      <p className="mt-1.5 text-[11px] font-medium text-slate-400">{compactCurrency.format(total)}</p>
                    </div>
                    <Badge variant="outline" className="bg-white text-slate-600">
                      {items.length}
                    </Badge>
                  </div>
                  <div className="space-y-3">
                    {items.map((opportunity) => (
                      <OpportunityCard key={opportunity.id} opportunity={opportunity} onStageChange={moveOpportunity} />
                    ))}
                    {items.length === 0 && (
                      <div className="flex min-h-32 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white/50 px-4 text-center">
                        <ArrowDownRight className="mb-2 size-5 text-slate-300" aria-hidden="true" />
                        <p className="text-xs font-medium text-slate-400">Sin oportunidades con estos filtros</p>
                      </div>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
