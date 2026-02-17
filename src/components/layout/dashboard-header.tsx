import Link from "next/link";

import { logoutAction } from "@/actions/auth";
import { BrandMark } from "@/components/brand/brand-mark";
import { Button } from "@/components/ui/button";

export function DashboardHeader({
  userName,
}: {
  userName?: string | null;
}) {
  return (
    <header className="border-b border-slate-800 bg-[#0a1226] text-slate-100 print:hidden">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3 md:px-8">
        <BrandMark href="/invoices" tone="dark" />
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="sm" className="text-slate-200 hover:bg-white/10 hover:text-white">
            <Link href="/pricing">Pricing</Link>
          </Button>
          <p className="hidden rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs text-slate-200 sm:block">
            {userName ?? "User"}
          </p>
          <form action={logoutAction}>
            <Button
              type="submit"
              variant="outline"
              size="sm"
              className="border-white/30 bg-white/10 text-slate-100 hover:bg-white/20"
            >
              Logout
            </Button>
          </form>
        </div>
      </div>
    </header>
  );
}
