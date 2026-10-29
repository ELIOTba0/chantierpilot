"use client";

import { useState } from "react";
import { useAstio } from "@/lib/app-context";
import { callsReceivedOn, callsToPlan, handledByAstio } from "@/lib/selectors";
import { StatTile } from "@/components/dashboard/stat-tile";
import { ToPlanSheet } from "@/components/dashboard/to-plan-sheet";
import { Calendar } from "@/components/calendar/calendar";
import { useCalendarNav } from "@/components/calendar/use-calendar-nav";

/**
 * Vue d'ensemble : deux chiffres, puis le calendrier. Le calendrier sert aussi
 * à planifier (plages libres cliquables, créneaux suggérés à confirmer).
 */
export default function DashboardPage() {
  const { state, now } = useAstio();
  const received = callsReceivedOn(state, now);
  const toPlan = callsToPlan(state).length;
  const handled = handledByAstio(received).length;
  const nav = useCalendarNav(now);
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <StatTile
          href="/appels?periode=aujourdhui"
          label="Appels reçus aujourd'hui"
          value={received.length}
          caption={`${handled} traités par Astio sans vous`}
        />
        <StatTile
          onClick={() => setSheetOpen(true)}
          label="Appels à planifier"
          value={toPlan}
          caption={toPlan > 0 ? "Un créneau vous attend pour chacun" : "Tout est planifié"}
          highlight={toPlan > 0}
        />
      </div>
      <Calendar nav={nav} planning />
      <ToPlanSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onFocusDate={(iso) => nav.setAnchor(new Date(iso))}
      />
    </div>
  );
}
