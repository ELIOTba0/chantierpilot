"use client";

import { useState } from "react";
import type { CalendarView } from "@/lib/calendar";

const VIEW_STORAGE_KEY = "astio:calendar-view";

/** Vue mémorisée par navigateur ; sur petit écran, la vue Jour par défaut. */
function initialView(): CalendarView {
  try {
    const saved = window.localStorage.getItem(VIEW_STORAGE_KEY);
    if (saved === "jour" || saved === "semaine" || saved === "mois") return saved;
  } catch {
    // Stockage indisponible : on garde la valeur par défaut.
  }
  return window.matchMedia("(min-width: 768px)").matches ? "semaine" : "jour";
}

export interface CalendarNav {
  view: CalendarView;
  anchor: Date;
  setView: (view: CalendarView) => void;
  setAnchor: (anchor: Date | ((current: Date) => Date)) => void;
}

/** Période et vue affichées, remontées pour que la page puisse piloter le calendrier. */
export function useCalendarNav(now: number): CalendarNav {
  const [view, setViewState] = useState<CalendarView>(initialView);
  const [anchor, setAnchor] = useState(() => new Date(now));

  const setView = (next: CalendarView) => {
    setViewState(next);
    try {
      window.localStorage.setItem(VIEW_STORAGE_KEY, next);
    } catch {
      // Préférence non mémorisée, sans conséquence.
    }
  };

  return { view, anchor, setView, setAnchor };
}
