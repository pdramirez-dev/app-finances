import { ClientWorkspace } from "@/components/crm/client-workspace";
import { listClients } from "@/lib/appsync/workspace";

export default async function ClientsPage() {
  const clients = await listClients();
  return <ClientWorkspace clients={clients} />;
}
