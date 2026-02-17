"use client";

import Link from "next/link";
import { format } from "date-fns";
import { Search, SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { InvoiceRecord, InvoiceStatus } from "@/lib/invoice-types";
import { formatMoney } from "@/lib/invoices";

const statusClassMap: Record<InvoiceStatus, string> = {
  DRAFT: "bg-amber-100 text-amber-900 hover:bg-amber-100",
  SENT: "bg-blue-100 text-blue-900 hover:bg-blue-100",
  PAID: "bg-emerald-100 text-emerald-900 hover:bg-emerald-100",
};

const statusFilterOptions: Array<InvoiceStatus | "ALL"> = ["ALL", "DRAFT", "SENT", "PAID"];

type InvoiceListTableProps = {
  invoices: InvoiceRecord[];
};

export function InvoiceListTable({ invoices }: InvoiceListTableProps) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | "ALL">("ALL");
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(invoices.at(0)?.invoiceId ?? null);

  const filteredInvoices = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return invoices.filter((invoice) => {
      const matchesStatus = statusFilter === "ALL" ? true : invoice.status === statusFilter;
      const matchesQuery =
        normalizedQuery.length === 0
          ? true
          : String(invoice.invoiceNumber).includes(normalizedQuery) ||
            invoice.billToName.toLowerCase().includes(normalizedQuery) ||
            invoice.project.toLowerCase().includes(normalizedQuery);

      return matchesStatus && matchesQuery;
    });
  }, [invoices, query, statusFilter]);

  const hasActiveFilters = query.trim().length > 0 || statusFilter !== "ALL";

  if (invoices.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
        <p className="brand-heading text-lg text-slate-900">Aun no hay invoices</p>
        <p className="mt-2 text-sm text-slate-600">Crea tu primer invoice para comenzar a operar el flujo.</p>
        <Button asChild className="mt-5 bg-[#0a1226] text-white hover:bg-[#162448]">
          <Link href="/invoices/new">Create Invoice</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-slate-50/80 p-3">
        <div className="min-w-52 flex-1 space-y-2">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
            <Search className="size-3.5" />
            Buscar
          </p>
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Invoice #, Bill To o Project"
            className="border-slate-300 bg-white"
          />
        </div>
        <div className="w-full max-w-44 space-y-2">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
            <SlidersHorizontal className="size-3.5" />
            Estado
          </p>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as InvoiceStatus | "ALL")}
            className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900"
          >
            {statusFilterOptions.map((option) => (
              <option key={option} value={option}>
                {option === "ALL" ? "Todos" : option}
              </option>
            ))}
          </select>
        </div>
        {hasActiveFilters ? (
          <Button
            type="button"
            variant="outline"
            className="border-slate-300 bg-white hover:bg-slate-100"
            onClick={() => {
              setQuery("");
              setStatusFilter("ALL");
            }}
          >
            Limpiar filtros
          </Button>
        ) : null}
      </div>

      {filteredInvoices.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
          <p className="brand-heading text-lg text-slate-900">No hay resultados</p>
          <p className="mt-2 text-sm text-slate-600">Ajusta los filtros para encontrar invoices existentes.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <Table>
            <TableHeader className="bg-slate-100/80">
              <TableRow className="hover:bg-transparent">
                <TableHead>Invoice #</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Bill To</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Grand Total</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredInvoices.map((invoice) => (
                <TableRow
                  key={invoice.invoiceId}
                  data-state={selectedInvoiceId === invoice.invoiceId ? "selected" : undefined}
                  className="cursor-pointer border-slate-200 hover:bg-slate-50 data-[state=selected]:bg-cyan-50/60"
                  onClick={() => setSelectedInvoiceId(invoice.invoiceId)}
                >
                  <TableCell className="font-medium">{invoice.invoiceNumber}</TableCell>
                  <TableCell>{format(new Date(invoice.date), "MM/dd/yyyy")}</TableCell>
                  <TableCell>{invoice.billToName}</TableCell>
                  <TableCell>
                    <Badge className={statusClassMap[invoice.status]}>{invoice.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right">{formatMoney(invoice.grandTotal)}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      asChild
                      variant="outline"
                      size="sm"
                      className="border-slate-300 bg-white hover:bg-slate-100"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <Link href={`/invoices/${invoice.invoiceId}`}>View</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
