import { DashboardHeader, DashboardSidebar } from "@/components/layout/dashboard-header";
import { requireAuth } from "@/lib/require-auth";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireAuth();

  return (
    <div className="flex min-h-screen bg-[#07101f]">
      <DashboardSidebar userName={session.user.name} />
      <div className="min-w-0 flex-1 bg-slate-50">
        <DashboardHeader userName={session.user.name} />
        <main className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-5 md:px-6 md:py-8 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
