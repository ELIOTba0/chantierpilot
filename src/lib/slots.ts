import type { AppState, SlotProposal } from "./types";
import { addDays, formatTime, startOfDay } from "./format";
import { parseHHMM } from "./calendar";

interface SuggestOptions {
  durationMin: number;
  now: number;
  /** Rendez-vous à ignorer (celui que l'on reprogramme). */
  excludeAppointmentId?: string;
  count?: number;
  maxPerDay?: number;
  horizonDays?: number;
}

const STEP_MIN = 30;
const MIN_NOTICE_MIN = 60;

/**
 * Propose des créneaux à partir du planning local et des préférences horaires.
 * Simulation : aucun agenda externe n'est consulté.
 */
export function suggestSlots(state: AppState, opts: SuggestOptions): SlotProposal[] {
  const { hours } = state.settings;
  const { durationMin, now, excludeAppointmentId, count = 4, maxPerDay = 2, horizonDays = 10 } = opts;
  const clients = new Map(state.clients.map((c) => [c.id, c.name]));
  const busy = state.appointments
    .filter((a) => a.state !== "annule" && a.id !== excludeAppointmentId)
    .map((a) => ({ start: new Date(a.start).getTime(), end: new Date(a.end).getTime(), who: clients.get(a.clientId) }));

  const workStart = parseHHMM(hours.start);
  const workEnd = parseHHMM(hours.end);
  const breakStart = parseHHMM(hours.breakStart);
  const breakEnd = parseHHMM(hours.breakEnd);
  const buffer = hours.bufferMin * 60_000;
  const duration = durationMin * 60_000;
  const earliest = now + MIN_NOTICE_MIN * 60_000;

  const result: SlotProposal[] = [];
  const today = startOfDay(new Date(now));

  for (let i = 0; i <= horizonDays && result.length < count; i++) {
    const day = addDays(today, i);
    if (!hours.workdays.includes(day.getDay() as (typeof hours.workdays)[number])) continue;
    let perDay = 0;

    for (let m = workStart; m + durationMin <= workEnd && perDay < maxPerDay && result.length < count; m += STEP_MIN) {
      const end = m + durationMin;
      if (m < breakEnd && end > breakStart) continue;
      const start = day.getTime() + m * 60_000;
      if (start < earliest) continue;
      const stop = start + duration;
      if (busy.some((b) => start < b.end && stop > b.start)) continue;

      const tight = busy.find((b) => start < b.end + buffer && stop + buffer > b.start);
      result.push({
        start: new Date(start).toISOString(),
        end: new Date(stop).toISOString(),
        availability: tight ? "serre" : "libre",
        note: tight
          ? `Marge inférieure à ${hours.bufferMin} min avec ${tight.who ?? "un autre rendez-vous"} (${formatTime(new Date(tight.start).toISOString())})`
          : undefined,
      });
      perDay++;
      // Espace les propositions d'une même journée.
      m += durationMin;
    }
  }
  return result;
}

export interface FreeBlock {
  /** Minutes depuis minuit. */
  start: number;
  end: number;
}

/**
 * Plages libres d'une journée : horaires de travail, hors pause et hors
 * rendez-vous existants, à partir de maintenant. Simulation locale uniquement.
 */
export function freeBlocks(state: AppState, day: Date, now: number, minMinutes = 30): FreeBlock[] {
  const { hours } = state.settings;
  if (!hours.workdays.includes(day.getDay() as (typeof hours.workdays)[number])) return [];

  const dayStart = startOfDay(day).getTime();
  const toMin = (ms: number) => Math.round((ms - dayStart) / 60_000);
  const nowMin = toMin(now);
  const busy = state.appointments
    .filter((a) => a.state !== "annule" && startOfDay(new Date(a.start)).getTime() === dayStart)
    .map((a) => ({ start: toMin(new Date(a.start).getTime()), end: toMin(new Date(a.end).getTime()) }));
  busy.push({ start: parseHHMM(hours.breakStart), end: parseHHMM(hours.breakEnd) });
  busy.sort((a, b) => a.start - b.start);

  // Les plages commencent au plus tôt à la prochaine demi-heure.
  let cursor = Math.max(parseHHMM(hours.start), Math.ceil(nowMin / 30) * 30);
  const end = parseHHMM(hours.end);
  const blocks: FreeBlock[] = [];
  for (const b of busy) {
    if (b.start > cursor) blocks.push({ start: cursor, end: Math.min(b.start, end) });
    cursor = Math.max(cursor, b.end);
  }
  if (cursor < end) blocks.push({ start: cursor, end });
  return blocks.filter((b) => b.end - b.start >= minMinutes);
}
