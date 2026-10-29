"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useAstio } from "@/lib/app-context";
import { clientMap } from "@/lib/selectors";
import { freeBlocks } from "@/lib/slots";
import { type CalendarItem, type CalendarView, calendarItems, periodLabel, shiftAnchor, visibleDays } from "@/lib/calendar";
import { cn } from "@/lib/cn";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TimeGrid } from "./time-grid";
import { MonthGrid } from "./month-grid";
import { AppointmentDialog } from "./appointment-dialog";
import { PlanSlotDialog, type FreeSlotTarget } from "./plan-slot-dialog";
import { SuggestionDialog } from "./suggestion-dialog";
import { EVENT_STYLE, SUGGESTION_STYLE } from "./event-style";
import type { CalendarNav } from "./use-calendar-nav";

const VIEWS: { key: CalendarView; label: string }[] = [
  { key: "jour", label: "Jour" },
  { key: "semaine", label: "Semaine" },
  { key: "mois", label: "Mois" },
];

const LEGEND = [
  { dot: EVENT_STYLE.confirme.dot, label: "Confirmé" },
  { dot: SUGGESTION_STYLE.dot, label: "Suggéré par Astio, à confirmer" },
  { dot: EVENT_STYLE.realise.dot, label: "Réalisé" },
];

interface CalendarProps {
  nav: CalendarNav;
  /** Affiche les plages libres et permet d'y planifier un appel. */
  planning?: boolean;
}

export function Calendar({ nav, planning = false }: CalendarProps) {
  const { state, now } = useAstio();
  const { view, anchor, setView, setAnchor } = nav;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [freeTarget, setFreeTarget] = useState<FreeSlotTarget | null>(null);

  const clients = clientMap(state);
  const clientName = (id: string) => clients.get(id)?.name ?? "Client";
  const days = visibleDays(anchor, view);
  const items = calendarItems(state.appointments, state.calls, now);
  const selected = items.find((it) => it.id === selectedId) ?? null;
  const select = (item: CalendarItem) => setSelectedId(item.id);

  const openDay = (day: Date) => {
    setAnchor(day);
    setView("jour");
  };

  return (
    <Card className="overflow-hidden">
      {/* Barre d'outils */}
      <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3 sm:px-5">
        <div className="flex items-center gap-1">
          <Button size="sm" onClick={() => setAnchor(new Date(now))}>
            Aujourd&apos;hui
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="px-2"
            onClick={() => setAnchor((a) => shiftAnchor(a, view, -1))}
            aria-label="Période précédente"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="px-2"
            onClick={() => setAnchor((a) => shiftAnchor(a, view, 1))}
            aria-label="Période suivante"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
        <h2 className="min-w-0 flex-1 truncate text-[15px] font-semibold tracking-tight text-ink" aria-live="polite">
          {periodLabel(anchor, view)}
        </h2>
        <div role="tablist" aria-label="Affichage du calendrier" className="flex rounded-lg bg-stone-100 p-0.5">
          {VIEWS.map((v) => (
            <button
              key={v.key}
              type="button"
              role="tab"
              aria-selected={view === v.key}
              onClick={() => setView(v.key)}
              className={cn(
                "rounded-md px-3 py-1 text-[13px] font-medium transition",
                view === v.key ? "bg-surface text-ink shadow-sm" : "text-ink-soft hover:text-ink",
              )}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {view === "mois" ? (
        <MonthGrid
          days={days}
          month={anchor.getMonth()}
          items={items}
          clientName={clientName}
          hours={state.settings.hours}
          now={now}
          onSelect={select}
          onSelectDay={openDay}
        />
      ) : (
        <TimeGrid
          days={days}
          items={items}
          clientName={clientName}
          hours={state.settings.hours}
          now={now}
          onSelect={select}
          onSelectDay={openDay}
          freeBlocksFor={planning ? (day) => freeBlocks(state, day, now) : undefined}
          onFreeSlot={(day, startMin, block) => setFreeTarget({ day, startMin, block })}
        />
      )}

      {/* Légende */}
      <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-line px-4 py-2.5 text-xs text-ink-soft sm:px-5">
        {LEGEND.map(({ dot, label }) => (
          <li key={label} className="flex items-center gap-1.5">
            <span aria-hidden className={cn("size-2 rounded-full", dot)} />
            {label}
          </li>
        ))}
        {planning && view !== "mois" && (
          <li className="flex items-center gap-1.5">
            <span aria-hidden className="size-3 rounded-sm border border-dashed border-emerald-400 bg-emerald-50" />
            Plage libre : cliquez pour planifier
          </li>
        )}
        <li className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="size-3 rounded-sm bg-black/[0.07]"
          />
          Indisponible
        </li>
      </ul>

      <AppointmentDialog appt={selected?.kind === "rdv" ? selected.appt : null} onClose={() => setSelectedId(null)} />
      <SuggestionDialog
        suggestion={selected?.kind === "suggestion" ? { call: selected.call, slot: selected.slot } : null}
        onClose={() => setSelectedId(null)}
      />
      {planning && <PlanSlotDialog target={freeTarget} onClose={() => setFreeTarget(null)} />}
    </Card>
  );
}
