"use client";

import {
  ArrowUpRight,
  Building2,
  ChevronRight,
  CircleDollarSign,
  FileText,
  Filter,
  Globe2,
  Mail,
  MapPin,
  MoreHorizontal,
  Phone,
  Plus,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";

import { ClientForm } from "@/components/workspace/forms";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { Client } from "@/lib/appsync/workspace";

const clientDetails: Record<string, { industry: string; status: "Activo" | "Prospecto" | "Inactivo"; owner: string; revenue: string; open: string; contact: string; website: string; last: string }> = {
  "Northline Logistics": { industry: "Logística", status: "Activo", owner: "María S.", revenue: "$64,800", open: "$42,800", contact: "Daniel Cooper", website: "northline.example", last: "Hoy, 09:30" },
  "Greenridge Properties": { industry: "Property management", status: "Activo", owner: "Pablo D.", revenue: "$51,200", open: "$76,000", contact: "Laura Bennett", website: "greenridge.example", last: "Ayer, 16:20" },
  "Harborview Hospitality": { industry: "Hotelería", status: "Prospecto", owner: "María S.", revenue: "$0", open: "$31,500", contact: "Olivia Martin", website: "harborview.example", last: "10 jul, 11:05" },
  "MetroCare Facilities": { industry: "Mantenimiento", status: "Activo", owner: "Pablo D.", revenue: "$28,400", open: "$18,400", contact: "James Wilson", website: "metrocare.example", last: "8 jul, 14:45" },
  "BrightSpan Construction": { industry: "Construcción", status: "Inactivo", owner: "Alex R.", revenue: "$17,900", open: "$0", contact: "Emma Ross", website: "brightspan.example", last: "28 jun, 10:15" },
};

function detailsFor(client: Client) {
  return clientDetails[client.name] ?? { industry: "Servicios", status: "Activo" as const, owner: "Pablo D.", revenue: "$0", open: "$0", contact: client.name, website: "—", last: "Sin actividad" };
}

function initials(name: string) {
  return name.split(" ").slice(0, 2).map((part) => part[0]).join("");
}

function StatusBadge({ status }: { status: "Activo" | "Prospecto" | "Inactivo" }) {
  const className = status === "Activo" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : status === "Prospecto" ? "border-cyan-200 bg-cyan-50 text-cyan-700" : "border-slate-200 bg-slate-100 text-slate-500";
  return <Badge variant="outline" className={className}><span className="size-1.5 rounded-full bg-current" />{status}</Badge>;
}

export function ClientWorkspace({ clients }: { clients: Client[] }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("Todos");
  const [selected, setSelected] = useState<Client | null>(clients[0] ?? null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);

  const filtered = useMemo(() => clients.filter((client) => {
    const detail = detailsFor(client);
    const haystack = `${client.name} ${client.email ?? ""} ${detail.industry}`.toLowerCase();
    return haystack.includes(query.toLowerCase()) && (status === "Todos" || detail.status === status);
  }), [clients, query, status]);

  const activeDetail = selected ? detailsFor(selected) : null;

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="flex items-center gap-2 text-sm font-medium text-cyan-700"><Sparkles className="size-4" />CRM · Empresas</p>
          <h1 className="brand-heading mt-2 text-3xl text-slate-950">Clientes</h1>
          <p className="mt-1 text-sm text-slate-500">Centraliza relaciones, oportunidades, proyectos y facturación.</p>
        </div>
        <Button onClick={() => { setEditing(null); setFormOpen(true); }} className="h-10 rounded-lg bg-[#0a1226] text-white hover:bg-[#162448]"><Plus />Nuevo cliente</Button>
      </div>

      <section className="grid gap-3 sm:grid-cols-3">
        {[
          ["Clientes activos", "3", "+1 este mes", Building2, "text-blue-700 bg-blue-50"],
          ["Facturación acumulada", "$162,300", "+11.8%", CircleDollarSign, "text-emerald-700 bg-emerald-50"],
          ["Oportunidades abiertas", "$168,700", "4 oportunidades", ArrowUpRight, "text-cyan-700 bg-cyan-50"],
        ].map(([label, value, note, Icon, tone]) => (
          <Card key={String(label)} className="gap-0 rounded-2xl py-4 shadow-sm"><CardContent className="flex items-center gap-4 px-4"><span className={`flex size-10 items-center justify-center rounded-xl ${tone}`}><Icon className="size-5" /></span><div><p className="text-xs font-medium text-slate-500">{String(label)}</p><p className="brand-heading mt-1 text-xl text-slate-950">{String(value)}</p><p className="mt-0.5 text-xs text-slate-400">{String(note)}</p></div></CardContent></Card>
        ))}
      </section>

      <Card className="gap-0 overflow-hidden rounded-2xl py-0 shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por empresa, email o industria…" className="h-10 border-slate-200 bg-slate-50 pl-9" /></div>
          <div className="flex items-center gap-2">
            <Filter className="size-4 text-slate-400" />
            <label htmlFor="client-status" className="sr-only">Filtrar por estado</label>
            <select id="client-status" value={status} onChange={(event) => setStatus(event.target.value)} className="h-10 flex-1 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 sm:flex-none">
              <option>Todos</option><option>Activo</option><option>Prospecto</option><option>Inactivo</option>
            </select>
          </div>
        </div>

        <div className="grid min-h-[520px] xl:grid-cols-[minmax(0,1fr)_390px]">
          <div className="min-w-0 overflow-x-auto border-r border-slate-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500"><tr><th className="px-4 py-3">Empresa</th><th className="hidden px-4 py-3 md:table-cell">Industria</th><th className="hidden px-4 py-3 sm:table-cell">Estado</th><th className="hidden px-4 py-3 lg:table-cell">Responsable</th><th className="px-4 py-3 text-right">Facturado</th><th className="w-10" /></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((client) => {
                  const detail = detailsFor(client);
                  const isSelected = selected?.clientId === client.clientId;
                  return <tr key={client.clientId} onClick={() => setSelected(client)} className={`cursor-pointer transition hover:bg-slate-50 ${isSelected ? "bg-cyan-50/60" : "bg-white"}`}>
                    <td className="px-4 py-3"><div className="flex items-center gap-3"><span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#0a1226] text-xs font-semibold text-white">{initials(client.name)}</span><div className="min-w-0"><p className="truncate font-semibold text-slate-900">{client.name}</p><p className="mt-0.5 truncate text-xs text-slate-400">{client.email}</p></div></div></td>
                    <td className="hidden px-4 py-3 text-slate-600 md:table-cell">{detail.industry}</td>
                    <td className="hidden px-4 py-3 sm:table-cell"><StatusBadge status={detail.status} /></td>
                    <td className="hidden px-4 py-3 text-slate-600 lg:table-cell">{detail.owner}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-900">{detail.revenue}</td>
                    <td className="px-2"><ChevronRight className="size-4 text-slate-300" /></td>
                  </tr>;
                })}
              </tbody>
            </table>
            {!filtered.length ? <div className="p-12 text-center"><Search className="mx-auto size-8 text-slate-300" /><p className="mt-3 font-medium text-slate-700">No encontramos clientes</p><p className="mt-1 text-sm text-slate-400">Prueba con otros filtros o crea un registro.</p></div> : null}
          </div>

          {selected && activeDetail ? (
            <aside className="hidden bg-slate-50/60 p-5 xl:block" aria-label={`Detalle de ${selected.name}`}>
              <div className="flex items-start justify-between gap-3"><div className="flex items-center gap-3"><span className="flex size-11 items-center justify-center rounded-xl bg-[#0a1226] font-semibold text-white">{initials(selected.name)}</span><div><h2 className="brand-heading text-lg text-slate-950">{selected.name}</h2><p className="text-sm text-slate-500">{activeDetail.industry}</p></div></div><Button variant="ghost" size="icon-sm" aria-label="Más acciones"><MoreHorizontal /></Button></div>
              <div className="mt-5 flex gap-2"><Button size="sm" className="flex-1 rounded-lg"><Mail />Email</Button><Button variant="outline" size="sm" className="flex-1 rounded-lg"><Phone />Llamar</Button></div>
              <div className="mt-6 grid grid-cols-2 gap-2"><div className="rounded-xl border bg-white p-3"><p className="text-xs text-slate-400">Facturado</p><p className="mt-1 font-semibold text-slate-900">{activeDetail.revenue}</p></div><div className="rounded-xl border bg-white p-3"><p className="text-xs text-slate-400">Pipeline</p><p className="mt-1 font-semibold text-slate-900">{activeDetail.open}</p></div></div>
              <div className="mt-6 border-b border-slate-200"><button className="border-b-2 border-cyan-500 px-1 pb-2 text-sm font-semibold text-slate-900">Resumen</button><button className="px-4 pb-2 text-sm text-slate-400">Actividad</button><button className="px-1 pb-2 text-sm text-slate-400">Facturas</button></div>
              <dl className="mt-5 space-y-4 text-sm">
                <div><dt className="text-xs text-slate-400">Contacto principal</dt><dd className="mt-1 font-medium text-slate-800">{activeDetail.contact}</dd></div>
                <div><dt className="flex items-center gap-1.5 text-xs text-slate-400"><Mail className="size-3" />Email</dt><dd className="mt-1 truncate text-slate-700">{selected.email || "—"}</dd></div>
                <div><dt className="flex items-center gap-1.5 text-xs text-slate-400"><Phone className="size-3" />Teléfono</dt><dd className="mt-1 text-slate-700">{selected.phone || "—"}</dd></div>
                <div><dt className="flex items-center gap-1.5 text-xs text-slate-400"><Globe2 className="size-3" />Sitio web</dt><dd className="mt-1 text-slate-700">{activeDetail.website}</dd></div>
                <div><dt className="flex items-center gap-1.5 text-xs text-slate-400"><MapPin className="size-3" />Dirección</dt><dd className="mt-1 leading-relaxed text-slate-700">{selected.address || "—"}</dd></div>
              </dl>
              <div className="mt-6 rounded-xl border border-cyan-100 bg-cyan-50 p-3"><p className="text-xs font-semibold text-cyan-800">Próxima oportunidad</p><p className="mt-1 text-sm text-cyan-950">Seguimiento comercial · {activeDetail.last}</p></div>
              <Button onClick={() => { setEditing(selected); setFormOpen(true); }} variant="outline" className="mt-5 w-full bg-white">Editar cliente</Button>
            </aside>
          ) : null}
        </div>
      </Card>

      {formOpen ? <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/35 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={editing ? "Editar cliente" : "Nuevo cliente"} onMouseDown={(event) => { if (event.currentTarget === event.target) setFormOpen(false); }}>
        <div className="h-full w-full max-w-lg overflow-y-auto bg-white p-5 shadow-2xl sm:p-7">
          <div className="flex items-start justify-between gap-4"><div><p className="text-sm font-medium text-cyan-700">Directorio CRM</p><h2 className="brand-heading mt-1 text-2xl text-slate-950">{editing ? "Editar cliente" : "Nuevo cliente"}</h2><p className="mt-1 text-sm text-slate-500">Guarda la información comercial y de contacto.</p></div><Button variant="ghost" size="icon" onClick={() => setFormOpen(false)} aria-label="Cerrar"><X /></Button></div>
          <div className="mt-7"><ClientForm client={editing ?? undefined} /></div>
          <div className="mt-8 rounded-xl bg-slate-50 p-4 text-sm text-slate-500"><FileText className="mb-2 size-5 text-slate-400" />Las oportunidades, proyectos y facturas vinculadas permanecen asociadas a este cliente.</div>
        </div>
      </div> : null}
    </div>
  );
}
