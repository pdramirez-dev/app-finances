import { BellRing } from "lucide-react";

import { ReminderSettingsForm } from "@/components/invoices/reminder-settings-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getReminderSettings } from "@/lib/appsync/invoices";
import { requireAuth } from "@/lib/require-auth";

export default async function ReminderSettingsPage() {
  await requireAuth();
  const settings = await getReminderSettings();

  return (
    <div className="space-y-6">
      <div>
        <p className="flex items-center gap-2 text-sm font-medium text-cyan-700">
          <BellRing className="size-4" />
          Configuración
        </p>
        <h1 className="brand-heading mt-2 text-3xl text-slate-950">Recordatorios de pago</h1>
        <p className="mt-1 text-sm text-slate-500">
          Emails automáticos a tus clientes antes y después del vencimiento, con el saldo pendiente y el enlace a la factura.
        </p>
      </div>
      <Card className="rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle>Programación</CardTitle>
          <CardDescription>
            {settings.enabled && settings.enabledAt
              ? `Activos desde el ${new Intl.DateTimeFormat("es", { dateStyle: "long" }).format(new Date(settings.enabledAt))}. Se envían cada día a las 14:00 UTC (10:00 en horario de verano del Este, 9:00 en invierno).`
              : "Desactivados. Ningún cliente recibe recordatorios automáticos."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ReminderSettingsForm enabled={settings.enabled} offsets={settings.offsets} />
        </CardContent>
      </Card>
    </div>
  );
}
