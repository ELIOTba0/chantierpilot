"use client";

import type { Settings } from "@/lib/types";
import { APPOINTMENT_STATE } from "@/lib/labels";
import { formatTime, isSameDay } from "@/lib/format";
import { type CalendarItem, GRID_END_HOUR, GRID_START_HOUR, layoutDay, minutesOfDay, parseHHMM } from "@/lib/calendar";
import type { FreeBlock } from "@/lib/slots";
import { cn } from "@/lib/cn";
import { EVENT_STYLE, SUGGESTION_STYLE } from "./event-style";

const HOUR_HEIGHT = 52;
const GRID_START = GRID_START_HOUR * 60;
const GRID_MINUTES = (GRID_END_HOUR - GRID_START_HOUR) * 60;

const px = (minutes: number) => (minutes / 60) * HOUR_HEIGHT;

const weekdayFmt = new Intl.DateTimeFormat("fr-FR", { weekday: "short" });

interface TimeGridProps {
  days: Date[];
  items: CalendarItem[];
  clientName: (id: string) => string;
  hours: Settings["hours"];
  now: number;
  onSelect: (item: CalendarItem) => void;
  onSelectDay?: (day: Date) => void;
  /** Plages libres à afficher (page Planning uniquement). */
  freeBlocksFor?: (day: Date) => FreeBlock[];
  onFreeSlot?: (day: Date, startMin: number, block: FreeBlock) => void;
}

const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

/** Grille horaire des vues Jour et Semaine. */
export function TimeGrid({
  days,
  items,
  clientName,
  hours,
  now,
  onSelect,
  onSelectDay,
  freeBlocksFor,
  onFreeSlot,
}: TimeGridProps) {
  const hourLabels = Array.from({ length: GRID_END_HOUR - GRID_START_HOUR }, (_, i) => GRID_START_HOUR + i);
  const isWeek = days.length > 1;

  // Plages hors disponibilité (avant/après la journée, pause), en minutes.
  const workStart = parseHHMM(hours.start);
  const workEnd = parseHHMM(hours.end);
  const unavailable = [
    [GRID_START, workStart],
    [parseHHMM(hours.breakStart), parseHHMM(hours.breakEnd)],
    [workEnd, GRID_START + GRID_MINUTES],
  ].filter(([a, b]) => b > a);

  const nowMinutes = minutesOfDay(new Date(now).toISOString());

  return (
    <div className="overflow-x-auto">
      <div className={cn(isWeek && "min-w-[760px]")}>
        {/* En-têtes des jours */}
        <div className="sticky top-0 z-10 flex border-b border-line bg-surface">
          <div className="w-14 shrink-0" />
          {days.map((day) => {
            const today = isSameDay(day, new Date(now));
            const label = (
              <>
                <span className="text-[11px] font-medium tracking-wide text-ink-muted uppercase">
                  {weekdayFmt.format(day).replace(".", "")}
                </span>
                <span
                  className={cn(
                    "flex size-7 items-center justify-center rounded-full text-sm font-semibold tabular-nums",
                    today ? "bg-brand-gradient text-ink" : "text-ink",
                  )}
                >
                  {day.getDate()}
                </span>
              </>
            );
            return (
              <div key={day.toISOString()} className="flex-1 border-l border-line first:border-l-0">
                {isWeek && onSelectDay ? (
                  <button
                    type="button"
                    onClick={() => onSelectDay(day)}
                    className="flex w-full items-center justify-center gap-1.5 py-2 hover:bg-stone-50"
                    aria-label={`Voir le ${day.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}`}
                  >
                    {label}
                  </button>
                ) : (
                  <div className="flex items-center justify-center gap-1.5 py-2">{label}</div>
                )}
              </div>
            );
          })}
        </div>

        {/* Grille */}
        <div className="flex">
          <div className="w-14 shrink-0" aria-hidden>
            {hourLabels.map((h, i) => (
              <div key={h} style={{ height: HOUR_HEIGHT }} className="relative">
                {i > 0 && (
                  <span className="absolute -top-2 right-2 text-[11px] text-ink-muted tabular-nums">
                    {String(h).padStart(2, "0")}:00
                  </span>
                )}
              </div>
            ))}
          </div>

          {days.map((day) => {
            const workday = hours.workdays.includes(day.getDay() as Settings["hours"]["workdays"][number]);
            const placed = layoutDay(items.filter((it) => isSameDay(it.start, day)));
            const today = isSameDay(day, new Date(now));

            return (
              <div
                key={day.toISOString()}
                className="relative flex-1 border-l border-line first:border-l-0"
                style={{ height: px(GRID_MINUTES) }}
              >
                {/* Lignes horaires */}
                {hourLabels.map((h, i) => (
                  <div
                    key={h}
                    aria-hidden
                    className={cn("absolute inset-x-0 border-t border-line/70", i === 0 && "border-t-0")}
                    style={{ top: px(i * 60) }}
                  />
                ))}

                {/* Indisponibilités : hors horaires, pause, jour non travaillé */}
                {(workday ? unavailable : [[GRID_START, GRID_START + GRID_MINUTES]]).map(([a, b]) => (
                  <div
                    key={`${a}-${b}`}
                    aria-hidden
                    className="absolute inset-x-0 bg-[repeating-linear-gradient(135deg,transparent_0_6px,rgb(28_27_25/0.035)_6px_7px)] bg-stone-50/80"
                    style={{ top: px(a - GRID_START), height: px(b - a) }}
                  />
                ))}

                {/* Plages libres : un clic propose d'y planifier un appel */}
                {freeBlocksFor?.(day).map((block) => {
                  const top = px(Math.max(block.start, GRID_START) - GRID_START);
                  const height = px(Math.min(block.end, GRID_START + GRID_MINUTES) - Math.max(block.start, GRID_START));
                  const label = `Libre ${hhmm(block.start)} – ${hhmm(block.end)}`;
                  return (
                    <button
                      key={`free-${block.start}`}
                      type="button"
                      aria-label={`${label}, le ${day.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}. Planifier un appel`}
                      onClick={(e) => {
                        // Au clavier (detail = 0), on part du début de la plage ; à la souris, de la demi-heure visée.
                        let start = block.start;
                        if (e.detail > 0) {
                          const offset = e.nativeEvent.offsetY / HOUR_HEIGHT * 60;
                          start = Math.max(block.start, block.start + Math.floor(offset / 30) * 30);
                        }
                        onFreeSlot?.(day, Math.min(start, block.end - 30), block);
                      }}
                      className="group absolute inset-x-1 z-[5] rounded-md border border-dashed border-emerald-300/80 bg-emerald-50/40 text-left transition hover:border-emerald-500 hover:bg-emerald-50"
                      style={{ top: top + 1, height: height - 2 }}
                    >
                      {height >= 26 && (
                        <span className="pointer-events-none block truncate px-1.5 pt-0.5 text-[10px] font-medium text-emerald-700/80 group-hover:text-emerald-800">
                          {label}
                        </span>
                      )}
                    </button>
                  );
                })}

                {/* Heure actuelle */}
                {today && nowMinutes >= GRID_START && nowMinutes <= GRID_START + GRID_MINUTES && (
                  <div
                    aria-hidden
                    className="absolute inset-x-0 z-20 flex items-center"
                    style={{ top: px(nowMinutes - GRID_START) }}
                  >
                    <span className="-ml-1 size-2 rounded-full bg-red-500" />
                    <span className="h-px flex-1 bg-red-500" />
                  </div>
                )}

                {/* Rendez-vous */}
                {placed.map(({ item, lane, lanes }) => {
                  const start = Math.max(minutesOfDay(item.start), GRID_START);
                  const end = Math.min(minutesOfDay(item.end), GRID_START + GRID_MINUTES);
                  const height = Math.max(px(end - start), 22);
                  const suggestion = item.kind === "suggestion";
                  const stateLabel = suggestion ? "À confirmer" : APPOINTMENT_STATE[item.appt.state].short;
                  const compact = height < 44;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onSelect(item)}
                      className={cn(
                        "absolute z-10 overflow-hidden rounded-md border-l-[3px] px-2 py-1 text-left shadow-sm transition hover:z-30 hover:shadow-md",
                        suggestion ? SUGGESTION_STYLE.block : EVENT_STYLE[item.appt.state].block,
                        !suggestion && EVENT_STYLE[item.appt.state].dashed && "border-y border-r border-dashed",
                      )}
                      style={{
                        top: px(start - GRID_START) + 1,
                        height: height - 2,
                        left: `calc(${(lane / lanes) * 100}% + 2px)`,
                        width: `calc(${100 / lanes}% - 4px)`,
                      }}
                    >
                      <span className="block truncate text-[12px] leading-tight font-semibold">
                        {compact && <span className="font-normal tabular-nums">{formatTime(item.start)} · </span>}
                        {clientName(item.clientId)}
                      </span>
                      {!compact && (
                        <>
                          <span className="block truncate text-[11px] leading-tight opacity-80 tabular-nums">
                            {formatTime(item.start)} – {formatTime(item.end)}
                            {(suggestion || item.appt.state !== "confirme") && ` · ${stateLabel}`}
                          </span>
                          {height > 70 && (
                            <span className="mt-0.5 block truncate text-[11px] leading-tight opacity-80">{item.motif}</span>
                          )}
                        </>
                      )}
                      <span className="sr-only">, {suggestion ? "créneau suggéré par Astio, à confirmer" : APPOINTMENT_STATE[item.appt.state].label}</span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
