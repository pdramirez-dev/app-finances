import { TaskManager } from "@/components/crm/task-manager";
import { listTasks } from "@/lib/appsync/crm";

export default async function TasksPage() {
  const tasks = await listTasks();
  const today = new Date().toISOString().slice(0, 10);
  return <TaskManager initialTasks={tasks} today={today} />;
}
