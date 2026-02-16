import Link from "next/link";

import { logoutAction } from "@/actions/auth";
import { Button } from "@/components/ui/button";

export function DashboardHeader({
  userName,
}: {
  userName?: string | null;
}) {
  return (
    <header className="border-b bg-background/95 print:hidden">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3 md:px-8">
        <Link href="/invoices" className="text-sm font-semibold tracking-wide">
          App Finances
        </Link>
        <div className="flex items-center gap-3">
          <p className="hidden text-sm text-muted-foreground sm:block">
            {userName ?? "User"}
          </p>
          <form action={logoutAction}>
            <Button type="submit" variant="outline" size="sm">
              Logout
            </Button>
          </form>
        </div>
      </div>
    </header>
  );
}
