import { DashboardOverview } from "@/components/crm/dashboard-overview";
import { requireAuth } from "@/lib/require-auth";
import { getCrmSummary } from "@/lib/appsync/crm";

export default async function DashboardPage() {
  const [session, summary] = await Promise.all([requireAuth(), getCrmSummary()]);
  const firstName = session.user.name?.split(" ")[0] || "Pablo";

  return <DashboardOverview firstName={firstName} summary={summary} />;
}
