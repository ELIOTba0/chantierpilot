import type { ReactNode } from "react";
import type { Tone } from "@/lib/labels";
import { cn } from "@/lib/cn";

export const TONE_CLASSES: Record<Tone, { badge: string; dot: string; rail: string }> = {
  urgent: { badge: "bg-red-50 text-red-700", dot: "bg-red-500", rail: "bg-red-500" },
  warning: { badge: "bg-amber-50 text-amber-800", dot: "bg-amber-500", rail: "bg-amber-400" },
  info: { badge: "bg-sky-50 text-sky-700", dot: "bg-sky-500", rail: "bg-sky-400" },
  success: { badge: "bg-emerald-50 text-emerald-700", dot: "bg-emerald-500", rail: "bg-emerald-500" },
  neutral: { badge: "bg-black/[0.05] text-ink-soft", dot: "bg-stone-400", rail: "bg-stone-300" },
  muted: { badge: "bg-black/[0.04] text-ink-muted", dot: "bg-stone-300", rail: "bg-stone-200" },
  brand: { badge: "bg-brand-50 text-brand-800", dot: "bg-brand-500", rail: "bg-brand-500" },
};

interface BadgeProps {
  tone: Tone;
  children: ReactNode;
  icon?: ReactNode;
  dot?: boolean;
  className?: string;
}

export function Badge({ tone, children, icon, dot, className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium",
        TONE_CLASSES[tone].badge,
        className,
      )}
    >
      {dot && <span aria-hidden className={cn("size-1.5 rounded-full", TONE_CLASSES[tone].dot)} />}
      {icon}
      {children}
    </span>
  );
}
