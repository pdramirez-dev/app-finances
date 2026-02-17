import Link from "next/link";

import { cn } from "@/lib/utils";

type BrandMarkProps = {
  href?: string;
  className?: string;
  tone?: "light" | "dark";
};

export function BrandMark({ href = "/", className, tone = "light" }: BrandMarkProps) {
  const isDark = tone === "dark";

  const content = (
    <span className={cn("inline-flex items-center gap-3", className)}>
      <span
        className={cn(
          "inline-flex h-9 w-9 items-center justify-center rounded-lg border text-sm font-bold tracking-tight",
          isDark ? "border-white/25 bg-white/10 text-white" : "border-slate-300 bg-white text-slate-900",
        )}
      >
        AF
      </span>
      <span
        className={cn(
          "text-xs font-semibold uppercase tracking-[0.24em]",
          isDark ? "text-slate-100" : "text-slate-700",
        )}
      >
        App Finances
      </span>
    </span>
  );

  return (
    <Link href={href} aria-label="App Finances home">
      {content}
    </Link>
  );
}
