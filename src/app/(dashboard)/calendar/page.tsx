import { CalendarPlanner } from "@/components/crm/calendar-planner";
import { listCalendarEvents } from "@/lib/appsync/crm";

export default async function CalendarPage() {
  const today = new Date().toISOString().slice(0, 10);
  const year = Number(today.slice(0, 4));
  const events = await listCalendarEvents(`${year - 1}-01-01`, `${year + 1}-12-31`);
  return <CalendarPlanner initialEvents={events} today={today} />;
}
