import { ChartNoAxesCombined } from "lucide-react";

import { ReportsInsightsView } from "./reports-insights-view";
import { getCrmSummary } from "@/lib/appsync/crm";

export default async function ReportsPage() {
  const summary = await getCrmSummary();
  return (
    <div className="space-y-6">
      <div>
        <p className="flex items-center gap-2 text-sm font-medium text-cyan-700">
          <ChartNoAxesCombined className="size-4" />
          Inteligencia · Rendimiento
        </p>
        <h1 className="brand-heading mt-2 text-3xl text-slate-950">Reportes</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-500">
          Convierte la actividad comercial y financiera en decisiones claras.
        </p>
      </div>

      <ReportsInsightsView crmSummary={summary} />
    </div>
  );
}
