"use client";

import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Bell,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  ChevronDown,
  ContactRound,
  CreditCard,
  FileText,
  FolderKanban,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Menu,
  Plus,
  Search,
  Settings,
  Target,
  UsersRound,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { logoutAction } from "@/actions/auth";
import { searchWorkspaceAction } from "@/actions/crm";
import { BrandMark } from "@/components/brand/brand-mark";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type NavigationItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

const primaryNavigation: NavigationItem[] = [
  { href: "/dashboard", label: "Resumen", icon: LayoutDashboard },
  { href: "/clients", label: "Clientes", icon: Building2 },
  { href: "/contacts", label: "Contactos", icon: ContactRound },
  { href: "/pipeline", label: "Pipeline", icon: FolderKanban },
  { href: "/projects", label: "Proyectos", icon: BriefcaseBusiness },
  { href: "/tasks", label: "Tareas", icon: ListChecks },
  { href: "/calendar", label: "Calendario", icon: CalendarDays },
  { href: "/invoices", label: "Facturas", icon: FileText },
  { href: "/payments", label: "Pagos", icon: CreditCard },
  { href: "/reports", label: "Reportes", icon: BarChart3 },
];

const workspaceNavigation: NavigationItem[] = [
  { href: "/account/members", label: "Equipo", icon: UsersRound },
  { href: "/account", label: "Configuración", icon: Settings },
];

type SearchResult = {
  id: string;
  title: string;
  description: string;
  category: "Cliente" | "Contacto" | "Oportunidad" | "Proyecto" | "Tarea" | "Evento" | "Factura" | "Pago";
  href: string;
  icon: LucideIcon;
  iconClassName: string;
};

const demoSearchResults: SearchResult[] = [
  {
    id: "client-acme",
    title: "Acme Industrial",
    description: "Cliente · Madrid · Cuenta Enterprise",
    category: "Cliente",
    href: "/clients?search=Acme%20Industrial",
    icon: Building2,
    iconClassName: "bg-blue-50 text-blue-600",
  },
  {
    id: "opportunity-renewal",
    title: "Renovación Acme 2026",
    description: "Oportunidad · 48.000 € · Negociación",
    category: "Oportunidad",
    href: "/pipeline?search=Renovaci%C3%B3n%20Acme",
    icon: Target,
    iconClassName: "bg-amber-50 text-amber-600",
  },
  {
    id: "project-atlas",
    title: "Implementación Atlas",
    description: "Proyecto · 72% completado · En curso",
    category: "Proyecto",
    href: "/projects?search=Implementaci%C3%B3n%20Atlas",
    icon: BriefcaseBusiness,
    iconClassName: "bg-violet-50 text-violet-600",
  },
  {
    id: "invoice-0041",
    title: "FAC-2026-0041",
    description: "Factura · Nova Labs · 8.450 €",
    category: "Factura",
    href: "/invoices?search=FAC-2026-0041",
    icon: FileText,
    iconClassName: "bg-emerald-50 text-emerald-600",
  },
  {
    id: "client-northstar",
    title: "Northstar Health",
    description: "Cliente · Barcelona · Salud",
    category: "Cliente",
    href: "/clients?search=Northstar%20Health",
    icon: Building2,
    iconClassName: "bg-blue-50 text-blue-600",
  },
  {
    id: "opportunity-nova",
    title: "Expansión Nova LATAM",
    description: "Oportunidad · 32.500 € · Propuesta",
    category: "Oportunidad",
    href: "/pipeline?search=Expansi%C3%B3n%20Nova",
    icon: Target,
    iconClassName: "bg-amber-50 text-amber-600",
  },
  {
    id: "project-northstar",
    title: "Portal clientes Northstar",
    description: "Proyecto · 4 tareas pendientes",
    category: "Proyecto",
    href: "/projects?search=Portal%20clientes%20Northstar",
    icon: BriefcaseBusiness,
    iconClassName: "bg-violet-50 text-violet-600",
  },
  {
    id: "invoice-0038",
    title: "FAC-2026-0038",
    description: "Factura · Acme Industrial · Pagada",
    category: "Factura",
    href: "/invoices?search=FAC-2026-0038",
    icon: FileText,
    iconClassName: "bg-emerald-50 text-emerald-600",
  },
];

const createOptions: NavigationItem[] = [
  { href: "/clients?create=client", label: "Cliente", icon: Building2 },
  { href: "/contacts?create=contact", label: "Contacto", icon: ContactRound },
  { href: "/pipeline?create=opportunity", label: "Oportunidad", icon: Target },
  { href: "/projects?create=project", label: "Proyecto", icon: BriefcaseBusiness },
  { href: "/tasks?create=task", label: "Tarea", icon: ListChecks },
  { href: "/invoices/new", label: "Factura", icon: FileText },
];

function isActiveRoute(pathname: string, href: string) {
  if (href === "/account" || href === "/dashboard") {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function initialsFor(userName?: string | null) {
  const initials = userName
    ?.trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase();

  return initials || "AF";
}

function SidebarLink({
  item,
  pathname,
  onNavigate,
}: {
  item: NavigationItem;
  pathname: string;
  onNavigate?: () => void;
}) {
  const active = isActiveRoute(pathname, item.href);
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      title={item.label}
      className={cn(
        "group relative flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300",
        active
          ? "bg-cyan-400/15 text-cyan-100"
          : "text-slate-400 hover:bg-white/[0.07] hover:text-white",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "absolute inset-y-2 left-0 w-0.5 rounded-full bg-cyan-300 opacity-0 transition-opacity",
          active && "opacity-100",
        )}
      />
      <Icon className={cn("size-[18px] shrink-0", active && "text-cyan-300")} />
      <span className="md:hidden lg:inline">{item.label}</span>
    </Link>
  );
}

function SearchResultList({
  id,
  results,
  query,
  activeIndex,
  onHighlight,
  onSelect,
}: {
  id: string;
  results: SearchResult[];
  query: string;
  activeIndex: number;
  onHighlight: (index: number) => void;
  onSelect: () => void;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-950/10">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
          {query.trim() ? "Resultados" : "Accesos rápidos"}
        </p>
        <span className="text-[11px] text-slate-400">Búsqueda del espacio</span>
      </div>

      {results.length ? (
        <ul id={id} role="listbox" aria-label="Resultados de búsqueda" className="max-h-[390px] overflow-y-auto p-2">
          {results.map((result, index) => {
            const Icon = result.icon;
            const active = index === activeIndex;

            return (
              <li key={result.id}>
                <Link
                  id={`${id}-${result.id}`}
                  href={result.href}
                  role="option"
                  aria-selected={active}
                  onMouseEnter={() => onHighlight(index)}
                  onFocus={() => onHighlight(index)}
                  onClick={onSelect}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 outline-none transition-colors",
                    active ? "bg-slate-100" : "hover:bg-slate-50 focus:bg-slate-100",
                  )}
                >
                  <span
                    className={cn(
                      "inline-flex size-9 shrink-0 items-center justify-center rounded-xl",
                      result.iconClassName,
                    )}
                  >
                    <Icon className="size-[17px]" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-slate-900">
                      {result.title}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-slate-500">
                      {result.description}
                    </span>
                  </span>
                  <span className="hidden shrink-0 rounded-full border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold text-slate-500 sm:inline">
                    {result.category}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="px-6 py-10 text-center" role="status">
          <Search className="mx-auto size-6 text-slate-300" />
          <p className="mt-3 text-sm font-semibold text-slate-700">Sin coincidencias</p>
          <p className="mt-1 text-xs text-slate-500">Prueba con un cliente, proyecto o número de factura.</p>
        </div>
      )}

      <div className="hidden items-center gap-4 border-t border-slate-100 bg-slate-50/80 px-4 py-2 text-[10px] font-medium text-slate-400 sm:flex">
        <span><kbd className="font-sans">↑ ↓</kbd> navegar</span>
        <span><kbd className="font-sans">↵</kbd> abrir</span>
        <span><kbd className="font-sans">Esc</kbd> cerrar</span>
      </div>
    </div>
  );
}

function GlobalSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [remoteResults, setRemoteResults] = useState<SearchResult[]>([]);
  const desktopSearchRef = useRef<HTMLDivElement>(null);
  const mobileSearchRef = useRef<HTMLElement>(null);
  const desktopSearchInputRef = useRef<HTMLInputElement>(null);
  const mobileSearchInputRef = useRef<HTMLInputElement>(null);
  const mobileSearchButtonRef = useRef<HTMLButtonElement>(null);
  const normalizedQuery = query.trim().toLocaleLowerCase("es");
  const filteredResults = normalizedQuery ? remoteResults : demoSearchResults.slice(0, 6);

  useEffect(() => {
    if (!normalizedQuery) {
      return undefined;
    }
    const timer = window.setTimeout(async () => {
      const result = await searchWorkspaceAction(query);
      if (!result.ok) return setRemoteResults([]);
      const iconByCategory: Record<SearchResult["category"], { icon: LucideIcon; className: string }> = {
        Cliente: { icon: Building2, className: "bg-blue-50 text-blue-600" },
        Contacto: { icon: ContactRound, className: "bg-cyan-50 text-cyan-600" },
        Oportunidad: { icon: Target, className: "bg-amber-50 text-amber-600" },
        Proyecto: { icon: BriefcaseBusiness, className: "bg-violet-50 text-violet-600" },
        Tarea: { icon: ListChecks, className: "bg-sky-50 text-sky-600" },
        Evento: { icon: CalendarDays, className: "bg-indigo-50 text-indigo-600" },
        Factura: { icon: FileText, className: "bg-emerald-50 text-emerald-600" },
        Pago: { icon: CreditCard, className: "bg-emerald-50 text-emerald-600" },
      };
      setRemoteResults(result.data.map((item) => ({ ...item, icon: iconByCategory[item.category].icon, iconClassName: iconByCategory[item.category].className })));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [normalizedQuery, query]);

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
        setActiveIndex(0);
        window.requestAnimationFrame(() => {
          const desktopInput = desktopSearchInputRef.current;
          const visibleInput = desktopInput?.offsetParent !== null
            ? desktopInput
            : mobileSearchInputRef.current;
          visibleInput?.focus();
          visibleInput?.select();
        });
      } else if (event.key === "Escape") {
        setSearchOpen(false);
        desktopSearchInputRef.current?.blur();
        if (window.matchMedia("(max-width: 767px)").matches) {
          mobileSearchButtonRef.current?.focus();
        }
      }
    }

    document.addEventListener("keydown", handleShortcut);
    return () => document.removeEventListener("keydown", handleShortcut);
  }, []);

  useEffect(() => {
    if (!searchOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (
        desktopSearchRef.current?.contains(target) ||
        mobileSearchRef.current?.contains(target)
      ) {
        return;
      }
      setSearchOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [searchOpen]);

  useEffect(() => {
    if (!searchOpen || !window.matchMedia("(max-width: 767px)").matches) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [searchOpen]);

  function openMobileSearch() {
    setSearchOpen(true);
    setActiveIndex(0);
    window.requestAnimationFrame(() => mobileSearchInputRef.current?.focus());
  }

  function closeSearch() {
    setSearchOpen(false);
  }

  function handleQueryChange(value: string) {
    setQuery(value);
    setActiveIndex(0);
    setSearchOpen(true);
  }

  function handleSearchKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!filteredResults.length) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % filteredResults.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => (index - 1 + filteredResults.length) % filteredResults.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const selectedResult = filteredResults[activeIndex] || filteredResults[0];
      setSearchOpen(false);
      router.push(selectedResult.href);
    }
  }

  const desktopResultsId = "global-search-results";
  const mobileResultsId = "mobile-global-search-results";

  return (
    <>
      <button
        ref={mobileSearchButtonRef}
        type="button"
        onClick={openMobileSearch}
        aria-label="Abrir búsqueda global"
        aria-haspopup="dialog"
        className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 md:hidden"
      >
        <Search className="size-[18px]" />
      </button>

      <div ref={desktopSearchRef} className="relative hidden w-full max-w-md md:block lg:ml-auto">
        <label className="group relative block">
          <span className="sr-only">Buscar en el CRM</span>
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-[18px] -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-cyan-600" />
          <input
            ref={desktopSearchInputRef}
            type="search"
            value={query}
            onChange={(event) => handleQueryChange(event.target.value)}
            onFocus={() => setSearchOpen(true)}
            onKeyDown={handleSearchKeyDown}
            placeholder="Buscar clientes, proyectos, facturas…"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={searchOpen}
            aria-controls={desktopResultsId}
            aria-activedescendant={
              searchOpen && filteredResults[activeIndex]
                ? `${desktopResultsId}-${filteredResults[activeIndex].id}`
                : undefined
            }
            className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-14 text-sm text-slate-900 outline-none transition focus:border-cyan-500 focus:bg-white focus:ring-2 focus:ring-cyan-100"
          />
          <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-md border border-slate-200 bg-white px-1.5 py-0.5 font-sans text-[10px] font-medium text-slate-400">
            ⌘K
          </kbd>
        </label>

        {searchOpen ? (
          <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-50">
            <SearchResultList
              id={desktopResultsId}
              results={filteredResults}
              query={query}
              activeIndex={activeIndex}
              onHighlight={setActiveIndex}
              onSelect={closeSearch}
            />
          </div>
        ) : null}
      </div>

      {searchOpen && typeof document !== "undefined"
        ? createPortal(
            <div className="fixed inset-0 z-[70] md:hidden print:hidden">
              <button
                type="button"
                aria-label="Cerrar búsqueda"
                className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm"
                onClick={() => {
                  closeSearch();
                  mobileSearchButtonRef.current?.focus();
                }}
              />
              <section
                ref={mobileSearchRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="mobile-search-title"
                onKeyDown={(event) => {
                  if (event.key !== "Tab") {
                    return;
                  }
                  const focusableElements = event.currentTarget.querySelectorAll<HTMLElement>(
                    'a[href], button:not([disabled]), input:not([disabled])',
                  );
                  const firstElement = focusableElements[0];
                  const lastElement = focusableElements[focusableElements.length - 1];
                  if (event.shiftKey && document.activeElement === firstElement) {
                    event.preventDefault();
                    lastElement?.focus();
                  } else if (!event.shiftKey && document.activeElement === lastElement) {
                    event.preventDefault();
                    firstElement?.focus();
                  }
                }}
                className="relative mx-3 mt-3 max-h-[calc(100dvh-24px)] overflow-y-auto rounded-3xl bg-slate-50 p-3 shadow-2xl sm:mx-auto sm:mt-8 sm:max-w-xl"
              >
                <div className="flex items-center justify-between px-2 py-2">
                  <div>
                    <h2 id="mobile-search-title" className="text-sm font-bold text-slate-900">
                      Búsqueda global
                    </h2>
                    <p className="mt-0.5 text-xs text-slate-500">Encuentra cualquier registro del CRM.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      closeSearch();
                      mobileSearchButtonRef.current?.focus();
                    }}
                    aria-label="Cerrar búsqueda"
                    className="inline-flex size-9 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-200/70 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
                  >
                    <X className="size-[18px]" />
                  </button>
                </div>

                <label className="group relative my-2 block">
                  <span className="sr-only">Buscar en el CRM</span>
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 size-[18px] -translate-y-1/2 text-slate-400 group-focus-within:text-cyan-600" />
                  <input
                    ref={mobileSearchInputRef}
                    type="search"
                    value={query}
                    onChange={(event) => handleQueryChange(event.target.value)}
                    onKeyDown={handleSearchKeyDown}
                    placeholder="Cliente, oportunidad, proyecto…"
                    role="combobox"
                    aria-autocomplete="list"
                    aria-expanded="true"
                    aria-controls={mobileResultsId}
                    aria-activedescendant={
                      filteredResults[activeIndex]
                        ? `${mobileResultsId}-${filteredResults[activeIndex].id}`
                        : undefined
                    }
                    className="h-12 w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-4 text-base text-slate-900 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                  />
                </label>

                <SearchResultList
                  id={mobileResultsId}
                  results={filteredResults}
                  query={query}
                  activeIndex={activeIndex}
                  onHighlight={setActiveIndex}
                  onSelect={closeSearch}
                />
              </section>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

function CreateMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Crear nuevo registro"
          className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#0a1226] px-3.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#162647] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2"
        >
          <Plus className="size-[18px]" />
          <span className="hidden sm:inline">Crear</span>
          <ChevronDown className="hidden size-3.5 text-slate-400 sm:block" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-64 rounded-2xl border-slate-200 bg-white p-2 shadow-xl shadow-slate-950/10"
      >
        <DropdownMenuLabel className="px-3 pb-2 pt-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
          Crear nuevo
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-slate-100" />
        <DropdownMenuGroup>
          {createOptions.map((item) => {
            const Icon = item.icon;
            return (
              <DropdownMenuItem key={item.href} asChild className="rounded-xl p-0 focus:bg-slate-100">
                <Link href={item.href} className="flex w-full items-center gap-3 px-3 py-2.5">
                  <span className="inline-flex size-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                    <Icon className="size-4" />
                  </span>
                  <span className="font-medium text-slate-800">{item.label}</span>
                </Link>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function UserSummary({ userName }: { userName?: string | null }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-300 to-blue-500 text-xs font-bold text-slate-950 shadow-sm">
        {initialsFor(userName)}
      </span>
      <span className="min-w-0 md:hidden lg:block">
        <span className="block truncate text-sm font-semibold text-white">
          {userName || "Mi cuenta"}
        </span>
        <span className="block text-xs text-slate-500">Administrador</span>
      </span>
    </div>
  );
}

function SidebarContent({
  pathname,
  userName,
  onNavigate,
}: {
  pathname: string;
  userName?: string | null;
  onNavigate?: () => void;
}) {
  return (
    <>
      <div className="flex h-20 shrink-0 items-center border-b border-white/[0.08] px-5 md:justify-center md:px-3 lg:justify-start lg:px-6">
        <BrandMark
          href="/dashboard"
          tone="dark"
          className="md:[&_[data-brand-copy]]:hidden lg:[&_[data-brand-copy]]:block"
        />
      </div>

      <nav
        className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-4 py-6 md:px-3 lg:px-4"
        aria-label="Navegación principal"
      >
        <div>
          <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-600 md:hidden lg:block">
            Gestión
          </p>
          <div className="space-y-1">
            {primaryNavigation.map((item) => (
              <SidebarLink
                key={item.href}
                item={item}
                pathname={pathname}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-600 md:hidden lg:block">
            Espacio de trabajo
          </p>
          <div className="space-y-1">
            {workspaceNavigation.map((item) => (
              <SidebarLink
                key={item.href}
                item={item}
                pathname={pathname}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        </div>
      </nav>

      <div className="shrink-0 border-t border-white/[0.08] p-4 md:px-3 lg:p-4">
        <div className="flex items-center justify-between gap-2 md:justify-center lg:justify-between">
          <Link
            href="/account"
            onClick={onNavigate}
            className="min-w-0 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
            aria-label="Abrir configuración de cuenta"
          >
            <UserSummary userName={userName} />
          </Link>
          <form action={logoutAction}>
            <button
              type="submit"
              title="Cerrar sesión"
              aria-label="Cerrar sesión"
              className="inline-flex size-9 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 md:hidden lg:inline-flex"
            >
              <LogOut className="size-[18px]" />
            </button>
          </form>
        </div>
        <form action={logoutAction} className="mt-3 hidden md:block lg:hidden">
          <button
            type="submit"
            title="Cerrar sesión"
            aria-label="Cerrar sesión"
            className="inline-flex h-9 w-full items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
          >
            <LogOut className="size-[18px]" />
          </button>
        </form>
      </div>
    </>
  );
}

export function DashboardSidebar({
  userName,
}: {
  userName?: string | null;
}) {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 hidden h-dvh w-[84px] shrink-0 flex-col border-r border-white/[0.08] bg-[#07101f] text-white md:flex lg:w-[264px] print:hidden">
      <SidebarContent pathname={pathname} userName={userName} />
    </aside>
  );
}

export function DashboardHeader({
  userName,
}: {
  userName?: string | null;
}) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileDialogRef = useRef<HTMLElement>(null);
  const mobileMenuButtonRef = useRef<HTMLButtonElement>(null);
  const mobileCloseButtonRef = useRef<HTMLButtonElement>(null);
  const currentItem = [...primaryNavigation, ...workspaceNavigation].find((item) =>
    isActiveRoute(pathname, item.href),
  );

  useEffect(() => {
    if (!mobileMenuOpen) {
      return;
    }

    const triggerElement = mobileMenuButtonRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    mobileCloseButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMobileMenuOpen(false);
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const focusableElements = mobileDialogRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusableElements?.length) {
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      triggerElement?.focus();
    };
  }, [mobileMenuOpen]);

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-slate-200/90 bg-white/95 text-slate-950 shadow-sm shadow-slate-950/[0.03] backdrop-blur-xl print:hidden">
        <div className="flex h-[72px] items-center gap-3 px-4 sm:px-5 md:px-6 lg:px-8">
          <button
            ref={mobileMenuButtonRef}
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Abrir menú de navegación"
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-navigation"
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 md:hidden"
          >
            <Menu className="size-5" />
          </button>

          <div className="mr-auto min-w-0 sm:mr-2 md:mr-0">
            <p className="truncate text-sm font-semibold text-slate-900">
              {currentItem?.label || "Espacio de trabajo"}
            </p>
            <p className="hidden text-xs text-slate-500 xl:block">Centro de gestión empresarial</p>
          </div>

          <GlobalSearch />

          <button
            type="button"
            aria-label="Abrir notificaciones"
            className="hidden size-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 sm:inline-flex"
          >
            <Bell className="size-[18px]" />
          </button>

          <CreateMenu />

          <Link
            href="/account"
            aria-label="Ir a mi cuenta"
            className="hidden rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 xl:block"
          >
            <span className="inline-flex size-10 items-center justify-center rounded-xl bg-cyan-100 text-xs font-bold text-cyan-800">
              {initialsFor(userName)}
            </span>
          </Link>
        </div>
      </header>

      {mobileMenuOpen ? (
        <div className="fixed inset-0 z-50 md:hidden print:hidden">
          <button
            type="button"
            aria-label="Cerrar menú de navegación"
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside
            ref={mobileDialogRef}
            id="mobile-navigation"
            aria-label="Menú móvil"
            aria-modal="true"
            role="dialog"
            className="relative flex h-full w-[min(88vw,320px)] flex-col border-r border-white/10 bg-[#07101f] text-white shadow-2xl"
          >
            <button
              ref={mobileCloseButtonRef}
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              aria-label="Cerrar menú"
              className="absolute right-4 top-5 inline-flex size-10 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
            >
              <X className="size-5" />
            </button>
            <SidebarContent
              pathname={pathname}
              userName={userName}
              onNavigate={() => setMobileMenuOpen(false)}
            />
          </aside>
        </div>
      ) : null}
    </>
  );
}
