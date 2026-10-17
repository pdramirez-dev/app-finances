"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  ArrowUpRight,
  Building2,
  ChevronRight,
  Mail,
  MapPin,
  Phone,
  Plus,
  Search,
  Sparkles,
  Star,
  UserRoundPlus,
  UsersRound,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { saveContactAction, setContactFavoriteAction } from "@/actions/crm";
import type { ContactKind, ContactRecord } from "@/lib/appsync/crm";

const initialContacts = [
  { id: 1, name: "Daniel Cooper", role: "Director de Operaciones", company: "Northline Logistics", email: "daniel@northline.example", phone: "+1 407 555 0100", location: "Orlando, FL", kind: "Cliente", initials: "DC", lastContact: "Hoy, 10:42", value: "$64,800", color: "bg-blue-100 text-blue-700" },
  { id: 2, name: "Olivia Martin", role: "Directora de Facilities", company: "Harborview Hospitality", email: "olivia@harborview.example", phone: "+1 305 555 0188", location: "Miami, FL", kind: "Lead", initials: "OM", lastContact: "Ayer, 16:20", value: "$31,500", color: "bg-cyan-100 text-cyan-700" },
  { id: 3, name: "Laura Bennett", role: "Portfolio Manager", company: "Greenridge Properties", email: "laura@greenridge.example", phone: "+1 813 555 0132", location: "Tampa, FL", kind: "Cliente", initials: "LB", lastContact: "08 jul", value: "$51,200", color: "bg-emerald-100 text-emerald-700" },
  { id: 4, name: "James Wilson", role: "Regional Manager", company: "MetroCare Facilities", email: "james@metrocare.example", phone: "+1 407 555 0164", location: "Kissimmee, FL", kind: "Cliente", initials: "JW", lastContact: "05 jul", value: "$28,400", color: "bg-amber-100 text-amber-800" },
  { id: 5, name: "Emma Ross", role: "Project Executive", company: "BrightSpan Construction", email: "emma@brightspan.example", phone: "+1 863 555 0190", location: "Lakeland, FL", kind: "Lead", initials: "ER", lastContact: "02 jul", value: "$24,000", color: "bg-rose-100 text-rose-700" },
  { id: 6, name: "Rachel Morgan", role: "Facilities Director", company: "Lakeside Medical Group", email: "rachel@lakesidemed.example", phone: "+1 321 555 0180", location: "Melbourne, FL", kind: "Lead", initials: "RM", lastContact: "28 jun", value: "$39,200", color: "bg-sky-100 text-sky-700" },
  { id: 7, name: "Nathan Cole", role: "Maintenance Lead", company: "Orange Grove Retail", email: "nathan@orangegrove.example", phone: "+1 407 555 0122", location: "Orlando, FL", kind: "Partner", initials: "NC", lastContact: "22 jun", value: "—", color: "bg-slate-100 text-slate-700" },
];

const kindStyles: Record<ContactKind, string> = {
  Cliente: "border-emerald-200 bg-emerald-50 text-emerald-700",
  Lead: "border-amber-200 bg-amber-50 text-amber-700",
  Partner: "border-blue-200 bg-blue-50 text-blue-700",
};

const filters = ["Todos", "Cliente", "Lead", "Partner"] as const;

export function ContactsCrmView({ initialContacts: contactsFromServer }: { initialContacts: ContactRecord[] }) {
  const [contacts, setContacts] = useState<ContactRecord[]>(contactsFromServer ?? initialContacts.map((contact) => ({ ...contact, id: String(contact.id), kind: contact.kind as ContactKind, favorite: [1, 3, 6].includes(contact.id) })));
  const [mutationError, setMutationError] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<(typeof filters)[number]>("Todos");
  const [favorites, setFavorites] = useState<string[]>(contacts.filter((contact) => contact.favorite).map((contact) => contact.id));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const visibleContacts = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("es");
    return contacts.filter((contact) => {
      const matchesFilter = filter === "Todos" || contact.kind === filter;
      const matchesQuery = [contact.name, contact.company, contact.email, contact.role]
        .join(" ")
        .toLocaleLowerCase("es")
        .includes(normalized);
      return matchesFilter && matchesQuery;
    });
  }, [contacts, filter, query]);

  const selected = contacts.find((contact) => contact.id === selectedId) ?? null;
  const clientCount = contacts.filter((contact) => contact.kind === "Cliente").length;
  const leadCount = contacts.filter((contact) => contact.kind === "Lead").length;

  async function toggleFavorite(id: string) {
    const previous = favorites;
    const favorite = !favorites.includes(id);
    setFavorites((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
    setMutationError("");
    const result = await setContactFavoriteAction(id, favorite);
    if (!result.ok) { setFavorites(previous); setMutationError(result.error); }
  }

  async function addContact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = String(data.get("name") || "Nuevo contacto").trim();
    const company = String(data.get("company") || "Sin empresa").trim();
    const kind = String(data.get("kind") || "Lead") as ContactKind;
    const newContact: ContactRecord = {
      id: crypto.randomUUID(),
      name,
      company,
      kind,
      role: String(data.get("role") || "Contacto principal"),
      email: String(data.get("email") || "sin-email@empresa.example"),
      phone: String(data.get("phone") || "Sin teléfono"),
      location: "Florida, EE. UU.",
      initials: name.split(" ").slice(0, 2).map((word) => word[0]).join("").toUpperCase(),
      lastContact: "Ahora",
      value: kind === "Partner" ? "—" : "Por estimar",
      color: "bg-slate-100 text-slate-700",
      favorite: false,
    };
    setContacts((current) => [newContact, ...current]);
    setMutationError("");
    const result = await saveContactAction({ name, company, kind, role: newContact.role, email: newContact.email, phone: newContact.phone, location: newContact.location });
    if (result.ok) {
      setContacts((current) => current.map((contact) => contact.id === newContact.id ? result.data : contact));
      setSelectedId(result.data.id);
    } else {
      setContacts((current) => current.filter((contact) => contact.id !== newContact.id));
      setMutationError(result.error);
      setSelectedId(null);
    }
    setShowCreate(false);
  }

  return (
    <>
      {mutationError ? <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{mutationError}</p> : null}
      <section className="grid gap-3 sm:grid-cols-3" aria-label="Resumen de contactos">
        <SummaryCard icon={UsersRound} label="Contactos activos" value={String(contacts.length)} detail="+3 este mes" tone="cyan" />
        <SummaryCard icon={Building2} label="Clientes" value={String(clientCount)} detail="3 cuentas clave" tone="blue" />
        <SummaryCard icon={Sparkles} label="Oportunidades" value={String(leadCount)} detail="$94,700 potenciales" tone="amber" />
      </section>

      <Card className="brand-surface gap-0 overflow-hidden py-0">
        <div className="flex flex-col gap-4 border-b border-slate-200 px-4 py-4 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="brand-heading text-lg text-slate-950">Directorio comercial</h2>
              <p className="text-sm text-slate-500">{visibleContacts.length} de {contacts.length} contactos</p>
            </div>
            <Button onClick={() => setShowCreate(true)} className="bg-cyan-500 text-slate-950 hover:bg-cyan-400">
              <UserRoundPlus /> Nuevo contacto
            </Button>
          </div>

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full lg:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nombre, empresa o email…" className="pl-9" aria-label="Buscar contactos" />
            </div>
            <div className="flex gap-1 overflow-x-auto rounded-lg bg-slate-100 p-1" aria-label="Filtrar contactos">
              {filters.map((item) => (
                <button key={item} type="button" onClick={() => setFilter(item)} className={cn("rounded-md px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition", filter === item ? "bg-white text-slate-950 shadow-sm" : "text-slate-500 hover:text-slate-800")}>{item}</button>
              ))}
            </div>
          </div>
        </div>

        <CardContent className="p-0">
          {visibleContacts.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
              <Search className="mb-3 size-8 text-slate-300" />
              <p className="font-semibold text-slate-800">No hay coincidencias</p>
              <p className="mt-1 text-sm text-slate-500">Prueba con otro término o cambia el filtro.</p>
            </div>
          ) : (
            <>
              <div className="divide-y divide-slate-100 md:hidden">
                {visibleContacts.map((contact) => (
                  <ContactMobileCard key={contact.id} contact={contact} favorite={favorites.includes(contact.id)} onFavorite={() => toggleFavorite(contact.id)} onOpen={() => setSelectedId(contact.id)} />
                ))}
              </div>

              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50/80 text-xs uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="w-12 px-5 py-3"><span className="sr-only">Favorito</span></th>
                      <th className="px-3 py-3 font-semibold">Contacto</th>
                      <th className="px-3 py-3 font-semibold">Relación</th>
                      <th className="px-3 py-3 font-semibold">Último contacto</th>
                      <th className="px-3 py-3 font-semibold">Valor</th>
                      <th className="w-12 px-5 py-3"><span className="sr-only">Abrir</span></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {visibleContacts.map((contact) => (
                      <tr key={contact.id} className="group hover:bg-slate-50/80">
                        <td className="px-5 py-4"><FavoriteButton active={favorites.includes(contact.id)} onClick={() => toggleFavorite(contact.id)} /></td>
                        <td className="px-3 py-4">
                          <button type="button" onClick={() => setSelectedId(contact.id)} className="flex items-center gap-3 text-left">
                            <Avatar contact={contact} />
                            <span><span className="block font-semibold text-slate-900">{contact.name}</span><span className="block text-xs text-slate-500">{contact.role} · {contact.company}</span></span>
                          </button>
                        </td>
                        <td className="px-3 py-4"><Badge variant="outline" className={kindStyles[contact.kind]}>{contact.kind}</Badge></td>
                        <td className="px-3 py-4 text-slate-600">{contact.lastContact}</td>
                        <td className="px-3 py-4 font-semibold text-slate-800">{contact.value}</td>
                        <td className="px-5 py-4"><button type="button" onClick={() => setSelectedId(contact.id)} className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-900" aria-label={`Ver ${contact.name}`}><ChevronRight className="size-4" /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {selected && <ContactDetail contact={selected} favorite={favorites.includes(selected.id)} onFavorite={() => toggleFavorite(selected.id)} onClose={() => setSelectedId(null)} />}
      {showCreate && <CreateContactModal onClose={() => setShowCreate(false)} onSubmit={addContact} />}
    </>
  );
}

function SummaryCard({ icon: Icon, label, value, detail, tone }: { icon: typeof UsersRound; label: string; value: string; detail: string; tone: "cyan" | "blue" | "amber" }) {
  const toneClass = { cyan: "bg-cyan-50 text-cyan-700", blue: "bg-blue-50 text-blue-700", amber: "bg-amber-50 text-amber-700" }[tone];
  return <div className="flex items-center gap-3 rounded-xl border border-white/40 bg-white/95 p-4 shadow-lg shadow-slate-950/10"><span className={cn("flex size-10 items-center justify-center rounded-lg", toneClass)}><Icon className="size-5" /></span><span><span className="block text-xs font-medium text-slate-500">{label}</span><span className="mt-0.5 flex items-baseline gap-2"><strong className="text-xl text-slate-950">{value}</strong><span className="text-xs text-slate-500">{detail}</span></span></span></div>;
}

function Avatar({ contact, large = false }: { contact: ContactRecord; large?: boolean }) {
  return <span className={cn("flex shrink-0 items-center justify-center rounded-full font-bold", contact.color, large ? "size-14 text-base" : "size-10 text-xs")}>{contact.initials}</span>;
}

function FavoriteButton({ active, onClick }: { active: boolean; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="rounded-md p-1 text-slate-400 hover:bg-amber-50 hover:text-amber-500" aria-label={active ? "Quitar de favoritos" : "Añadir a favoritos"}><Star className={cn("size-4", active && "fill-amber-400 text-amber-400")} /></button>;
}

function ContactMobileCard({ contact, favorite, onFavorite, onOpen }: { contact: ContactRecord; favorite: boolean; onFavorite: () => void; onOpen: () => void }) {
  return <article className="p-4"><div className="flex items-start gap-3"><Avatar contact={contact} /><button type="button" className="min-w-0 flex-1 text-left" onClick={onOpen}><p className="truncate font-semibold text-slate-900">{contact.name}</p><p className="truncate text-xs text-slate-500">{contact.role} · {contact.company}</p></button><FavoriteButton active={favorite} onClick={onFavorite} /></div><div className="mt-3 flex items-center justify-between gap-3"><Badge variant="outline" className={kindStyles[contact.kind]}>{contact.kind}</Badge><button type="button" onClick={onOpen} className="flex items-center gap-1 text-xs font-semibold text-slate-600">Ver ficha <ChevronRight className="size-3.5" /></button></div></article>;
}

function ContactDetail({ contact, favorite, onFavorite, onClose }: { contact: ContactRecord; favorite: boolean; onFavorite: () => void; onClose: () => void }) {
  return <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/45 p-3 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={`Ficha de ${contact.name}`} onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}><aside className="flex h-full w-full max-w-md flex-col overflow-y-auto rounded-2xl bg-white shadow-2xl"><div className="flex items-center justify-between border-b border-slate-100 p-5"><p className="text-sm font-semibold text-slate-500">Ficha de contacto</p><button type="button" onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-900" aria-label="Cerrar"><X className="size-4" /></button></div><div className="p-6"><div className="flex items-start gap-4"><Avatar contact={contact} large /><div className="min-w-0 flex-1"><h2 className="brand-heading text-xl text-slate-950">{contact.name}</h2><p className="text-sm text-slate-500">{contact.role}</p><Badge variant="outline" className={cn("mt-2", kindStyles[contact.kind])}>{contact.kind}</Badge></div><FavoriteButton active={favorite} onClick={onFavorite} /></div><div className="mt-6 grid grid-cols-2 gap-3"><Button className="bg-slate-950 text-white hover:bg-slate-800"><Mail /> Escribir</Button><Button variant="outline"><Phone /> Llamar</Button></div><div className="mt-7 space-y-1"><DetailLine icon={Building2} label="Empresa" value={contact.company} /><DetailLine icon={Mail} label="Email" value={contact.email} /><DetailLine icon={Phone} label="Teléfono" value={contact.phone} /><DetailLine icon={MapPin} label="Ubicación" value={contact.location} /></div><div className="mt-7 rounded-xl border border-slate-200 bg-slate-50 p-4"><div className="flex items-center justify-between"><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Valor de la relación</p><ArrowUpRight className="size-4 text-emerald-600" /></div><p className="mt-2 text-2xl font-bold text-slate-950">{contact.value}</p><p className="mt-1 text-xs text-slate-500">Última interacción: {contact.lastContact}</p></div><div className="mt-7"><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Actividad reciente</p><div className="mt-3 border-l-2 border-cyan-200 pl-4"><p className="text-sm font-medium text-slate-800">Seguimiento comercial</p><p className="mt-0.5 text-xs text-slate-500">Se revisaron próximos pasos y fechas de entrega.</p><p className="mt-2 text-xs font-semibold text-cyan-700">{contact.lastContact}</p></div></div></div></aside></div>;
}

function DetailLine({ icon: Icon, label, value }: { icon: typeof Mail; label: string; value: string }) {
  return <div className="flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-slate-50"><Icon className="size-4 text-slate-400" /><span className="min-w-0"><span className="block text-xs text-slate-400">{label}</span><span className="block truncate text-sm font-medium text-slate-800">{value}</span></span></div>;
}

function CreateContactModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/50 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Nuevo contacto" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}><form onSubmit={onSubmit} className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"><div className="flex items-start justify-between"><div><h2 className="brand-heading text-xl text-slate-950">Nuevo contacto</h2><p className="mt-1 text-sm text-slate-500">Añade una persona al directorio comercial.</p></div><button type="button" onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-slate-100"><X className="size-4" /></button></div><div className="mt-6 grid gap-4 sm:grid-cols-2"><Field label="Nombre completo" name="name" placeholder="Ana García" required /><Field label="Empresa" name="company" placeholder="Nombre de la empresa" required /><Field label="Cargo" name="role" placeholder="Directora comercial" /><Field label="Email" name="email" type="email" placeholder="ana@empresa.example" required /><Field label="Teléfono" name="phone" placeholder="+1 407 555 0100" /><label className="space-y-1.5 text-sm font-medium text-slate-700">Relación<select name="kind" className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200"><option>Lead</option><option>Cliente</option><option>Partner</option></select></label></div><div className="mt-6 flex justify-end gap-3"><Button type="button" variant="outline" onClick={onClose}>Cancelar</Button><Button type="submit" className="bg-cyan-500 text-slate-950 hover:bg-cyan-400"><Plus /> Crear contacto</Button></div></form></div>;
}

function Field({ label, name, placeholder, type = "text", required = false }: { label: string; name: string; placeholder: string; type?: string; required?: boolean }) {
  return <label className="space-y-1.5 text-sm font-medium text-slate-700">{label}<Input name={name} type={type} placeholder={placeholder} required={required} /></label>;
}
