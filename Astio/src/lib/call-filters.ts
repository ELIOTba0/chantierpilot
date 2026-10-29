import type { Appointment, AppointmentState, Call, CallStatus, Client, Priority } from "./types";
import { isSameDay } from "./format";
import { CALL_STATUS_ORDER, PRIORITY } from "./labels";
import { isToPlan } from "./selectors";
import { normalize } from "./search";

/** « none » : dossier sans rendez-vous associé. */
export type AppointmentFilter = AppointmentState | "none";

export type SortKey = "date" | "priorite" | "statut";

export interface CallFilters {
  query: string;
  decisionOnly: boolean;
  toPlanOnly: boolean;
  todayOnly: boolean;
  statuses: CallStatus[];
  priorities: Priority[];
  appointments: AppointmentFilter[];
  sort: SortKey;
}

export const EMPTY_FILTERS: CallFilters = {
  query: "",
  decisionOnly: false,
  toPlanOnly: false,
  todayOnly: false,
  statuses: [],
  priorities: [],
  appointments: [],
  sort: "priorite",
};

/** Filtres initiaux à partir des liens profonds (tableau de bord, notifications…). */
export function filtersFromParams(params: URLSearchParams): CallFilters {
  const priority = params.get("priorite");
  return {
    ...EMPTY_FILTERS,
    decisionOnly: params.get("vue") === "decisions",
    toPlanOnly: params.get("vue") === "a-planifier",
    todayOnly: params.get("periode") === "aujourdhui",
    priorities: priority && priority in PRIORITY ? [priority as Priority] : [],
  };
}

export function activeFilterCount(f: CallFilters): number {
  return (
    Number(f.decisionOnly) +
    Number(f.toPlanOnly) +
    Number(f.todayOnly) +
    f.statuses.length +
    f.priorities.length +
    f.appointments.length +
    Number(f.query.trim().length > 0)
  );
}

interface Context {
  clients: Map<string, Client>;
  appointments: Map<string, Appointment>;
  now: number;
}

function matchesQuery(call: Call, client: Client | undefined, query: string): boolean {
  const q = normalize(query.trim());
  if (!q) return true;
  const digits = query.replace(/\D/g, "");
  if (digits.length >= 2 && client?.phone.includes(digits)) return true;
  return normalize(`${client?.name ?? ""} ${call.motif} ${call.summary} ${call.id}`).includes(q);
}

export function filterCalls(calls: Call[], f: CallFilters, ctx: Context): Call[] {
  return calls.filter((call) => {
    const appt = call.appointmentId ? ctx.appointments.get(call.appointmentId) : undefined;
    if (f.decisionOnly && call.decision === null) return false;
    if (f.toPlanOnly && !isToPlan(call)) return false;
    if (f.todayOnly && !isSameDay(call.receivedAt, new Date(ctx.now))) return false;
    if (f.statuses.length && !f.statuses.includes(call.status)) return false;
    if (f.priorities.length && !f.priorities.includes(call.priority)) return false;
    if (f.appointments.length && !f.appointments.includes(appt ? appt.state : "none")) return false;
    return matchesQuery(call, ctx.clients.get(call.clientId), f.query);
  });
}

export function sortCalls(calls: Call[], sort: SortKey): Call[] {
  const byDate = (a: Call, b: Call) => b.receivedAt.localeCompare(a.receivedAt);
  const byPriority = (a: Call, b: Call) => PRIORITY[a.priority].rank - PRIORITY[b.priority].rank;
  const byStatus = (a: Call, b: Call) => CALL_STATUS_ORDER.indexOf(a.status) - CALL_STATUS_ORDER.indexOf(b.status);
  const compare: Record<SortKey, (a: Call, b: Call) => number> = {
    date: byDate,
    // À priorité égale, les dossiers en attente de décision passent devant.
    priorite: (a, b) => byPriority(a, b) || Number(b.decision !== null) - Number(a.decision !== null) || byDate(a, b),
    statut: (a, b) => byStatus(a, b) || byPriority(a, b) || byDate(a, b),
  };
  return [...calls].sort(compare[sort]);
}
