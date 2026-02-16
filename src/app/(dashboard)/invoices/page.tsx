import Link from "next/link";
import { format } from "date-fns";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatMoney } from "@/lib/invoices";
import { prisma } from "@/lib/prisma";

const statusClassMap: Record<string, string> = {
  DRAFT: "bg-amber-100 text-amber-900 hover:bg-amber-100",
  SENT: "bg-blue-100 text-blue-900 hover:bg-blue-100",
  PAID: "bg-emerald-100 text-emerald-900 hover:bg-emerald-100",
};

export default async function InvoiceListPage() {
  const invoices = await prisma.invoice.findMany({
    orderBy: { invoiceNumber: "desc" },
    select: {
      id: true,
      invoiceNumber: true,
      billToName: true,
      date: true,
      status: true,
      grandTotal: true,
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Invoices</h1>
          <p className="text-sm text-muted-foreground">
            Gestión inicial de invoices para el MVP.
          </p>
        </div>
        <Button asChild>
          <Link href="/invoices/new">New Invoice</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Listado</CardTitle>
          <CardDescription>{invoices.length} registros</CardDescription>
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aún no hay invoices. Crea el primero para comenzar.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Bill To</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Grand Total</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-medium">{invoice.invoiceNumber}</TableCell>
                      <TableCell>{format(invoice.date, "MM/dd/yyyy")}</TableCell>
                      <TableCell>{invoice.billToName}</TableCell>
                      <TableCell>
                        <Badge className={statusClassMap[invoice.status]}>{invoice.status}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {formatMoney(invoice.grandTotal)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/invoices/${invoice.id}`}>View</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
