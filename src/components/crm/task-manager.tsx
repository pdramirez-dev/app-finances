"use client";

import { type FormEvent, useMemo, useState } from "react";
import {
  AlertCircle,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  Circle,
  Clock3,
  Filter,
  ListChecks,
  Mail,
  Phone,
  Plus,
  Search,
  SlidersHorizontal,
  Sparkles,
  UserRound,
  UsersRound,
  Video,
  X,
  type LucideIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { saveTaskAction, setTaskCompletedAction } from "@/actions/crm";
import type { CrmPriority as TaskPriority, CrmTask, TaskKind } from "@/lib/appsync/crm";

type TaskTab = "pending" | "today" | "upcoming" | "completed";

const priorities: Array<"Todas" | TaskPriority> = ["Todas", "Alta", "Media", "Baja"];

const kindIcons: Record<TaskKind, LucideIcon> = {
  Llamada: Phone,
  Correo: Mail,
  Reunión: Video,
  Seguimiento: ListChecks,
};

const priorityStyles: Record<TaskPriority, string> = {
  Alta: "border-rose-200 bg-rose-50 text-rose-700",
  Media: "border-amber-200 bg-amber-50 text-amber-700",
  Baja: "border-slate-200 bg-slate-100 text-slate-600",
};

const dateFormatter = new Intl.DateTimeFormat("es-ES", {
  day: "numeric",
  month: "short",
});

function displayDate(date: string, today: string) {
  if (date === today) return "Hoy";
  const tomorrowDate = new Date(`${today}T12:00:00`);
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrow = tomorrowDate.toISOString().slice(0, 10);
  if (date === tomorrow) return "Mañana";
  return dateFormatter.format(new Date(`${date}T12:00:00`)).replace(".", "");
}

function dueTone(task: CrmTask, today: string) {
  if (task.completed) return "text-slate-400";
  if (task.dueDate < today) return "text-rose-600";
  if (task.dueDate === today) return "text-amber-700";
  return "text-slate-500";
}

function TaskRow({ task, today, onToggle }: { task: CrmTask; today: string; onToggle: (id: string) => void }) {
  const KindIcon = kindIcons[task.kind];
  const isOverdue = !task.completed && task.dueDate < today;

  return (
    <article
      className={cn(
        "group grid gap-3 border-b border-slate-100 px-4 py-4 transition last:border-b-0 hover:bg-slate-50/80 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center sm:px-5",
        task.completed && "bg-slate-50/60",
      )}
    >
      <button
        type="button"
        onClick={() => onToggle(task.id)}
        role="checkbox"
        aria-checked={task.completed}
        aria-label={task.completed ? `Marcar ${task.title} como pendiente` : `Completar ${task.title}`}
        className={cn(
          "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 sm:mt-0",
          task.completed
            ? "border-emerald-500 bg-emerald-500 text-white"
            : "border-slate-300 bg-white text-transparent hover:border-emerald-500 hover:text-emerald-500",
        )}
      >
        <Check className="size-3.5" aria-hidden="true" />
      </button>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3
            className={cn(
              "text-sm font-semibold leading-snug text-slate-900",
              task.completed && "text-slate-400 line-through",
            )}
          >
            {task.title}
          </h3>
          <Badge variant="outline" className={cn("text-[10px]", priorityStyles[task.priority])}>
            {task.priority}
          </Badge>
          {isOverdue && (
            <Badge variant="outline" className="border-rose-200 bg-white text-[10px] text-rose-600">
              Vencida
            </Badge>
          )}
        </div>
        {task.description && (
          <p className={cn("mt-1 line-clamp-1 text-xs text-slate-500", task.completed && "text-slate-400")}>
            {task.description}
          </p>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
          <span className="inline-flex items-center gap-1.5">
            <KindIcon className="size-3.5 text-slate-400" aria-hidden="true" />
            {task.kind}
          </span>
          <span className="inline-flex min-w-0 items-center gap-1.5">
            <UsersRound className="size-3.5 shrink-0 text-slate-400" aria-hidden="true" />
            <span className="truncate">{task.relatedTo}</span>
          </span>
        </div>
      </div>

      <div className="ml-9 flex items-center justify-between gap-5 sm:ml-0 sm:justify-end">
        <div className={cn("flex items-center gap-1.5 text-xs font-semibold", dueTone(task, today))}>
          {isOverdue ? <AlertCircle className="size-3.5" aria-hidden="true" /> : <Calendar className="size-3.5" aria-hidden="true" />}
          <span>{displayDate(task.dueDate, today)}</span>
          {task.dueTime && (
            <>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">{task.dueTime}</span>
            </>
          )}
        </div>
        <span
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-700 ring-2 ring-white"
          title={task.owner}
          aria-label={`Responsable: ${task.owner}`}
        >
          {task.ownerInitials}
        </span>
      </div>
    </article>
  );
}

export function TaskManager({ initialTasks, today }: { initialTasks: CrmTask[]; today: string }) {
  const [tasks, setTasks] = useState(initialTasks);
  const [mutationError, setMutationError] = useState("");
  const [activeTab, setActiveTab] = useState<TaskTab>("pending");
  const [query, setQuery] = useState("");
  const [owner, setOwner] = useState("Todos");
  const [priority, setPriority] = useState<"Todas" | TaskPriority>("Todas");
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDate, setNewDate] = useState(today);
  const [newTime, setNewTime] = useState("09:00");
  const [newPriority, setNewPriority] = useState<TaskPriority>("Media");
  const [newKind, setNewKind] = useState<TaskKind>("Seguimiento");
  const [newRelatedTo, setNewRelatedTo] = useState("");
  const owners = useMemo(() => ["Todos", ...Array.from(new Set(tasks.map((task) => task.owner)))], [tasks]);

  const counts = useMemo(
    () => ({
      pending: tasks.filter((task) => !task.completed).length,
      today: tasks.filter((task) => !task.completed && task.dueDate === today).length,
      upcoming: tasks.filter((task) => !task.completed && task.dueDate > today).length,
      completed: tasks.filter((task) => task.completed).length,
      overdue: tasks.filter((task) => !task.completed && task.dueDate < today).length,
    }),
    [tasks, today],
  );

  const filteredTasks = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("es");
    return tasks
      .filter((task) => {
        const matchesTab =
          activeTab === "pending"
            ? !task.completed
            : activeTab === "today"
              ? !task.completed && task.dueDate === today
              : activeTab === "upcoming"
                ? !task.completed && task.dueDate > today
                : task.completed;
        const matchesQuery =
          !normalizedQuery ||
          [task.title, task.description ?? "", task.relatedTo].some((value) =>
            value.toLocaleLowerCase("es").includes(normalizedQuery),
          );
        return (
          matchesTab &&
          matchesQuery &&
          (owner === "Todos" || task.owner === owner) &&
          (priority === "Todas" || task.priority === priority)
        );
      })
      .sort((a, b) => `${a.dueDate}${a.dueTime ?? ""}`.localeCompare(`${b.dueDate}${b.dueTime ?? ""}`));
  }, [activeTab, owner, priority, query, tasks, today]);

  const tabs: Array<{ id: TaskTab; label: string; count: number }> = [
    { id: "pending", label: "Pendientes", count: counts.pending },
    { id: "today", label: "Hoy", count: counts.today },
    { id: "upcoming", label: "Próximas", count: counts.upcoming },
    { id: "completed", label: "Completadas", count: counts.completed },
  ];

  const hasFilters = query || owner !== "Todos" || priority !== "Todas";

  async function toggleTask(id: string) {
    const previous = tasks;
    const completed = !tasks.find((task) => task.id === id)?.completed;
    setTasks((current) => current.map((task) => (task.id === id ? { ...task, completed } : task)));
    setMutationError("");
    const result = await setTaskCompletedAction(id, completed);
    if (!result.ok) { setTasks(previous); setMutationError(result.error); }
  }

  async function addTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = newTitle.trim();
    if (!title) return;

    const ownerData = tasks.find((task) => task.owner === owner) ?? {
      owner: "Sin asignar",
      ownerInitials: "SA",
    };
    const task: CrmTask = {
      id: crypto.randomUUID(),
      title,
      dueDate: newDate,
      dueTime: newTime || undefined,
      priority: newPriority,
      kind: newKind,
      owner: ownerData.owner,
      ownerInitials: ownerData.ownerInitials,
      relatedTo: newRelatedTo.trim() || "Sin vincular",
      completed: false,
    };
    setTasks((current) => [task, ...current]);
    const result = await saveTaskAction({ title, dueDate: newDate, dueTime: newTime, priority: newPriority, kind: newKind, relatedTo: task.relatedTo });
    if (result.ok) setTasks((current) => current.map((item) => item.id === task.id ? result.data : item));
    else { setTasks((current) => current.filter((item) => item.id !== task.id)); setMutationError(result.error); }
    setNewTitle("");
    setNewRelatedTo("");
    setShowQuickAdd(false);
    setActiveTab(newDate === today ? "today" : "pending");
  }

  function clearFilters() {
    setQuery("");
    setOwner("Todos");
    setPriority("Todas");
  }

  return (
    <div className="space-y-6">
      {mutationError ? <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{mutationError}</p> : null}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="flex items-center gap-2 text-sm font-medium text-cyan-700">
            <ListChecks className="size-4" aria-hidden="true" />
            Operaciones · Productividad
          </p>
          <h1 className="brand-heading mt-2 text-3xl text-slate-950">Tareas</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Organiza el siguiente paso y mantén cada relación en movimiento.
          </p>
        </div>
        <Button
          type="button"
          onClick={() => setShowQuickAdd((current) => !current)}
          aria-expanded={showQuickAdd}
          aria-controls="quick-add-task"
          className="bg-[#0a1226] text-white shadow-sm hover:bg-[#162448]"
        >
          {showQuickAdd ? <X aria-hidden="true" /> : <Plus aria-hidden="true" />}
          {showQuickAdd ? "Cerrar" : "Nueva tarea"}
        </Button>
      </div>

      <section aria-label="Resumen de tareas" className="grid gap-3 sm:grid-cols-3">
        <Card className="brand-surface gap-0 py-0">
          <CardContent className="flex items-center gap-3 p-4">
            <span className="flex size-10 items-center justify-center rounded-xl bg-cyan-50 text-cyan-700">
              <Circle className="size-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-xs font-medium text-slate-500">Por completar</p>
              <p className="text-xl font-bold tabular-nums text-slate-950">{counts.pending}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="brand-surface gap-0 py-0">
          <CardContent className="flex items-center gap-3 p-4">
            <span className="flex size-10 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
              <Clock3 className="size-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-xs font-medium text-slate-500">Para hoy</p>
              <p className="text-xl font-bold tabular-nums text-slate-950">{counts.today}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="brand-surface gap-0 py-0">
          <CardContent className="flex items-center gap-3 p-4">
            <span className="flex size-10 items-center justify-center rounded-xl bg-rose-50 text-rose-700">
              <AlertCircle className="size-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-xs font-medium text-slate-500">Vencidas</p>
              <p className="text-xl font-bold tabular-nums text-slate-950">{counts.overdue}</p>
            </div>
          </CardContent>
        </Card>
      </section>

      {showQuickAdd && (
        <section id="quick-add-task" className="brand-surface overflow-hidden" aria-labelledby="quick-add-heading">
          <form onSubmit={addTask}>
            <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3 sm:px-5">
              <span className="flex size-8 items-center justify-center rounded-lg bg-cyan-50 text-cyan-700">
                <Sparkles className="size-4" aria-hidden="true" />
              </span>
              <div>
                <h2 id="quick-add-heading" className="text-sm font-bold text-slate-900">Alta rápida</h2>
                <p className="text-xs text-slate-500">Captura el siguiente paso sin salir de la vista.</p>
              </div>
            </div>
            <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-[minmax(210px,2fr)_1fr_110px_120px_130px_1fr_auto] xl:items-end">
              <label className="block sm:col-span-2 xl:col-span-1">
                <span className="mb-1.5 block text-xs font-semibold text-slate-600">Tarea</span>
                <Input
                  value={newTitle}
                  onChange={(event) => setNewTitle(event.target.value)}
                  placeholder="Ej. Enviar propuesta revisada"
                  autoFocus
                  required
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-slate-600">Fecha</span>
                <Input type="date" value={newDate} onChange={(event) => setNewDate(event.target.value)} required />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-slate-600">Hora</span>
                <Input type="time" value={newTime} onChange={(event) => setNewTime(event.target.value)} />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-slate-600">Prioridad</span>
                <select
                  value={newPriority}
                  onChange={(event) => setNewPriority(event.target.value as TaskPriority)}
                  className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-200"
                >
                  {priorities.slice(1).map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-slate-600">Tipo</span>
                <select
                  value={newKind}
                  onChange={(event) => setNewKind(event.target.value as TaskKind)}
                  className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-200"
                >
                  {Object.keys(kindIcons).map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-slate-600">Vincular con</span>
                <Input
                  value={newRelatedTo}
                  onChange={(event) => setNewRelatedTo(event.target.value)}
                  placeholder="Empresa u oportunidad"
                />
              </label>
              <div className="sm:col-span-2 xl:col-span-1">
                <Button type="submit" className="self-end">
                  <Plus aria-hidden="true" />
                  Añadir
                </Button>
              </div>
            </div>
          </form>
        </section>
      )}

      <section className="brand-surface overflow-hidden" aria-label="Listado de tareas">
        <div className="border-b border-slate-200 px-4 pt-4 sm:px-5">
          <div className="flex gap-1 overflow-x-auto" role="tablist" aria-label="Estado de las tareas">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-inset sm:text-sm",
                  activeTab === tab.id
                    ? "border-cyan-500 text-slate-950"
                    : "border-transparent text-slate-500 hover:border-slate-200 hover:text-slate-800",
                )}
              >
                {tab.label}
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[10px] tabular-nums",
                    activeTab === tab.id ? "bg-cyan-50 text-cyan-700" : "bg-slate-100 text-slate-500",
                  )}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="border-b border-slate-200 bg-slate-50/70 p-4 sm:p-5">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <label htmlFor="task-search" className="sr-only">Buscar tareas</label>
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <Input
                id="task-search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar tarea, empresa u oportunidad…"
                className="pl-9"
              />
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex">
              <label className="relative">
                <span className="sr-only">Filtrar por responsable</span>
                <UserRound className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                <select
                  value={owner}
                  onChange={(event) => setOwner(event.target.value)}
                  className="h-9 w-full rounded-md border border-slate-200 bg-white pl-8 pr-7 text-xs font-medium text-slate-700 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-200"
                >
                  {owners.map((item) => (
                    <option key={item} value={item}>{item === "Todos" ? "Responsable" : item}</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              </label>
              <label className="relative">
                <span className="sr-only">Filtrar por prioridad</span>
                <Filter className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                <select
                  value={priority}
                  onChange={(event) => setPriority(event.target.value as "Todas" | TaskPriority)}
                  className="h-9 w-full rounded-md border border-slate-200 bg-white pl-8 pr-7 text-xs font-medium text-slate-700 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-200"
                >
                  {priorities.map((item) => (
                    <option key={item} value={item}>{item === "Todas" ? "Prioridad" : item}</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              </label>
              {hasFilters && (
                <Button type="button" variant="ghost" size="sm" onClick={clearFilters} className="col-span-2 text-slate-500">
                  <X aria-hidden="true" />
                  Limpiar
                </Button>
              )}
            </div>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-[11px] text-slate-500">
            <SlidersHorizontal className="size-3.5" aria-hidden="true" />
            {filteredTasks.length} {filteredTasks.length === 1 ? "tarea visible" : "tareas visibles"}
          </div>
        </div>

        <div role="tabpanel" aria-label={tabs.find((tab) => tab.id === activeTab)?.label}>
          {filteredTasks.length ? (
            filteredTasks.map((task) => <TaskRow key={task.id} task={task} today={today} onToggle={toggleTask} />)
          ) : (
            <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center">
              <span className="mb-3 flex size-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                <CheckCircle2 className="size-6" aria-hidden="true" />
              </span>
              <p className="font-semibold text-slate-800">Todo despejado</p>
              <p className="mt-1 max-w-sm text-sm text-slate-500">
                No hay tareas que coincidan con esta vista. Ajusta los filtros o crea una nueva.
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
