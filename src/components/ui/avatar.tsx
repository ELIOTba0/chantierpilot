import { initials } from "@/lib/format";
import { cn } from "@/lib/cn";

export function Avatar({ name, className }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-full bg-stone-100 text-xs font-semibold text-ink-soft",
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
