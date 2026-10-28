import { AudioWaveform, Phone, UserRound } from "lucide-react";
import type { HistoryEvent } from "@/lib/types";
import { formatDayTime } from "@/lib/format";
import { cn } from "@/lib/cn";

const ACTOR = {
  astio: { label: "Astio", icon: AudioWaveform, className: "bg-brand-50 text-brand-700" },
  plombier: { label: "Vous", icon: UserRound, className: "bg-stone-800 text-white" },
  client: { label: "Client", icon: Phone, className: "bg-stone-100 text-ink-soft" },
} as const;

/** Chronologie des événements du dossier, du plus ancien au plus récent. */
export function HistoryTimeline({ events, now }: { events: HistoryEvent[]; now: number }) {
  const sorted = [...events].sort((a, b) => a.at.localeCompare(b.at));
  return (
    <ol>
      {sorted.map((e, i) => {
        const actor = ACTOR[e.actor];
        const Icon = actor.icon;
        return (
          <li key={e.id} className="relative flex gap-3 pb-4 last:pb-0">
            {i < sorted.length - 1 && <span aria-hidden className="absolute top-7 bottom-0 left-[13px] w-px bg-line" />}
            <span className={cn("relative flex size-7 shrink-0 items-center justify-center rounded-full", actor.className)}>
              <Icon aria-hidden className="size-3.5" />
            </span>
            <div className="min-w-0 pt-0.5">
              <p className="text-[13px] text-ink">
                <span className="font-medium">{e.label}</span>
                {e.detail && <span className="text-ink-soft"> · {e.detail}</span>}
              </p>
              <p className="text-xs text-ink-muted">
                {actor.label} · {formatDayTime(e.at, now)}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
