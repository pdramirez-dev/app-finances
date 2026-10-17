"use client";

import { type FormEvent, useMemo, useState } from "react";
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  MapPin,
  Plus,
  Sparkles,
  UsersRound,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { saveCalendarEventAction } from "@/actions/crm";
import type { CalendarEvent, CalendarEventType as EventType } from "@/lib/appsync/crm";

type CalendarView = "month" | "week";

const initialEvents: CalendarEvent[] = [
  {
    id: "EV-201",
    title: "Demo de control financiero",
    company: "SunPeak Energy",
    date: "2026-07-01",
    start: "10:00",
    end: "11:00",
    type: "Reunión",
    owner: "Laura Ramos",
    ownerInitials: "LR",
    location: "Google Meet",
  },
  {
    id: "EV-202",
    title: "Revisión de alcance",
    company: "Northline Logistics",
    date: "2026-07-03",
    start: "12:30",
    end: "13:00",
    type: "Llamada",
    owner: "Diego Vega",
    ownerInitials: "DV",
  },
  {
    id: "EV-203",
    title: "Enviar propuesta final",
    company: "Greenridge Foods",
    date: "2026-07-06",
    start: "09:00",
    end: "09:30",
    type: "Entrega",
    owner: "Sofía León",
    ownerInitials: "SL",
  },
  {
    id: "EV-204",
    title: "Discovery con dirección",
    company: "Harborview Hotels",
    date: "2026-07-07",
    start: "11:00",
    end: "12:00",
    type: "Reunión",
    owner: "Laura Ramos",
    ownerInitials: "LR",
    location: "Sala Norte",
  },
  {
    id: "EV-205",
    title: "Validación de integración",
    company: "MetroCare Clinics",
    date: "2026-07-09",
    start: "16:00",
    end: "17:00",
    type: "Reunión",
    owner: "Sofía León",
    ownerInitials: "SL",
    location: "Microsoft Teams",
  },
  {
    id: "EV-206",
    title: "Seguimiento de propuesta",
    company: "SunPeak Energy",
    date: "2026-07-10",
    start: "10:30",
    end: "11:00",
    type: "Seguimiento",
    owner: "Diego Vega",
    ownerInitials: "DV",
  },
  {
    id: "EV-207",
    title: "Comité de decisión",
    company: "Northline Logistics",
    date: "2026-07-12",
    start: "09:30",
    end: "10:30",
    type: "Reunión",
    owner: "Laura Ramos",
    ownerInitials: "LR",
    location: "Google Meet",
  },
  {
    id: "EV-208",
    title: "Resolver dudas comerciales",
    company: "Greenridge Foods",
    date: "2026-07-12",
    start: "12:00",
    end: "12:30",
    type: "Llamada",
    owner: "Diego Vega",
    ownerInitials: "DV",
  },
  {
    id: "EV-209",
    title: "Presentación a operaciones",
    company: "Harborview Hotels",
    date: "2026-07-14",
    start: "15:00",
    end: "16:00",
    type: "Reunión",
    owner: "Sofía León",
    ownerInitials: "SL",
    location: "Zoom",
  },
  {
    id: "EV-210",
    title: "Entrega de plan técnico",
    company: "MetroCare Clinics",
    date: "2026-07-16",
    start: "11:30",
    end: "12:00",
    type: "Entrega",
    owner: "Laura Ramos",
    ownerInitials: "LR",
  },
  {
    id: "EV-211",
    title: "Negociación de condiciones",
    company: "SunPeak Energy",
    date: "2026-07-20",
    start: "10:00",
    end: "11:00",
    type: "Reunión",
    owner: "Diego Vega",
    ownerInitials: "DV",
    location: "Sala Este",
  },
  {
    id: "EV-212",
    title: "Llamada de cierre",
    company: "Northline Logistics",
    date: "2026-07-23",
    start: "16:30",
    end: "17:00",
    type: "Llamada",
    owner: "Sofía León",
    ownerInitials: "SL",
  },
  {
    id: "EV-213",
    title: "Onboarding del equipo",
    company: "Greenridge Foods",
    date: "2026-07-27",
    start: "09:30",
    end: "11:00",
    type: "Reunión",
    owner: "Laura Ramos",
    ownerInitials: "LR",
    location: "Google Meet",
  },
  {
    id: "EV-214",
    title: "Compartir próximos pasos",
    company: "Harborview Hotels",
    date: "2026-07-30",
    start: "13:00",
    end: "13:30",
    type: "Seguimiento",
    owner: "Diego Vega",
    ownerInitials: "DV",
  },
];

const eventStyles: Record<EventType, { card: string; dot: string }> = {
  Reunión: {
    card: "border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100",
    dot: "bg-blue-500",
  },
  Llamada: {
    card: "border-cyan-200 bg-cyan-50 text-cyan-800 hover:bg-cyan-100",
    dot: "bg-cyan-500",
  },
  Seguimiento: {
    card: "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100",
    dot: "bg-amber-500",
  },
  Entrega: {
    card: "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100",
    dot: "bg-emerald-500",
  },
};

const weekdayLabels = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const longDateFormatter = new Intl.DateTimeFormat("es-ES", {
  weekday: "long",
  day: "numeric",
  month: "long",
});
const monthFormatter = new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric" });
const shortMonthFormatter = new Intl.DateTimeFormat("es-ES", { month: "short" });

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function startOfWeek(date: Date) {
  const start = new Date(date);
  const day = start.getDay();
  start.setDate(start.getDate() - (day === 0 ? 6 : day - 1));
  start.setHours(0, 0, 0, 0);
  return start;
}

function monthGrid(date: Date) {
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  const gridStart = startOfWeek(firstDay);
  const endWeekday = lastDay.getDay() === 0 ? 7 : lastDay.getDay();
  const gridEnd = addDays(lastDay, 7 - endWeekday);
  const days: Date[] = [];
  for (let cursor = new Date(gridStart); cursor <= gridEnd; cursor = addDays(cursor, 1)) {
    days.push(cursor);
  }
  return days;
}

function periodTitle(date: Date, view: CalendarView) {
  if (view === "month") return monthFormatter.format(date);
  const start = startOfWeek(date);
  const end = addDays(start, 6);
  if (start.getMonth() === end.getMonth()) {
    return `${start.getDate()}–${end.getDate()} ${shortMonthFormatter.format(end)} ${end.getFullYear()}`;
  }
  return `${start.getDate()} ${shortMonthFormatter.format(start)} – ${end.getDate()} ${shortMonthFormatter.format(end)} ${end.getFullYear()}`;
}

function EventPill({ event, compact = false }: { event: CalendarEvent; compact?: boolean }) {
  return (
    <article
      title={`${event.start}–${event.end} · ${event.title} · ${event.company}`}
      className={cn(
        "block w-full rounded-md border text-left transition",
        compact ? "px-1.5 py-1" : "p-2.5",
        eventStyles[event.type].card,
      )}
    >
      <div className="flex items-center gap-1.5">
        <span className={cn("size-1.5 shrink-0 rounded-full", eventStyles[event.type].dot)} aria-hidden="true" />
        <span className={cn("shrink-0 font-bold tabular-nums", compact ? "text-[9px]" : "text-[11px]")}>{event.start}</span>
        <span className={cn("truncate font-semibold", compact ? "text-[10px]" : "text-xs")}>{event.title}</span>
      </div>
      {!compact && (
        <div className="mt-1.5 flex items-center justify-between gap-2 text-[10px] opacity-80">
          <span className="truncate">{event.company}</span>
          <span className="shrink-0 font-bold">{event.ownerInitials}</span>
        </div>
      )}
    </article>
  );
}

function MonthView({
  date,
  events,
  today,
  onCreateForDate,
}: {
  date: Date;
  events: CalendarEvent[];
  today: string;
  onCreateForDate: (date: string) => void;
}) {
  const days = monthGrid(date);

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[820px]">
        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50/80">
          {weekdayLabels.map((label, index) => (
            <div key={label} className={cn("px-3 py-2 text-center text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500", index > 4 && "bg-slate-100/80")}>
              {label}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day) => {
            const key = dateKey(day);
            const dayEvents = events.filter((event) => event.date === key).sort((a, b) => a.start.localeCompare(b.start));
            const isCurrentMonth = day.getMonth() === date.getMonth();
            const isToday = key === today;
            return (
              <div
                key={key}
                className={cn(
                  "group min-h-32 border-b border-r border-slate-200 p-2 last:border-r-0",
                  !isCurrentMonth && "bg-slate-50/70",
                  day.getDay() === 0 || day.getDay() === 6 ? "bg-slate-50/50" : "bg-white",
                  isToday && "bg-cyan-50/40 ring-1 ring-inset ring-cyan-300",
                )}
              >
                <div className="mb-1.5 flex items-center justify-between">
                  <span
                    className={cn(
                      "flex size-6 items-center justify-center rounded-full text-xs font-semibold",
                      !isCurrentMonth && "text-slate-300",
                      isCurrentMonth && !isToday && "text-slate-600",
                      isToday && "bg-[#0a1226] text-white shadow-sm",
                    )}
                    aria-current={isToday ? "date" : undefined}
                  >
                    {day.getDate()}
                  </span>
                  <button
                    type="button"
                    onClick={() => onCreateForDate(key)}
                    className="flex size-6 items-center justify-center rounded-md text-slate-400 opacity-0 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 group-hover:opacity-100"
                    aria-label={`Crear evento el ${longDateFormatter.format(day)}`}
                  >
                    <Plus className="size-3.5" aria-hidden="true" />
                  </button>
                </div>
                <div className="space-y-1">
                  {dayEvents.slice(0, 3).map((event) => <EventPill key={event.id} event={event} compact />)}
                  {dayEvents.length > 3 && (
                    <p className="px-1 text-[10px] font-semibold text-slate-500">+{dayEvents.length - 3} más</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function WeekView({ date, events, today, onCreateForDate }: { date: Date; events: CalendarEvent[]; today: string; onCreateForDate: (date: string) => void }) {
  const start = startOfWeek(date);
  const days = Array.from({ length: 7 }, (_, index) => addDays(start, index));

  return (
    <>
      <div className="space-y-3 p-4 md:hidden">
        {days.map((day) => {
          const key = dateKey(day);
          const dayEvents = events.filter((event) => event.date === key).sort((a, b) => a.start.localeCompare(b.start));
          return (
            <section key={key} className={cn("rounded-xl border border-slate-200 bg-white", key === today && "border-cyan-300 ring-2 ring-cyan-100")}>
              <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <span className={cn("flex size-8 items-center justify-center rounded-lg bg-slate-100 text-sm font-bold text-slate-700", key === today && "bg-[#0a1226] text-white")}>
                    {day.getDate()}
                  </span>
                  <div>
                    <h3 className="text-xs font-bold capitalize text-slate-800">{longDateFormatter.format(day)}</h3>
                    <p className="text-[10px] text-slate-400">{dayEvents.length} {dayEvents.length === 1 ? "evento" : "eventos"}</p>
                  </div>
                </div>
                <Button type="button" variant="ghost" size="icon-xs" onClick={() => onCreateForDate(key)} aria-label={`Crear evento el ${longDateFormatter.format(day)}`}>
                  <Plus aria-hidden="true" />
                </Button>
              </div>
              <div className="space-y-2 p-3">
                {dayEvents.length ? dayEvents.map((event) => <EventPill key={event.id} event={event} />) : <p className="py-3 text-center text-xs text-slate-400">Sin eventos</p>}
              </div>
            </section>
          );
        })}
      </div>

      <div className="hidden min-h-[480px] grid-cols-7 divide-x divide-slate-200 md:grid">
        {days.map((day) => {
          const key = dateKey(day);
          const dayEvents = events.filter((event) => event.date === key).sort((a, b) => a.start.localeCompare(b.start));
          return (
            <section key={key} className={cn("min-w-0 bg-white", key === today && "bg-cyan-50/40")}>
              <div className={cn("border-b border-slate-200 px-2 py-3 text-center", key === today && "bg-cyan-50")}>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{weekdayLabels[(day.getDay() + 6) % 7]}</p>
                <div className="mt-1 flex items-center justify-center gap-1">
                  <span className={cn("flex size-7 items-center justify-center rounded-full text-sm font-bold text-slate-700", key === today && "bg-[#0a1226] text-white")} aria-current={key === today ? "date" : undefined}>
                    {day.getDate()}
                  </span>
                  <button type="button" onClick={() => onCreateForDate(key)} className="flex size-6 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400" aria-label={`Crear evento el ${longDateFormatter.format(day)}`}>
                    <Plus className="size-3.5" aria-hidden="true" />
                  </button>
                </div>
              </div>
              <div className="space-y-2 p-2">
                {dayEvents.map((event) => <EventPill key={event.id} event={event} />)}
                {!dayEvents.length && <p className="py-6 text-center text-[10px] text-slate-300">Sin eventos</p>}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}

export function CalendarPlanner({ initialEvents: eventsFromServer, today }: { initialEvents: CalendarEvent[]; today: string }) {
  const [events, setEvents] = useState(eventsFromServer ?? initialEvents);
  const initialDate = useMemo(() => new Date(`${today}T12:00:00`), [today]);
  const [view, setView] = useState<CalendarView>("month");
  const [currentDate, setCurrentDate] = useState(initialDate);
  const [mutationError, setMutationError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newCompany, setNewCompany] = useState("");
  const [newDate, setNewDate] = useState(today);
  const [newStart, setNewStart] = useState("10:00");
  const [newEnd, setNewEnd] = useState("11:00");
  const [newType, setNewType] = useState<EventType>("Reunión");

  const visibleStats = useMemo(() => {
    const monthPrefix = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, "0")}`;
    const monthEvents = events.filter((event) => event.date.startsWith(monthPrefix));
    const companies = new Set(monthEvents.map((event) => event.company));
    return { eventCount: monthEvents.length, companyCount: companies.size };
  }, [currentDate, events]);

  function navigate(direction: -1 | 1) {
    setCurrentDate((current) => {
      if (view === "week") return addDays(current, direction * 7);
      return new Date(current.getFullYear(), current.getMonth() + direction, 1);
    });
  }

  function openFormForDate(date: string) {
    setNewDate(date);
    setShowForm(true);
  }

  async function addEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = newTitle.trim();
    const company = newCompany.trim();
    if (!title || !company) return;
    const optimisticEvent: CalendarEvent = {
        id: crypto.randomUUID(),
        title,
        company,
        date: newDate,
        start: newStart,
        end: newEnd,
        type: newType,
        owner: "Sin asignar",
        ownerInitials: "SA",
      };
    setEvents((current) => [...current, optimisticEvent]);
    setMutationError("");
    const result = await saveCalendarEventAction({ title, company, date: newDate, start: newStart, end: newEnd, type: newType });
    if (result.ok) setEvents((current) => current.map((item) => item.id === optimisticEvent.id ? result.data : item));
    else { setEvents((current) => current.filter((item) => item.id !== optimisticEvent.id)); setMutationError(result.error); }
    setCurrentDate(new Date(`${newDate}T12:00:00`));
    setNewTitle("");
    setNewCompany("");
    setShowForm(false);
  }

  return (
    <div className="space-y-6">
      {mutationError ? <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{mutationError}</p> : null}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="flex items-center gap-2 text-sm font-medium text-cyan-700">
            <CalendarDays className="size-4" aria-hidden="true" />
            Operaciones · Agenda
          </p>
          <h1 className="brand-heading mt-2 text-3xl text-slate-950">Calendario</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">Coordina reuniones, llamadas y entregas del equipo.</p>
        </div>
        <Button type="button" onClick={() => setShowForm((current) => !current)} aria-expanded={showForm} aria-controls="new-calendar-event" className="bg-[#0a1226] text-white shadow-sm hover:bg-[#162448]">
          {showForm ? <X aria-hidden="true" /> : <Plus aria-hidden="true" />}
          {showForm ? "Cerrar" : "Nuevo evento"}
        </Button>
      </div>

      {showForm && (
        <section id="new-calendar-event" className="brand-surface overflow-hidden" aria-labelledby="new-event-heading">
          <form onSubmit={addEvent}>
            <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3 sm:px-5">
              <span className="flex size-8 items-center justify-center rounded-lg bg-cyan-50 text-cyan-700"><Sparkles className="size-4" aria-hidden="true" /></span>
              <div>
                <h2 id="new-event-heading" className="text-sm font-bold text-slate-900">Crear evento</h2>
                <p className="text-xs text-slate-500">Se guardará en el calendario del equipo.</p>
              </div>
            </div>
            <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-[minmax(180px,1.5fr)_minmax(170px,1fr)_1fr_110px_110px_130px_auto] xl:items-end">
              <label className="block sm:col-span-2 xl:col-span-1">
                <span className="mb-1.5 block text-xs font-semibold text-slate-600">Título</span>
                <Input value={newTitle} onChange={(event) => setNewTitle(event.target.value)} placeholder="Ej. Revisión de propuesta" required autoFocus />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-slate-600">Empresa</span>
                <Input value={newCompany} onChange={(event) => setNewCompany(event.target.value)} placeholder="Nombre de empresa" required />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-slate-600">Fecha</span>
                <Input type="date" value={newDate} onChange={(event) => setNewDate(event.target.value)} required />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-slate-600">Inicio</span>
                <Input type="time" value={newStart} onChange={(event) => setNewStart(event.target.value)} required />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-slate-600">Fin</span>
                <Input type="time" value={newEnd} onChange={(event) => setNewEnd(event.target.value)} required />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-slate-600">Tipo</span>
                <select value={newType} onChange={(event) => setNewType(event.target.value as EventType)} className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-200">
                  {(Object.keys(eventStyles) as EventType[]).map((type) => <option key={type} value={type}>{type}</option>)}
                </select>
              </label>
              <Button type="submit" className="sm:col-span-2 xl:col-span-1"><Check aria-hidden="true" />Guardar</Button>
            </div>
          </form>
        </section>
      )}

      <section className="brand-surface overflow-hidden" aria-label="Calendario comercial">
        <div className="flex flex-col gap-4 border-b border-slate-200 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="icon-sm" onClick={() => navigate(-1)} aria-label={view === "month" ? "Mes anterior" : "Semana anterior"}><ChevronLeft aria-hidden="true" /></Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setCurrentDate(initialDate)}>Hoy</Button>
            <Button type="button" variant="outline" size="icon-sm" onClick={() => navigate(1)} aria-label={view === "month" ? "Mes siguiente" : "Semana siguiente"}><ChevronRight aria-hidden="true" /></Button>
            <h2 className="ml-1 text-base font-bold capitalize text-slate-900 sm:text-lg">{periodTitle(currentDate, view)}</h2>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="hidden items-center gap-3 text-[11px] text-slate-500 xl:flex">
              <span className="inline-flex items-center gap-1.5"><CalendarDays className="size-3.5" aria-hidden="true" />{visibleStats.eventCount} eventos este mes</span>
              <span className="inline-flex items-center gap-1.5"><UsersRound className="size-3.5" aria-hidden="true" />{visibleStats.companyCount} empresas</span>
            </div>
            <div className="grid grid-cols-2 rounded-lg border border-slate-200 bg-slate-100 p-1" aria-label="Seleccionar vista">
              {(["month", "week"] as CalendarView[]).map((item) => (
                <button key={item} type="button" onClick={() => setView(item)} aria-pressed={view === item} className={cn("rounded-md px-3 py-1.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400", view === item ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800")}>
                  {item === "month" ? "Mes" : "Semana"}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-slate-200 bg-slate-50/70 px-4 py-2.5 sm:px-5" aria-label="Leyenda de eventos">
          {(Object.keys(eventStyles) as EventType[]).map((type) => (
            <span key={type} className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-600"><span className={cn("size-2 rounded-full", eventStyles[type].dot)} aria-hidden="true" />{type}</span>
          ))}
          <Badge variant="outline" className="ml-auto hidden bg-white text-[10px] text-slate-500 sm:inline-flex">Datos persistidos</Badge>
        </div>

        {view === "month" ? <MonthView date={currentDate} events={events} today={today} onCreateForDate={openFormForDate} /> : <WeekView date={currentDate} events={events} today={today} onCreateForDate={openFormForDate} />}
      </section>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="brand-surface gap-0 py-0"><CardContent className="flex items-center gap-3 p-4"><span className="flex size-9 items-center justify-center rounded-lg bg-blue-50 text-blue-700"><CalendarDays className="size-4" aria-hidden="true" /></span><div><p className="text-[11px] text-slate-500">Próxima reunión</p><p className="text-xs font-bold text-slate-900">Hoy · 09:30</p></div></CardContent></Card>
        <Card className="brand-surface gap-0 py-0"><CardContent className="flex items-center gap-3 p-4"><span className="flex size-9 items-center justify-center rounded-lg bg-cyan-50 text-cyan-700"><Clock3 className="size-4" aria-hidden="true" /></span><div><p className="text-[11px] text-slate-500">Tiempo agendado</p><p className="text-xs font-bold text-slate-900">11,5 h este mes</p></div></CardContent></Card>
        <Card className="brand-surface gap-0 py-0"><CardContent className="flex items-center gap-3 p-4"><span className="flex size-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700"><MapPin className="size-4" aria-hidden="true" /></span><div><p className="text-[11px] text-slate-500">Modalidad principal</p><p className="text-xs font-bold text-slate-900">Videollamada</p></div></CardContent></Card>
      </div>
    </div>
  );
}
