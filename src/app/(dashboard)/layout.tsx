import { DashboardHeader } from "@/components/layout/dashboard-header";
import { requireAuth } from "@/lib/require-auth";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireAuth();

  return (
    <div className="brand-page-bg min-h-screen">
      <DashboardHeader userName={session.user.name} />
      <main className="mx-auto w-full max-w-6xl px-4 py-6 md:px-8 md:py-8">{children}</main>
    </div>
  );
}
