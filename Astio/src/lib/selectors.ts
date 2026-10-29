import type { AppState, Appointment, Call, Client, SlotProposal } from "./types";
import { isSameDay } from "./format";
import { PRIORITY } from "./labels";

export function clientMap(state: AppState): Map<string, Client> {
  return new Map(state.clients.map((c) => [c.id, c]));
}

export function appointmentMap(state: AppState): Map<string, Appointment> {
  return new Map(state.appointments.map((a) => [a.id, a]));
}

export function byPriorityThenRecent(a: Call, b: Call): number {
  return PRIORITY[a.priority].rank - PRIORITY[b.priority].rank || b.receivedAt.localeCompare(a.receivedAt);
}

function byRecent(a: Call, b: Call): number {
  return b.receivedAt.localeCompare(a.receivedAt);
}

/** Ordre des listes de travail : urgences en tête si le réglage est actif, sinon du plus récent au plus ancien. */
function workOrder(state: AppState) {
  return state.settings.handling.flagUrgent ? byPriorityThenRecent : byRecent;
}

/** Dossiers pour lesquels le plombier doit intervenir, transversalement aux statuts. */
export function decisionQueue(state: AppState): Call[] {
  return state.calls.filter((c) => c.decision !== null).sort(workOrder(state));
}

/**
 * Appels pour lesquels aucun rendez-vous n'est encore confirmé alors qu'une
 * intervention est attendue (les demandes hors prestations n'en font pas partie).
 */
export function isToPlan(c: Call): boolean {
  return (c.status === "a_traiter" || c.status === "a_confirmer") && c.decision?.kind !== "hors_prestations";
}

/**
 * Créneau recommandé par Astio : le premier qui n'est ni passé, ni pris
 * entre-temps par un autre rendez-vous confirmé.
 */
export function suggestedSlot(c: Call, now: number, appointments: Appointment[]): SlotProposal | undefined {
  const busy = appointments.filter((a) => a.state === "confirme" && a.id !== c.appointmentId);
  return c.proposedSlots.find(
    (s) => new Date(s.start).getTime() > now && !busy.some((a) => s.start < a.end && s.end > a.start),
  );
}

export function callsToPlan(state: AppState): Call[] {
  return state.calls.filter(isToPlan).sort(workOrder(state));
}

export function callsReceivedOn(state: AppState, day: number): Call[] {
  return state.calls.filter((c) => isSameDay(c.receivedAt, new Date(day)));
}

export interface ClientSummary {
  client: Client;
  calls: Call[];
  appointments: Appointment[];
  upcoming: Appointment | undefined;
  lastInteraction: string;
}

/**
 * Fiches clients dérivées des appels et rendez-vous (une seule source de
 * données). Les appelants dont tous les appels sont non qualifiés sont exclus.
 */
export function clientSummaries(state: AppState, now: number): ClientSummary[] {
  return state.clients
    .map((client) => {
      const calls = state.calls
        .filter((c) => c.clientId === client.id)
        .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
      const appointments = state.appointments
        .filter((a) => a.clientId === client.id && a.state !== "annule")
        .sort((a, b) => b.start.localeCompare(a.start));
      const upcoming = [...appointments]
        .reverse()
        .find((a) => a.state === "confirme" && new Date(a.end).getTime() >= now);
      const lastInteraction = calls[0]?.receivedAt ?? client.since;
      return { client, calls, appointments, upcoming, lastInteraction };
    })
    .filter((r) => r.calls.length === 0 || r.calls.some((c) => c.status !== "non_qualifie"))
    .sort((a, b) => b.lastInteraction.localeCompare(a.lastInteraction));
}

/** Appels menés à leur terme par Astio, sans aucune action du professionnel. */
export function handledByAstio(calls: Call[]): Call[] {
  return calls.filter((c) => c.decision === null && !c.history.some((e) => e.actor === "plombier"));
}
