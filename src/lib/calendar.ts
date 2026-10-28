import type { Appointment, Call, SlotProposal } from "./types";
import { suggestedSlot } from "./selectors";
import { addDays, startOfDay } from "./format";

export type CalendarView = "jour" | "semaine" | "mois";

/** Plage horaire affichée dans les vues Jour et Semaine. */
export const GRID_START_HOUR = 7;
export const GRID_END_HOUR = 20;

/** Lundi de la semaine contenant `d`. */
export function startOfWeek(d: Date): Date {
  const r = startOfDay(d);
  const offset = (r.getDay() + 6) % 7;
  return addDays(r, -offset);
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

/** Jours affichés pour une vue donnée. */
export function visibleDays(anchor: Date, view: CalendarView): Date[] {
  if (view === "jour") return [startOfDay(anchor)];
  if (view === "semaine") {
    const monday = startOfWeek(anchor);
    return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  }
  // Mois : semaines complètes, du lundi au dimanche.
  const first = startOfWeek(startOfMonth(anchor));
  const last = addDays(startOfWeek(addDays(addMonths(anchor, 1), -1)), 6);
  const days: Date[] = [];
  for (let d = first; d <= last; d = addDays(d, 1)) days.push(d);
  return days;
}

export function shiftAnchor(anchor: Date, view: CalendarView, direction: 1 | -1): Date {
  if (view === "jour") return addDays(anchor, direction);
  if (view === "semaine") return addDays(anchor, 7 * direction);
  return addMonths(anchor, direction);
}

const monthFmt = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" });
const dayMonthFmt = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" });
const fullDayFmt = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function periodLabel(anchor: Date, view: CalendarView): string {
  if (view === "jour") return capitalize(fullDayFmt.format(anchor));
  if (view === "mois") return capitalize(monthFmt.format(anchor));
  const days = visibleDays(anchor, "semaine");
  return `${dayMonthFmt.format(days[0])} – ${dayMonthFmt.format(days[6])} ${days[6].getFullYear()}`;
}

/** Minutes depuis minuit, en heure locale. */
export function minutesOfDay(iso: string): number {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
}

export function parseHHMM(value: string): number {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}

/**
 * Élément affiché dans le calendrier : un rendez-vous, ou un créneau suggéré
 * par Astio qui attend la réponse du professionnel.
 */
export type CalendarItem =
  | { kind: "rdv"; id: string; start: string; end: string; clientId: string; motif: string; appt: Appointment }
  | { kind: "suggestion"; id: string; start: string; end: string; clientId: string; motif: string; call: Call; slot: SlotProposal };

export function calendarItems(appointments: Appointment[], calls: Call[], now: number): CalendarItem[] {
  const rdv: CalendarItem[] = appointments
    .filter((a) => a.state !== "annule")
    .map((a) => ({ kind: "rdv", id: a.id, start: a.start, end: a.end, clientId: a.clientId, motif: a.motif, appt: a }));
  const suggestions: CalendarItem[] = calls.flatMap((c) => {
    if (c.status !== "a_confirmer") return [];
    const slot = suggestedSlot(c, now, appointments);
    return slot
      ? [{ kind: "suggestion" as const, id: `sugg-${c.id}`, start: slot.start, end: slot.end, clientId: c.clientId, motif: c.motif, call: c, slot }]
      : [];
  });
  return [...rdv, ...suggestions];
}

export interface Placed<T> {
  item: T;
  lane: number;
  lanes: number;
}

/**
 * Répartit les éléments qui se chevauchent sur plusieurs colonnes
 * pour qu'aucun ne masque un autre.
 */
export function layoutDay<T extends { start: string; end: string }>(items: T[]): Placed<T>[] {
  const sorted = [...items].sort((a, b) => a.start.localeCompare(b.start) || b.end.localeCompare(a.end));
  const placed: Placed<T>[] = [];
  let cluster: Placed<T>[] = [];
  let clusterEnd = "";
  let laneEnds: string[] = [];

  const flush = () => {
    const lanes = laneEnds.length;
    cluster.forEach((p) => (p.lanes = lanes));
    placed.push(...cluster);
    cluster = [];
    laneEnds = [];
  };

  for (const item of sorted) {
    if (cluster.length > 0 && item.start >= clusterEnd) flush();
    let lane = laneEnds.findIndex((end) => end <= item.start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(item.end);
    } else {
      laneEnds[lane] = item.end;
    }
    cluster.push({ item, lane, lanes: 1 });
    clusterEnd = cluster.length === 1 || item.end > clusterEnd ? item.end : clusterEnd;
  }
  if (cluster.length > 0) flush();
  return placed;
}
