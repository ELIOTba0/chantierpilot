import Link from "next/link";
import { ArrowRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

interface StatTileProps {
  href: string;
  label: string;
  value: number;
  icon: LucideIcon;
  /** Accent de marque quand une action est attendue. */
  highlight?: boolean;
}

export function StatTile({ href, label, value, icon: Icon, highlight }: StatTileProps) {
  return (
    <Link
      href={href}
      className={cn(
        "group flex items-center gap-4 rounded-xl border bg-surface px-4 py-3 sm:px-5 sm:py-4 shadow-(--shadow-card) transition hover:border-line-strong",
        highlight ? "border-brand-200" : "border-line",
      )}
    >
      <span
        className={cn(
          "hidden size-11 shrink-0 items-center justify-center rounded-xl sm:flex",
          highlight ? "bg-brand-gradient text-ink" : "bg-stone-100 text-ink-soft",
        )}
      >
        <Icon aria-hidden className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] leading-snug font-medium text-ink-soft">{label}</span>
        <span className="block text-3xl leading-tight font-semibold tracking-tight text-ink tabular-nums">{value}</span>
      </span>
      <ArrowRight
        aria-hidden
        className="hidden size-4 shrink-0 text-ink-muted transition sm:block group-hover:translate-x-0.5 group-hover:text-ink"
      />
    </Link>
  );
}
