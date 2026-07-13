import { PipelineBoard } from "@/components/crm/pipeline-board";
import { listOpportunities } from "@/lib/appsync/crm";

export default async function PipelinePage() {
  const opportunities = await listOpportunities();
  return <PipelineBoard initialOpportunities={opportunities} />;
}
