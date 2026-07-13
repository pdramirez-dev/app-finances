import { WalletCards } from "lucide-react";

import { PaymentsCollectionView } from "./payments-collection-view";
import { listBankMovements, listPayments } from "@/lib/appsync/crm";

export default async function PaymentsPage() {
  const [payments, movements] = await Promise.all([listPayments(), listBankMovements()]);
  return (
    <div className="space-y-6">
      <div>
        <p className="flex items-center gap-2 text-sm font-medium text-cyan-700">
          <WalletCards className="size-4" />
          Finanzas · Tesorería
        </p>
        <h1 className="brand-heading mt-2 text-3xl text-slate-950">Cobros</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-500">
          Controla entradas, vencimientos y conciliación bancaria en dólares.
        </p>
      </div>

      <PaymentsCollectionView initialPayments={payments} initialMovements={movements} />
    </div>
  );
}
