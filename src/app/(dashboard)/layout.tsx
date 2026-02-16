import { DashboardHeader } from "@/components/layout/dashboard-header";
import { requireAuth } from "@/lib/require-auth";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireAuth();

  return (
    <div className="min-h-screen bg-muted/20">
      <DashboardHeader userName={session.user.name} />
      <main className="mx-auto w-full max-w-6xl px-4 py-6 md:px-8 md:py-8">{children}</main>
    </div>
  );
}
