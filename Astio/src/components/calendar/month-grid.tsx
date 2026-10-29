"use client";

import type { Settings } from "@/lib/types";
import type { CalendarItem } from "@/lib/calendar";
import { APPOINTMENT_STATE } from "@/lib/labels";
import { formatTime, isSameDay } from "@/lib/format";
import { cn } from "@/lib/cn";
import { EVENT_STYLE, SUGGESTION_STYLE } from "./event-style";

const WEEKDAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const MAX_VISIBLE = 3;

interface MonthGridProps {
  days: Date[];
  month: number;
  items: CalendarItem[];
  clientName: (id: string) => string;
  hours: Settings["hours"];
  now: number;
  onSelect: (item: CalendarItem) => void;
  onSelectDay: (day: Date) => void;
}

/** Vue Mois : un aperçu par jour, le clic sur une date ouvre la vue Jour. */
export function MonthGrid({ days, month, items: allItems, clientName, hours, now, onSelect, onSelectDay }: MonthGridProps) {
  return (
    <div>
      <div className="grid grid-cols-7 border-b border-line">
        {WEEKDAYS.map((d) => (
          <div key={d} className="py-2 text-center text-[11px] font-medium tracking-wide text-ink-muted uppercase">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const inMonth = day.getMonth() === month;
          const workday = hours.workdays.includes(day.getDay() as Settings["hours"]["workdays"][number]);
          const today = isSameDay(day, new Date(now));
          const items = allItems
            .filter((a) => isSameDay(a.start, day))
            .sort((a, b) => a.start.localeCompare(b.start));
          const label = day.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });

          return (
            <div
              key={day.toISOString()}
              className={cn(
                "min-h-20 border-r border-b border-line p-1 sm:min-h-28 sm:p-1.5 [&:nth-child(7n)]:border-r-0",
                !workday && "bg-stone-50/80",
                !inMonth && "bg-stone-50/60",
              )}
            >
              <button
                type="button"
                onClick={() => onSelectDay(day)}
                aria-label={`${label} : ${items.length} rendez-vous. Ouvrir la journée`}
                className={cn(
                  "flex size-6 items-center justify-center rounded-full text-xs font-medium tabular-nums hover:bg-stone-200/70",
                  today ? "bg-brand-500 font-semibold text-ink" : inMonth ? "text-ink" : "text-ink-muted/70",
                )}
              >
                {day.getDate()}
              </button>

              {/* Mobile : pastilles. Écrans plus larges : libellés. */}
              <div className="mt-1 flex flex-wrap gap-1 sm:hidden" aria-hidden>
                {items.map((a) => (
                  <span key={a.id} className={cn("size-1.5 rounded-full", (a.kind === "suggestion" ? SUGGESTION_STYLE.dot : EVENT_STYLE[a.appt.state].dot))} />
                ))}
              </div>
              <ul className="mt-1 hidden space-y-0.5 sm:block">
                {items.slice(0, MAX_VISIBLE).map((a) => (
                  <li key={a.id}>
                    <button
                      type="button"
                      onClick={() => onSelect(a)}
                      className={cn(
                        "flex w-full items-center gap-1 truncate rounded px-1 py-0.5 text-left text-[11px] leading-tight hover:bg-stone-100",
                        !inMonth && "opacity-60",
                      )}
                    >
                      <span aria-hidden className={cn("size-1.5 shrink-0 rounded-full", (a.kind === "suggestion" ? SUGGESTION_STYLE.dot : EVENT_STYLE[a.appt.state].dot))} />
                      <span className="text-ink-muted tabular-nums">{formatTime(a.start)}</span>
                      <span className="truncate text-ink">{clientName(a.clientId)}</span>
                      <span className="sr-only">, {a.kind === "suggestion" ? "à confirmer" : APPOINTMENT_STATE[a.appt.state].label}</span>
                    </button>
                  </li>
                ))}
                {items.length > MAX_VISIBLE && (
                  <li>
                    <button
                      type="button"
                      onClick={() => onSelectDay(day)}
                      className="px-1 text-[11px] font-medium text-ink-soft hover:text-ink"
                    >
                      + {items.length - MAX_VISIBLE} autre{items.length - MAX_VISIBLE > 1 ? "s" : ""}
                    </button>
                  </li>
                )}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
