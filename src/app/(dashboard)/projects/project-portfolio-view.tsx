"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  CircleAlert,
  CircleDollarSign,
  Columns3,
  LayoutList,
  ListFilter,
  Plus,
  Search,
  Target,
  UsersRound,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { saveProjectAction, updateProjectStatusAction } from "@/actions/crm";
import type { CrmPriority as Priority, ProjectRecord, ProjectStatus } from "@/lib/appsync/crm";

const statusOrder: ProjectStatus[] = ["Planificación", "En curso", "En revisión", "Completado"];

const initialProjects = [
  { id: 1, name: "Retrofit eléctrico Warehouse #4", client: "Northline Logistics", status: "En curso", priority: "Alta", progress: 68, due: "22 de julio de 2026", dueShort: "22 jul", budget: 42800, spent: 26740, team: ["PD", "AR", "MS"], description: "Renovación eléctrica, control de iluminación y puesta en marcha del almacén.", accent: "bg-blue-500" },
  { id: 2, name: "Inspección solar Q3", client: "Greenridge Properties", status: "Planificación", priority: "Media", progress: 18, due: "18 de agosto de 2026", dueShort: "18 ago", budget: 76000, spent: 9100, team: ["PD", "AR"], description: "Inspección y mantenimiento preventivo de instalaciones solares en doce propiedades.", accent: "bg-amber-500" },
  { id: 3, name: "Mantenimiento HVAC anual", client: "Harborview Hospitality", status: "En revisión", priority: "Alta", progress: 88, due: "16 de julio de 2026", dueShort: "16 jul", budget: 31500, spent: 28190, team: ["MS", "JR", "AR"], description: "Cobertura preventiva y correctiva de sistemas HVAC para el portafolio hotelero.", accent: "bg-rose-500" },
  { id: 4, name: "Facility coverage East Region", client: "MetroCare Facilities", status: "En curso", priority: "Media", progress: 46, due: "05 de agosto de 2026", dueShort: "05 ago", budget: 18400, spent: 8800, team: ["MS", "PD"], description: "Cobertura de mantenimiento y respuesta de emergencia para la región este.", accent: "bg-cyan-500" },
  { id: 5, name: "Cobertura de cuadrilla eléctrica", client: "BrightSpan Construction", status: "Planificación", priority: "Alta", progress: 10, due: "30 de septiembre de 2026", dueShort: "30 sep", budget: 24000, spent: 2200, team: ["AR", "JR", "PD"], description: "Asignación de cuadrilla certificada para la nueva fase de construcción.", accent: "bg-blue-600" },
  { id: 6, name: "Renovación de cocina industrial", client: "Bayfront Hotel Group", status: "Completado", priority: "Baja", progress: 100, due: "30 de junio de 2026", dueShort: "30 jun", budget: 14300, spent: 13600, team: ["MS", "AR"], description: "Instalación y certificación de equipos para la cocina principal.", accent: "bg-emerald-500" },
  { id: 7, name: "Iluminación exterior", client: "Palm Coast Warehousing", status: "En revisión", priority: "Media", progress: 92, due: "14 de julio de 2026", dueShort: "14 jul", budget: 21600, spent: 19950, team: ["AR", "PD"], description: "Mejora de seguridad e iluminación eficiente del centro logístico.", accent: "bg-sky-500" },
];

const statusStyles: Record<ProjectStatus, string> = {
  Planificación: "border-slate-200 bg-slate-100 text-slate-700",
  "En curso": "border-cyan-200 bg-cyan-50 text-cyan-700",
  "En revisión": "border-amber-200 bg-amber-50 text-amber-700",
  Completado: "border-emerald-200 bg-emerald-50 text-emerald-700",
};

const priorityStyles: Record<Priority, string> = {
  Alta: "text-rose-600",
  Media: "text-amber-600",
  Baja: "text-emerald-600",
};

const money = new Intl.NumberFormat("es-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export function ProjectPortfolioView({ initialProjects: projectsFromServer }: { initialProjects: ProjectRecord[] }) {
  const [projects, setProjects] = useState<ProjectRecord[]>(projectsFromServer ?? initialProjects.map((project) => ({ ...project, id: String(project.id), dueDate: "2026-07-12", status: project.status as ProjectStatus, priority: project.priority as Priority })));
  const [mutationError, setMutationError] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"Todos" | ProjectStatus>("Todos");
  const [view, setView] = useState<"tablero" | "lista">("tablero");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const filtered = useMemo(() => {
    const normalized = query.toLocaleLowerCase("es").trim();
    return projects.filter((project) => (status === "Todos" || project.status === status) && [project.name, project.client].join(" ").toLocaleLowerCase("es").includes(normalized));
  }, [projects, query, status]);

  const active = projects.filter((project) => project.status === "En curso").length;
  const atRisk = projects.filter((project) => project.priority === "Alta" && project.status !== "Completado").length;
  const totalBudget = projects.reduce((sum, project) => sum + project.budget, 0);
  const selected = projects.find((project) => project.id === selectedId) ?? null;

  async function advanceProject(id: string) {
    const previous = projects;
    const project = projects.find((item) => item.id === id);
    if (!project) return;
    const currentIndex = statusOrder.indexOf(project.status);
    const targetStatus = statusOrder[Math.min(currentIndex + 1, statusOrder.length - 1)];
    setProjects((current) => current.map((project) => {
      if (project.id !== id) return project;
      const index = statusOrder.indexOf(project.status);
      const next = statusOrder[Math.min(index + 1, statusOrder.length - 1)];
      return { ...project, status: next, progress: next === "Completado" ? 100 : Math.max(project.progress, next === "En revisión" ? 85 : 35) };
    }));
    setMutationError("");
    const result = await updateProjectStatusAction(id, targetStatus);
    if (!result.ok) { setProjects(previous); setMutationError(result.error); }
  }

  async function addProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const record: ProjectRecord = {
      id: crypto.randomUUID(),
      name: String(data.get("name") || "Nuevo proyecto"),
      client: String(data.get("client") || "Cliente por asignar"),
      status: "Planificación",
      priority: String(data.get("priority") || "Media") as Priority,
      progress: 5,
      due: String(data.get("due") || "Fecha por definir"),
      dueShort: String(data.get("due") || "Por definir"),
      dueDate: String(data.get("due") || ""),
      budget: Number(data.get("budget")) || 0,
      spent: 0,
      team: ["PD"],
      description: String(data.get("description") || "Proyecto recién creado."),
      accent: "bg-cyan-500",
    };
    setProjects((current) => [record, ...current]);
    setMutationError("");
    const result = await saveProjectAction({ name: record.name, client: record.client, priority: record.priority, dueDate: record.dueDate, budget: record.budget, description: record.description });
    if (result.ok) {
      setProjects((current) => current.map((project) => project.id === record.id ? result.data : project));
      setSelectedId(result.data.id);
    } else {
      setProjects((current) => current.filter((project) => project.id !== record.id));
      setMutationError(result.error);
      setSelectedId(null);
    }
    setShowCreate(false);
  }

  return (
    <>
      {mutationError ? <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{mutationError}</p> : null}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Resumen de proyectos">
        <ProjectMetric icon={Target} label="Proyectos activos" value={String(active)} detail={`${projects.length} en total`} tone="cyan" />
        <ProjectMetric icon={CheckCircle2} label="Completados" value={String(projects.filter((item) => item.status === "Completado").length)} detail="este trimestre" tone="emerald" />
        <ProjectMetric icon={CircleAlert} label="Prioridad alta" value={String(atRisk)} detail="requieren atención" tone="rose" />
        <ProjectMetric icon={CircleDollarSign} label="Presupuesto" value={money.format(totalBudget)} detail="cartera total" tone="blue" />
      </section>

      <Card className="brand-surface gap-0 overflow-hidden py-0">
        <div className="border-b border-slate-200 px-4 py-4 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="brand-heading text-lg text-slate-950">Cartera de proyectos</h2>
              <p className="text-sm text-slate-500">{filtered.length} proyectos visibles</p>
            </div>
            <Button onClick={() => setShowCreate(true)} className="bg-cyan-500 text-slate-950 hover:bg-cyan-400"><Plus /> Nuevo proyecto</Button>
          </div>

          <div className="mt-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-1 flex-col gap-2 sm:flex-row">
              <div className="relative w-full sm:max-w-xs">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar proyecto o cliente…" className="pl-9" aria-label="Buscar proyectos" />
              </div>
              <label className="relative">
                <ListFilter className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <select value={status} onChange={(event) => setStatus(event.target.value as typeof status)} className="h-9 w-full rounded-md border border-slate-300 bg-white pl-9 pr-8 text-sm text-slate-700 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200 sm:w-auto">
                  <option>Todos</option>{statusOrder.map((item) => <option key={item}>{item}</option>)}
                </select>
              </label>
            </div>
            <div className="flex w-fit rounded-lg bg-slate-100 p-1">
              <ViewButton active={view === "tablero"} onClick={() => setView("tablero")} icon={Columns3} label="Tablero" />
              <ViewButton active={view === "lista"} onClick={() => setView("lista")} icon={LayoutList} label="Lista" />
            </div>
          </div>
        </div>

        <CardContent className="p-0">
          {filtered.length === 0 ? <EmptyProjects /> : view === "tablero" ? (
            <div className="grid gap-px bg-slate-200 lg:grid-cols-4">
              {statusOrder.map((column) => {
                const columnProjects = filtered.filter((project) => project.status === column);
                return <section key={column} className="min-w-0 bg-slate-50/80 p-3"><div className="mb-3 flex items-center justify-between"><div className="flex items-center gap-2"><span className={cn("size-2 rounded-full", column === "Planificación" && "bg-slate-400", column === "En curso" && "bg-cyan-500", column === "En revisión" && "bg-amber-500", column === "Completado" && "bg-emerald-500")} /><h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">{column}</h3></div><span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold text-slate-500 shadow-sm">{columnProjects.length}</span></div><div className="space-y-3">{columnProjects.map((project) => <ProjectBoardCard key={project.id} project={project} onOpen={() => setSelectedId(project.id)} />)}{columnProjects.length === 0 && <div className="rounded-xl border border-dashed border-slate-300 px-3 py-8 text-center text-xs text-slate-400">Sin proyectos</div>}</div></section>;
              })}
            </div>
          ) : (
            <ProjectList projects={filtered} onOpen={setSelectedId} />
          )}
        </CardContent>
      </Card>

      {selected && <ProjectDetail project={selected} onAdvance={() => advanceProject(selected.id)} onClose={() => setSelectedId(null)} />}
      {showCreate && <CreateProjectModal onClose={() => setShowCreate(false)} onSubmit={addProject} />}
    </>
  );
}

function ProjectMetric({ icon: Icon, label, value, detail, tone }: { icon: typeof Target; label: string; value: string; detail: string; tone: "cyan" | "emerald" | "rose" | "blue" }) {
  const styles = { cyan: "bg-cyan-50 text-cyan-700", emerald: "bg-emerald-50 text-emerald-700", rose: "bg-rose-50 text-rose-700", blue: "bg-blue-50 text-blue-700" }[tone];
  return <div className="rounded-xl border border-white/40 bg-white/95 p-4 shadow-lg shadow-slate-950/10"><div className="flex items-center justify-between"><span className={cn("rounded-lg p-2", styles)}><Icon className="size-4" /></span><span className="text-[11px] text-slate-400">{detail}</span></div><p className="mt-3 text-xl font-bold text-slate-950">{value}</p><p className="mt-0.5 text-xs font-medium text-slate-500">{label}</p></div>;
}

function ViewButton({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: typeof Columns3; label: string }) {
  return <button type="button" onClick={onClick} className={cn("flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition", active ? "bg-white text-slate-950 shadow-sm" : "text-slate-500")}><Icon className="size-3.5" />{label}</button>;
}

function ProjectBoardCard({ project, onOpen }: { project: ProjectRecord; onOpen: () => void }) {
  return <button type="button" onClick={onOpen} className="w-full rounded-xl border border-slate-200 bg-white p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"><div className="flex items-center justify-between gap-2"><span className={cn("h-1.5 w-8 rounded-full", project.accent)} /><span className={cn("text-[10px] font-bold uppercase", priorityStyles[project.priority])}>{project.priority}</span></div><h4 className="mt-3 text-sm font-semibold leading-snug text-slate-900">{project.name}</h4><p className="mt-1 text-xs text-slate-500">{project.client}</p><div className="mt-4"><div className="mb-1.5 flex justify-between text-[10px] font-semibold text-slate-500"><span>Progreso</span><span>{project.progress}%</span></div><div className="h-1.5 overflow-hidden rounded-full bg-slate-100"><div className={cn("h-full rounded-full", project.accent)} style={{ width: `${project.progress}%` }} /></div></div><div className="mt-4 flex items-center justify-between"><TeamStack team={project.team} /><span className="flex items-center gap-1 text-[10px] font-medium text-slate-500"><CalendarDays className="size-3" />{project.dueShort}</span></div></button>;
}

function TeamStack({ team }: { team: string[] }) {
  return <div className="flex -space-x-1.5">{team.map((member, index) => <span key={`${member}-${index}`} className={cn("flex size-6 items-center justify-center rounded-full border-2 border-white text-[8px] font-bold", ["bg-blue-100 text-blue-700", "bg-cyan-100 text-cyan-700", "bg-amber-100 text-amber-700"][index % 3])}>{member}</span>)}</div>;
}

function ProjectList({ projects, onOpen }: { projects: ProjectRecord[]; onOpen: (id: string) => void }) {
  return <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500"><tr><th className="px-5 py-3 font-semibold">Proyecto</th><th className="px-3 py-3 font-semibold">Estado</th><th className="px-3 py-3 font-semibold">Progreso</th><th className="px-3 py-3 font-semibold">Presupuesto</th><th className="px-3 py-3 font-semibold">Entrega</th><th className="px-5 py-3" /></tr></thead><tbody className="divide-y divide-slate-100">{projects.map((project) => <tr key={project.id} className="hover:bg-slate-50"><td className="px-5 py-4"><button type="button" onClick={() => onOpen(project.id)} className="flex items-center gap-3 text-left"><span className={cn("size-2.5 rounded-full", project.accent)} /><span><span className="block font-semibold text-slate-900">{project.name}</span><span className="text-xs text-slate-500">{project.client}</span></span></button></td><td className="px-3 py-4"><Badge variant="outline" className={statusStyles[project.status]}>{project.status}</Badge></td><td className="min-w-36 px-3 py-4"><div className="flex items-center gap-2"><div className="h-1.5 w-20 rounded-full bg-slate-100"><div className={cn("h-full rounded-full", project.accent)} style={{ width: `${project.progress}%` }} /></div><span className="text-xs font-semibold text-slate-600">{project.progress}%</span></div></td><td className="px-3 py-4 font-semibold text-slate-700">{money.format(project.budget)}</td><td className="whitespace-nowrap px-3 py-4 text-slate-600">{project.dueShort}</td><td className="px-5 py-4"><button type="button" onClick={() => onOpen(project.id)} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-900"><ArrowRight className="size-4" /></button></td></tr>)}</tbody></table></div>;
}

function EmptyProjects() {
  return <div className="flex flex-col items-center px-6 py-16 text-center"><Search className="mb-3 size-8 text-slate-300" /><p className="font-semibold text-slate-800">No encontramos proyectos</p><p className="mt-1 text-sm text-slate-500">Ajusta la búsqueda o selecciona otro estado.</p></div>;
}

function ProjectDetail({ project, onAdvance, onClose }: { project: ProjectRecord; onAdvance: () => void; onClose: () => void }) {
  const remaining = project.budget - project.spent;
  return <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/45 p-3 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={`Proyecto ${project.name}`} onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}><aside className="h-full w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-2xl"><div className="flex items-center justify-between border-b border-slate-100 p-5"><p className="text-sm font-semibold text-slate-500">Detalle del proyecto</p><button type="button" onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-slate-100"><X className="size-4" /></button></div><div className="p-6"><div className="flex items-center gap-2"><span className={cn("h-2 w-10 rounded-full", project.accent)} /><span className={cn("text-xs font-bold uppercase", priorityStyles[project.priority])}>Prioridad {project.priority}</span></div><h2 className="brand-heading mt-4 text-2xl text-slate-950">{project.name}</h2><p className="mt-1 text-sm font-medium text-cyan-700">{project.client}</p><p className="mt-4 text-sm leading-6 text-slate-600">{project.description}</p><div className="mt-6 rounded-xl border border-slate-200 p-4"><div className="flex justify-between"><span className="text-sm font-semibold text-slate-700">Progreso general</span><span className="text-sm font-bold text-slate-950">{project.progress}%</span></div><div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-100"><div className={cn("h-full rounded-full", project.accent)} style={{ width: `${project.progress}%` }} /></div><div className="mt-4 flex items-center justify-between"><Badge variant="outline" className={statusStyles[project.status]}>{project.status}</Badge>{project.status !== "Completado" && <Button size="sm" onClick={onAdvance}>Avanzar fase <ArrowRight /></Button>}</div></div><div className="mt-6 grid gap-3 sm:grid-cols-2"><InfoBox icon={CalendarDays} label="Fecha de entrega" value={project.due} /><InfoBox icon={UsersRound} label="Equipo asignado" value={`${project.team.length} personas`} /></div><div className="mt-6"><h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Control presupuestario</h3><div className="mt-3 grid grid-cols-3 gap-2 rounded-xl bg-slate-950 p-4 text-white"><BudgetValue label="Presupuesto" value={money.format(project.budget)} /><BudgetValue label="Consumido" value={money.format(project.spent)} /><BudgetValue label="Disponible" value={money.format(remaining)} positive={remaining >= 0} /></div></div><div className="mt-6"><h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Equipo</h3><div className="mt-3 flex items-center justify-between rounded-xl border border-slate-200 p-4"><TeamStack team={project.team} /><span className="text-xs text-slate-500">Equipo del proyecto</span></div></div></div></aside></div>;
}

function InfoBox({ icon: Icon, label, value }: { icon: typeof CalendarDays; label: string; value: string }) {
  return <div className="rounded-xl border border-slate-200 p-4"><Icon className="size-4 text-cyan-600" /><p className="mt-3 text-xs text-slate-500">{label}</p><p className="mt-1 text-sm font-semibold text-slate-800">{value}</p></div>;
}

function BudgetValue({ label, value, positive }: { label: string; value: string; positive?: boolean }) {
  return <div><p className="text-[10px] text-slate-400">{label}</p><p className={cn("mt-1 text-sm font-bold", positive && "text-emerald-300")}>{value}</p></div>;
}

function CreateProjectModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/50 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Nuevo proyecto" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
      <form onSubmit={onSubmit} className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between">
          <div><h2 className="brand-heading text-xl text-slate-950">Nuevo proyecto</h2><p className="mt-1 text-sm text-slate-500">Crea el proyecto y completa los detalles esenciales.</p></div>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-slate-100" aria-label="Cerrar"><X className="size-4" /></button>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <ProjectField label="Nombre del proyecto" name="name" placeholder="Retrofit eléctrico" required />
          <ProjectField label="Cliente" name="client" placeholder="Nombre de la empresa" required />
          <ProjectField label="Presupuesto (USD)" name="budget" placeholder="25000" type="number" required />
          <ProjectField label="Entrega" name="due" placeholder="2026-09-30" type="date" required />
          <label className="space-y-1.5 text-sm font-medium text-slate-700">Prioridad<select name="priority" className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"><option>Media</option><option>Alta</option><option>Baja</option></select></label>
          <label className="space-y-1.5 text-sm font-medium text-slate-700 sm:col-span-2">Descripción<textarea name="description" rows={3} placeholder="Objetivo y alcance del proyecto…" className="w-full resize-none rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200" /></label>
        </div>
        <div className="mt-6 flex justify-end gap-3"><Button type="button" variant="outline" onClick={onClose}>Cancelar</Button><Button type="submit" className="bg-cyan-500 text-slate-950 hover:bg-cyan-400"><Plus /> Crear proyecto</Button></div>
      </form>
    </div>
  );
}

function ProjectField({ label, name, placeholder, type = "text", required = false }: { label: string; name: string; placeholder: string; type?: string; required?: boolean }) {
  return <label className="space-y-1.5 text-sm font-medium text-slate-700">{label}<Input name={name} type={type} placeholder={placeholder} required={required} /></label>;
}
