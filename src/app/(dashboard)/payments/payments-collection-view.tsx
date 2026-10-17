"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  ArrowDownLeft,
  ArrowRight,
  Banknote,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  CreditCard,
  Hash,
  Landmark,
  Link2,
  Plus,
  ReceiptText,
  Search,
  SlidersHorizontal,
  TriangleAlert,
  WalletCards,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { reconcilePaymentAction, registerPaymentAction } from "@/actions/crm";
import type { BankMovement, PaymentMethod, PaymentRecord, PaymentStatus } from "@/lib/appsync/crm";

const initialPayments = [
  { id: 1, client: "SunPeak", invoice: "INV-2026-0148", amount: 14800, issued: "Jun 18, 2026", due: "Jul 18, 2026", paidAt: "Jul 11, 2026", method: "ACH", status: "Cobrado", reference: "ACH-880194", initials: "SP", accent: "bg-amber-100 text-amber-800" },
  { id: 2, client: "Northline", invoice: "INV-2026-0152", amount: 9250, issued: "Jun 24, 2026", due: "Jul 24, 2026", method: "Transferencia", status: "Pendiente", reference: "PO-NL-4921", initials: "NL", accent: "bg-indigo-100 text-indigo-700" },
  { id: 3, client: "Greenridge", invoice: "INV-2026-0137", amount: 18600, issued: "May 30, 2026", due: "Jun 29, 2026", method: "Transferencia", status: "Vencido", reference: "GR-77502", initials: "GR", accent: "bg-emerald-100 text-emerald-700" },
  { id: 4, client: "Harborview", invoice: "INV-2026-0145", amount: 7450, issued: "Jun 12, 2026", due: "Jul 12, 2026", paidAt: "Jul 10, 2026", method: "Tarjeta", status: "Por conciliar", reference: "STR-309177", initials: "HV", accent: "bg-cyan-100 text-cyan-700" },
  { id: 5, client: "MetroCare", invoice: "INV-2026-0158", amount: 22100, issued: "Jul 02, 2026", due: "Aug 01, 2026", method: "ACH", status: "Pendiente", reference: "MC-2026-088", initials: "MC", accent: "bg-rose-100 text-rose-700" },
  { id: 6, client: "SunPeak", invoice: "INV-2026-0133", amount: 6800, issued: "May 22, 2026", due: "Jun 21, 2026", paidAt: "Jun 20, 2026", method: "Tarjeta", status: "Cobrado", reference: "STR-298104", initials: "SP", accent: "bg-amber-100 text-amber-800" },
  { id: 7, client: "Northline", invoice: "INV-2026-0129", amount: 12400, issued: "May 10, 2026", due: "Jun 09, 2026", paidAt: "Jun 12, 2026", method: "Cheque", status: "Cobrado", reference: "CHK-009184", initials: "NL", accent: "bg-indigo-100 text-indigo-700" },
  { id: 8, client: "Harborview", invoice: "INV-2026-0155", amount: 11300, issued: "Jun 28, 2026", due: "Jul 28, 2026", method: "Transferencia", status: "Pendiente", reference: "HV-PRO-726", initials: "HV", accent: "bg-cyan-100 text-cyan-700" },
];

const initialMovements = [
  { id: 101, concept: "Harborview LLC", amount: 7450, date: "Jul 10, 2026", reference: "STR-309177", paymentId: 4 },
  { id: 102, concept: "WIRE NORTHLINE", amount: 9250, date: "Jul 12, 2026", reference: "WIR-771042", paymentId: 2 },
  { id: 103, concept: "GREENRIDGE CORP", amount: 18600, date: "Jul 12, 2026", reference: "WIR-771108", paymentId: 3 },
];

const statusStyles: Record<PaymentStatus, string> = {
  Cobrado: "border-emerald-200 bg-emerald-50 text-emerald-700",
  Pendiente: "border-amber-200 bg-amber-50 text-amber-700",
  Vencido: "border-rose-200 bg-rose-50 text-rose-700",
  "Por conciliar": "border-indigo-200 bg-indigo-50 text-indigo-700",
};

const statuses = ["Todos", "Cobrado", "Pendiente", "Vencido", "Por conciliar"] as const;
const clients = ["SunPeak", "Northline", "Greenridge", "Harborview", "MetroCare"];
const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export function PaymentsCollectionView({ initialPayments: paymentsFromServer, initialMovements: movementsFromServer }: { initialPayments: PaymentRecord[]; initialMovements: BankMovement[] }) {
  const [payments, setPayments] = useState<PaymentRecord[]>(paymentsFromServer ?? initialPayments.map((payment) => ({ ...payment, id: String(payment.id), method: payment.method as PaymentMethod, status: payment.status as PaymentStatus })));
  const [movements, setMovements] = useState<BankMovement[]>(movementsFromServer ?? initialMovements.map((movement) => ({ ...movement, id: String(movement.id), paymentId: movement.paymentId ? String(movement.paymentId) : undefined })));
  const [mutationError, setMutationError] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<(typeof statuses)[number]>("Todos");
  const [method, setMethod] = useState<"Todos" | PaymentMethod>("Todos");
  const [showRegister, setShowRegister] = useState(false);
  const [showReconcile, setShowReconcile] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const visible = useMemo(() => {
    const normalized = query.toLocaleLowerCase("es").trim();
    return payments.filter((payment) => {
      const searchMatch = [payment.client, payment.invoice, payment.reference].join(" ").toLocaleLowerCase("es").includes(normalized);
      const statusMatch = status === "Todos" || payment.status === status;
      const methodMatch = method === "Todos" || payment.method === method;
      return searchMatch && statusMatch && methodMatch;
    });
  }, [method, payments, query, status]);

  const collected = payments.filter((payment) => payment.status === "Cobrado").reduce((sum, payment) => sum + payment.amount, 0);
  const pending = payments.filter((payment) => payment.status === "Pendiente").reduce((sum, payment) => sum + payment.amount, 0);
  const overdue = payments.filter((payment) => payment.status === "Vencido").reduce((sum, payment) => sum + payment.amount, 0);
  const toReconcile = payments.filter((payment) => payment.status === "Por conciliar").reduce((sum, payment) => sum + payment.amount, 0);
  const selected = payments.find((payment) => payment.id === selectedId) ?? null;

  async function registerPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const client = String(data.get("client") || clients[0]);
    const invoice = String(data.get("invoice") || `INV-2026-${payments.length + 160}`);
    const amount = Number(data.get("amount")) || 0;
    const method = String(data.get("method") || "Transferencia") as PaymentMethod;
    const reference = String(data.get("reference") || `PAY-${crypto.randomUUID().slice(0, 8).toUpperCase()}`);
    const newPayment: PaymentRecord = {
      id: crypto.randomUUID(), client, invoice, amount, method, reference,
      issued: "Jul 12, 2026", due: "Jul 12, 2026", paidAt: "Jul 12, 2026",
      status: "Por conciliar", initials: client.slice(0, 2).toUpperCase(), accent: "bg-slate-100 text-slate-700",
    };
    setPayments((current) => [newPayment, ...current]);
    setMutationError("");
    const result = await registerPaymentAction({ client, invoice, amount, method, reference });
    if (result.ok) {
      setPayments((current) => current.map((payment) => payment.id === newPayment.id ? result.data : payment));
      setSelectedId(result.data.id);
    } else {
      setPayments((current) => current.filter((payment) => payment.id !== newPayment.id));
      setMutationError(result.error);
      setSelectedId(null);
    }
    setShowRegister(false);
  }

  async function reconcile(paymentId: string, movementId?: string) {
    const previousPayments = payments;
    const previousMovements = movements;
    setPayments((current) => current.map((payment) => payment.id === paymentId ? { ...payment, status: "Cobrado", paidAt: payment.paidAt ?? "Jul 12, 2026" } : payment));
    if (movementId) setMovements((current) => current.filter((movement) => movement.id !== movementId));
    setMutationError("");
    const result = await reconcilePaymentAction(paymentId, movementId);
    if (result.ok) setPayments((current) => current.map((payment) => payment.id === paymentId ? { ...payment, ...result.data, status: "Cobrado" } : payment));
    else { setPayments(previousPayments); setMovements(previousMovements); setMutationError(result.error); }
  }

  return (
    <>
      {mutationError ? <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{mutationError}</p> : null}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Resumen de cobros">
        <PaymentMetric icon={CircleDollarSign} label="Cobrado" value={usd.format(collected)} detail="Este periodo" tone="emerald" />
        <PaymentMetric icon={Clock3} label="Pendiente" value={usd.format(pending)} detail="3 facturas" tone="amber" />
        <PaymentMetric icon={TriangleAlert} label="Vencido" value={usd.format(overdue)} detail="1 factura" tone="rose" />
        <PaymentMetric icon={Link2} label="Por conciliar" value={usd.format(toReconcile)} detail="Revisar banco" tone="indigo" />
      </section>

      <Card className="brand-surface gap-0 overflow-hidden py-0">
        <div className="flex flex-col gap-4 border-b border-slate-200 px-4 py-4 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="brand-heading text-lg text-slate-950">Movimientos de cobro</h2>
              <p className="text-sm text-slate-500">{visible.length} de {payments.length} transacciones · USD</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setShowReconcile(true)}><Landmark /> Conciliar <span className="rounded-full bg-indigo-100 px-1.5 py-0.5 text-[10px] font-bold text-indigo-700">{movements.length}</span></Button>
              <Button onClick={() => setShowRegister(true)} className="bg-cyan-500 text-slate-950 hover:bg-cyan-400"><Plus /> Registrar pago</Button>
            </div>
          </div>

          <div className="grid gap-2 lg:grid-cols-[minmax(260px,1fr)_auto_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar cliente, factura o referencia…" className="pl-9" aria-label="Buscar cobros" />
            </div>
            <FilterSelect icon={SlidersHorizontal} value={status} onChange={(value) => setStatus(value as typeof status)} options={[...statuses]} label="Estado" />
            <FilterSelect icon={CreditCard} value={method} onChange={(value) => setMethod(value as typeof method)} options={["Todos", "Transferencia", "Tarjeta", "ACH", "Cheque"]} label="Método" />
          </div>
        </div>

        <CardContent className="p-0">
          {visible.length === 0 ? <EmptyPayments /> : (
            <>
              <div className="divide-y divide-slate-100 md:hidden">
                {visible.map((payment) => <PaymentMobileCard key={payment.id} payment={payment} onOpen={() => setSelectedId(payment.id)} onReconcile={() => reconcile(payment.id)} />)}
              </div>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[850px] text-left text-sm">
                  <thead className="bg-slate-50/80 text-[10px] uppercase tracking-wider text-slate-500"><tr><th className="px-5 py-3 font-semibold">Cliente</th><th className="px-3 py-3 font-semibold">Factura</th><th className="px-3 py-3 font-semibold">Fecha</th><th className="px-3 py-3 font-semibold">Método</th><th className="px-3 py-3 text-right font-semibold">Importe</th><th className="px-3 py-3 font-semibold">Estado</th><th className="w-12 px-5 py-3" /></tr></thead>
                  <tbody className="divide-y divide-slate-100">{visible.map((payment) => <tr key={payment.id} className="hover:bg-slate-50/80"><td className="px-5 py-4"><button type="button" onClick={() => setSelectedId(payment.id)} className="flex items-center gap-3 text-left"><ClientAvatar payment={payment} /><span><strong className="block text-sm text-slate-900">{payment.client}</strong><span className="text-[10px] text-slate-500">{payment.reference}</span></span></button></td><td className="px-3 py-4 font-medium text-slate-700">{payment.invoice}</td><td className="px-3 py-4 text-xs text-slate-600"><span className="block">{payment.paidAt ?? payment.due}</span><span className="text-[10px] text-slate-400">{payment.paidAt ? "Fecha de cobro" : "Vencimiento"}</span></td><td className="px-3 py-4"><span className="flex items-center gap-1.5 text-xs text-slate-600">{methodIcon(payment.method)}{payment.method}</span></td><td className="px-3 py-4 text-right font-bold text-slate-950">{usd.format(payment.amount)}</td><td className="px-3 py-4"><Badge variant="outline" className={statusStyles[payment.status]}>{payment.status}</Badge></td><td className="px-5 py-4"><button type="button" onClick={() => setSelectedId(payment.id)} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-900" aria-label={`Ver ${payment.invoice}`}><ChevronRight className="size-4" /></button></td></tr>)}</tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <InsightCard icon={ArrowDownLeft} title="Velocidad de cobro" value="18 días" detail="4 días menos que el mes anterior" positive />
        <InsightCard icon={CheckCircle2} title="Tasa de cobro" value="92,4%" detail="sobre facturas vencidas este trimestre" positive />
        <InsightCard icon={WalletCards} title="Método principal" value="ACH · 46%" detail="seguido de transferencia bancaria" />
      </div>

      {showRegister && <RegisterPaymentModal onClose={() => setShowRegister(false)} onSubmit={registerPayment} />}
      {showReconcile && <ReconcileModal movements={movements} payments={payments} onReconcile={reconcile} onClose={() => setShowReconcile(false)} />}
      {selected && <PaymentDetail payment={selected} onReconcile={() => reconcile(selected.id)} onClose={() => setSelectedId(null)} />}
    </>
  );
}

function PaymentMetric({ icon: Icon, label, value, detail, tone }: { icon: typeof CircleDollarSign; label: string; value: string; detail: string; tone: "emerald" | "amber" | "rose" | "indigo" }) {
  const style = { emerald: "bg-emerald-50 text-emerald-700", amber: "bg-amber-50 text-amber-700", rose: "bg-rose-50 text-rose-700", indigo: "bg-indigo-50 text-indigo-700" }[tone];
  return <div className="rounded-xl border border-white/40 bg-white/95 p-4 shadow-lg shadow-slate-950/10"><div className="flex items-center justify-between"><span className={cn("rounded-lg p-2", style)}><Icon className="size-4" /></span><span className="text-[10px] font-medium text-slate-400">{detail}</span></div><p className="mt-3 text-xl font-bold text-slate-950">{value}</p><p className="mt-0.5 text-xs font-medium text-slate-500">{label}</p></div>;
}

function FilterSelect({ icon: Icon, value, onChange, options, label }: { icon: typeof CreditCard; value: string; onChange: (value: string) => void; options: string[]; label: string }) {
  return <label className="relative"><span className="sr-only">Filtrar por {label.toLocaleLowerCase("es")}</span><Icon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><select value={value} onChange={(event) => onChange(event.target.value)} className="h-9 w-full rounded-md border border-slate-300 bg-white pl-9 pr-8 text-sm text-slate-700 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200 lg:w-auto">{options.map((option) => <option key={option}>{option}</option>)}</select></label>;
}

function ClientAvatar({ payment, large = false }: { payment: PaymentRecord; large?: boolean }) {
  return <span className={cn("flex shrink-0 items-center justify-center rounded-full font-bold", payment.accent, large ? "size-14 text-sm" : "size-9 text-[10px]")}>{payment.initials}</span>;
}

function methodIcon(method: PaymentMethod) {
  if (method === "Tarjeta") return <CreditCard className="size-3.5 text-slate-400" />;
  if (method === "Cheque") return <ReceiptText className="size-3.5 text-slate-400" />;
  if (method === "ACH") return <Landmark className="size-3.5 text-slate-400" />;
  return <Banknote className="size-3.5 text-slate-400" />;
}

function PaymentMobileCard({ payment, onOpen, onReconcile }: { payment: PaymentRecord; onOpen: () => void; onReconcile: () => void }) {
  return <article className="p-4"><div className="flex items-start gap-3"><ClientAvatar payment={payment} /><button type="button" className="min-w-0 flex-1 text-left" onClick={onOpen}><p className="font-semibold text-slate-900">{payment.client}</p><p className="text-xs text-slate-500">{payment.invoice}</p></button><strong className="text-sm text-slate-950">{usd.format(payment.amount)}</strong></div><div className="mt-3 flex items-center justify-between gap-2"><Badge variant="outline" className={statusStyles[payment.status]}>{payment.status}</Badge>{payment.status === "Por conciliar" ? <button type="button" onClick={onReconcile} className="text-xs font-semibold text-indigo-700">Conciliar ahora</button> : <button type="button" onClick={onOpen} className="flex items-center gap-1 text-xs font-semibold text-slate-600">Ver detalle <ChevronRight className="size-3.5" /></button>}</div></article>;
}

function InsightCard({ icon: Icon, title, value, detail, positive = false }: { icon: typeof WalletCards; title: string; value: string; detail: string; positive?: boolean }) {
  return <div className="flex items-center gap-3 rounded-xl border border-white/40 bg-white/95 p-4 shadow-lg shadow-slate-950/10"><span className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg", positive ? "bg-emerald-50 text-emerald-700" : "bg-cyan-50 text-cyan-700")}><Icon className="size-5" /></span><div className="min-w-0"><p className="text-xs text-slate-500">{title}</p><p className="mt-0.5 font-bold text-slate-950">{value}</p><p className="truncate text-[10px] text-slate-400">{detail}</p></div></div>;
}

function EmptyPayments() {
  return <div className="flex flex-col items-center px-6 py-16 text-center"><Search className="mb-3 size-8 text-slate-300" /><p className="font-semibold text-slate-800">No hay movimientos coincidentes</p><p className="mt-1 text-sm text-slate-500">Prueba con otro cliente, estado o método.</p></div>;
}

function RegisterPaymentModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/50 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Registrar pago" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><form onSubmit={onSubmit} className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"><ModalHeader title="Registrar pago" description="El movimiento quedará pendiente de conciliación bancaria." onClose={onClose} /><div className="mt-6 grid gap-4 sm:grid-cols-2"><label className="space-y-1.5 text-sm font-medium text-slate-700">Cliente<select name="client" className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm" required>{clients.map((client) => <option key={client}>{client}</option>)}</select></label><PaymentField label="Factura" name="invoice" placeholder="INV-2026-0161" required /><PaymentField label="Importe (USD)" name="amount" placeholder="12500" type="number" required /><label className="space-y-1.5 text-sm font-medium text-slate-700">Método<select name="method" className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"><option>Transferencia</option><option>ACH</option><option>Tarjeta</option><option>Cheque</option></select></label><PaymentField label="Referencia" name="reference" placeholder="WIR-000000" required /></div><div className="mt-6 rounded-xl bg-cyan-50 p-3 text-xs leading-5 text-cyan-800"><strong>Próximo paso:</strong> relaciona este cobro con el movimiento del banco desde la bandeja de conciliación.</div><div className="mt-6 flex justify-end gap-3"><Button type="button" variant="outline" onClick={onClose}>Cancelar</Button><Button type="submit" className="bg-cyan-500 text-slate-950 hover:bg-cyan-400"><Plus /> Registrar pago</Button></div></form></div>;
}

function ReconcileModal({ movements, payments, onReconcile, onClose }: { movements: BankMovement[]; payments: PaymentRecord[]; onReconcile: (paymentId: string, movementId?: string) => void; onClose: () => void }) {
  return <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/50 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Conciliación bancaria" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl"><ModalHeader title="Conciliación bancaria" description={`${movements.length} movimientos con coincidencia sugerida.`} onClose={onClose} /><div className="mt-6 max-h-[60vh] space-y-3 overflow-y-auto pr-1">{movements.length === 0 ? <div className="py-12 text-center"><CheckCircle2 className="mx-auto size-9 text-emerald-500" /><p className="mt-3 font-semibold text-slate-900">Todo está conciliado</p><p className="mt-1 text-sm text-slate-500">No quedan movimientos bancarios pendientes.</p></div> : movements.map((movement) => { const payment = payments.find((item) => item.id === movement.paymentId); return <article key={movement.id} className="rounded-xl border border-slate-200 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div className="flex gap-3"><span className="flex size-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700"><Landmark className="size-4" /></span><div><p className="text-sm font-semibold text-slate-900">{movement.concept}</p><p className="mt-0.5 text-xs text-slate-500">{movement.date} · {movement.reference}</p></div></div><strong className="text-sm text-slate-950">{usd.format(movement.amount)}</strong></div>{payment ? <div className="mt-4 flex flex-col gap-3 rounded-lg bg-slate-50 p-3 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-2"><Link2 className="size-4 text-indigo-600" /><span className="text-xs text-slate-600">Coincide con <strong className="text-slate-900">{payment.invoice} · {payment.client}</strong></span></div><Button size="sm" onClick={() => onReconcile(payment.id, movement.id)} className="bg-indigo-600 text-white hover:bg-indigo-500"><Check /> Conciliar</Button></div> : <p className="mt-3 text-xs text-amber-700">Sin factura coincidente.</p>}</article>; })}</div><div className="mt-6 flex justify-end"><Button variant="outline" onClick={onClose}>Cerrar</Button></div></div></div>;
}

function PaymentDetail({ payment, onReconcile, onClose }: { payment: PaymentRecord; onReconcile: () => void; onClose: () => void }) {
  return <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/45 p-3 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={`Cobro ${payment.invoice}`} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><aside className="h-full w-full max-w-md overflow-y-auto rounded-2xl bg-white shadow-2xl"><div className="p-6"><div className="flex items-start justify-between"><div className="flex items-center gap-3"><ClientAvatar payment={payment} large /><div><h2 className="brand-heading text-xl text-slate-950">{payment.client}</h2><p className="text-sm text-slate-500">{payment.invoice}</p></div></div><button type="button" onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-slate-100"><X className="size-4" /></button></div><div className="mt-6 rounded-xl bg-slate-950 p-5 text-white"><p className="text-xs text-slate-400">Importe del cobro</p><p className="mt-1 text-3xl font-bold">{usd.format(payment.amount)}</p><Badge variant="outline" className={cn("mt-3", statusStyles[payment.status])}>{payment.status}</Badge></div><div className="mt-6 space-y-1"><DetailLine icon={ReceiptText} label="Factura" value={payment.invoice} /><DetailLine icon={Building2} label="Cliente" value={payment.client} /><DetailLine icon={CalendarDays} label={payment.paidAt ? "Fecha de cobro" : "Vencimiento"} value={payment.paidAt ?? payment.due} /><DetailLine icon={CreditCard} label="Método" value={payment.method} /><DetailLine icon={Hash} label="Referencia" value={payment.reference} /></div>{payment.status === "Por conciliar" && <Button onClick={onReconcile} className="mt-7 w-full bg-indigo-600 text-white hover:bg-indigo-500"><Link2 /> Marcar como conciliado</Button>}{payment.status === "Vencido" && <Button variant="outline" className="mt-7 w-full border-rose-200 text-rose-700"><ArrowRight /> Enviar recordatorio</Button>}</div></aside></div>;
}

function ModalHeader({ title, description, onClose }: { title: string; description: string; onClose: () => void }) {
  return <div className="flex items-start justify-between gap-3"><div><h2 className="brand-heading text-xl text-slate-950">{title}</h2><p className="mt-1 text-sm text-slate-500">{description}</p></div><button type="button" onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-slate-100"><X className="size-4" /></button></div>;
}

function PaymentField({ label, name, placeholder, type = "text", required = false }: { label: string; name: string; placeholder: string; type?: string; required?: boolean }) {
  return <label className="space-y-1.5 text-sm font-medium text-slate-700">{label}<Input name={name} type={type} placeholder={placeholder} required={required} /></label>;
}

function DetailLine({ icon: Icon, label, value }: { icon: typeof ReceiptText; label: string; value: string }) {
  return <div className="flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-slate-50"><Icon className="size-4 text-slate-400" /><div><p className="text-xs text-slate-400">{label}</p><p className="text-sm font-medium text-slate-800">{value}</p></div></div>;
}
