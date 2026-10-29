import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";

interface StatTileProps {
  label: string;
  value: number;
  /** Phrase courte sous le chiffre. */
  caption?: string;
  /** Accent de marque quand une action est attendue. */
  highlight?: boolean;
  href?: string;
  onClick?: () => void;
}

/** Chiffre clé cliquable : un lien vers une liste, ou un bouton qui ouvre un panneau. */
export function StatTile({ label, value, caption, highlight, href, onClick }: StatTileProps) {
  const className = cn(
    "group flex w-full items-center gap-3 rounded-2xl bg-surface px-4 py-3 text-left shadow-(--shadow-card) transition hover:shadow-(--shadow-pop) sm:gap-4 sm:px-5 sm:py-4",
    highlight && "ring-1 ring-brand-300",
  );
  const content = (
    <>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] leading-snug text-ink-soft sm:text-sm">{label}</span>
        <span className={cn("mt-1 block text-[28px] leading-none font-semibold tracking-tight tabular-nums sm:text-[32px]", highlight ? "text-brand-700" : "text-ink")}>
          {value}
        </span>
        {caption && <span className="mt-1.5 hidden text-[13px] text-ink-muted sm:block">{caption}</span>}
      </span>
      <ChevronRight aria-hidden className="hidden size-5 shrink-0 sm:block text-ink-muted/60 transition group-hover:translate-x-0.5 group-hover:text-ink-soft" />
    </>
  );

  return href ? (
    <Link href={href} className={className}>
      {content}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={className}>
      {content}
    </button>
  );
}
