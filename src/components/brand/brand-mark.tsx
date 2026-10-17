import Link from "next/link";

import { cn } from "@/lib/utils";

type BrandMarkProps = {
  href?: string;
  className?: string;
  tone?: "light" | "dark";
};

export function BrandMark({ href = "/", className, tone = "light" }: BrandMarkProps) {
  const isDark = tone === "dark";

  return (
    <Link
      href={href}
      aria-label="Nexo — inicio"
      className={cn(
        "inline-flex items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2",
        isDark ? "focus-visible:ring-offset-[#07101f]" : "focus-visible:ring-offset-white",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "relative inline-flex size-9 shrink-0 items-end justify-center gap-0.5 overflow-hidden rounded-xl border pb-2 shadow-sm",
          isDark
            ? "border-cyan-300/20 bg-gradient-to-br from-cyan-300 to-blue-500 shadow-cyan-950/30"
            : "border-cyan-200 bg-gradient-to-br from-cyan-400 to-blue-600 shadow-cyan-900/10",
        )}
      >
        <span className="h-2 w-1 rounded-full bg-slate-950/80" />
        <span className="h-3.5 w-1 rounded-full bg-slate-950/80" />
        <span className="h-5 w-1 rounded-full bg-slate-950/80" />
      </span>
      <span data-brand-copy className="min-w-0 leading-none">
        <span
          className={cn(
            "brand-heading block whitespace-nowrap text-[15px] font-bold tracking-[-0.02em]",
            isDark ? "text-white" : "text-slate-950",
          )}
        >
          Nexo
        </span>
        <span
          className={cn(
            "mt-1 block whitespace-nowrap text-[9px] font-bold uppercase tracking-[0.19em]",
            isDark ? "text-slate-500" : "text-slate-500",
          )}
        >
          CRM empresarial
        </span>
      </span>
    </Link>
  );
}
