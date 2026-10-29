"use client";

import { useSyncExternalStore } from "react";
import type { AppState, Appointment, Call, CallStatus, HistoryEvent, Settings, SlotProposal } from "./types";
import { buildDemoState, STATE_VERSION } from "./demo-data";
import { dayKey, formatDayTime, formatTime } from "./format";
import { CALL_STATUS } from "./labels";
import { cancellationSms, confirmationSms, declineSms, rescheduleSms } from "./messages";

/**
 * Store local de l'application (simulation, aucune API).
 * Les données sont conservées dans le localStorage du navigateur.
 *
 * Règle métier : l'agent vocal ne fixe jamais de rendez-vous. Il recueille les
 * disponibilités et suggère un créneau ; le professionnel répond oui ou non,
 * puis Astio prévient le client par SMS (simulé).
 */

const STORAGE_KEY = "astio:state";

export type Action =
  /** Le professionnel confirme un créneau : rendez-vous créé (ou déplacé) et SMS au client. */
  | { type: "confirmSlot"; callId: string; slot: SlotProposal }
  | { type: "reschedule"; appointmentId: string; start: string; end: string }
  | { type: "cancelAppointment"; callId: string; status: "a_traiter" | "a_confirmer" }
  /** Place l'appel en attente d'une réponse oui / non sur des créneaux suggérés. */
  | { type: "requestDecision"; callId: string; slots: SlotProposal[] }
  | { type: "markDone"; appointmentId: string }
  | { type: "resolveDecision"; callId: string; label: string; detail?: string }
  | { type: "setStatus"; callId: string; status: CallStatus }
  | { type: "complete"; callId: string }
  | { type: "disqualify"; callId: string; reason: string; notifyClient?: boolean }
  | { type: "updateCall"; callId: string; patch: Partial<Pick<Call, "address" | "motif" | "description" | "estimatedDurationMin" | "missingInfo">> }
  | { type: "updateSettings"; settings: Settings }
  | { type: "reset" };

let eventSeq = 0;
function event(actor: HistoryEvent["actor"], label: string, detail?: string): HistoryEvent {
  eventSeq += 1;
  return { id: `ev-${Date.now().toString(36)}-${eventSeq}`, at: new Date().toISOString(), actor, label, detail };
}

/** Trace de l'envoi simulé d'un SMS, ou rappel de prévenir le client si l'envoi est désactivé. */
function smsEvent(state: AppState, label: string, text: string): HistoryEvent {
  return state.settings.handling.smsOnDecision
    ? event("astio", `${label} (simulation)`, text)
    : event("plombier", "Client à prévenir vous-même", "Envoi de SMS désactivé dans vos réglages");
}

function updateCall(state: AppState, callId: string, fn: (c: Call) => Call): AppState {
  return { ...state, calls: state.calls.map((c) => (c.id === callId ? fn(c) : c)) };
}

function updateAppointment(state: AppState, id: string | undefined, fn: (a: Appointment) => Appointment): AppState {
  if (!id) return state;
  return { ...state, appointments: state.appointments.map((a) => (a.id === id ? fn(a) : a)) };
}

export function reducer(state: AppState, action: Action): AppState {
  const now = Date.now();
  const clientName = (id: string) => state.clients.find((c) => c.id === id)?.name ?? "";
  const profile = state.settings.profile;

  switch (action.type) {
    case "confirmSlot": {
      const call = state.calls.find((c) => c.id === action.callId);
      if (!call) return state;
      const client = state.clients.find((cl) => cl.id === call.clientId);
      const existing = call.appointmentId ? state.appointments.find((a) => a.id === call.appointmentId) : undefined;
      // Un rendez-vous encore actif est déplacé ; sinon on en crée un nouveau.
      const move = existing?.state === "confirme";
      let next = state;
      let appointmentId = call.appointmentId;
      if (move && existing) {
        next = updateAppointment(next, existing.id, (a) => ({
          ...a,
          rescheduledFrom: a.start,
          start: action.slot.start,
          end: action.slot.end,
        }));
      } else {
        appointmentId = `rdv-${now.toString(36)}`;
        next = {
          ...next,
          appointments: [
            ...next.appointments,
            {
              id: appointmentId,
              clientId: call.clientId,
              callId: call.id,
              start: action.slot.start,
              end: action.slot.end,
              state: "confirme",
              motif: call.motif,
              address: call.address ?? client?.address ?? "Adresse à préciser",
              zone: client?.zone ?? "",
            },
          ],
        };
      }
      const name = clientName(call.clientId);
      return updateCall(next, call.id, (c) => ({
        ...c,
        appointmentId,
        status: "rdv_confirme",
        decision: null,
        proposedSlots: [],
        urgencyNote: c.decision?.kind === "verifier_urgence" ? "Urgence vérifiée par vos soins." : c.urgencyNote,
        agentSteps: c.agentSteps.map((s) => ({ ...s, done: true })),
        history: [
          ...c.history,
          ...(c.decision?.kind === "verifier_urgence" ? [event("plombier", "Urgence vérifiée par le professionnel")] : []),
          event(
            "plombier",
            move ? "Nouveau créneau confirmé" : "Créneau confirmé",
            `${formatDayTime(action.slot.start, now)} – ${formatTime(action.slot.end)}`,
          ),
          move
            ? smsEvent(state, "SMS de report envoyé", rescheduleSms(name, action.slot.start, action.slot.end, profile))
            : smsEvent(state, "SMS de confirmation envoyé", confirmationSms(name, action.slot.start, action.slot.end, profile)),
        ],
      }));
    }
    case "reschedule": {
      const appt = state.appointments.find((a) => a.id === action.appointmentId);
      if (!appt || appt.state !== "confirme") return state;
      const name = clientName(appt.clientId);
      const moved = event(
        "plombier",
        "Rendez-vous reprogrammé",
        `${formatDayTime(appt.start, now)} → ${formatDayTime(action.start, now)} – ${formatTime(action.end)}`,
      );
      const sms = smsEvent(state, "SMS de report envoyé", rescheduleSms(name, action.start, action.end, profile));
      const next = updateAppointment(state, appt.id, (a) => ({
        ...a,
        rescheduledFrom: a.start,
        start: action.start,
        end: action.end,
        history: [...(a.history ?? []), moved, sms],
      }));
      if (!appt.callId) return next;
      return updateCall(next, appt.callId, (c) => ({ ...c, history: [...c.history, moved, sms] }));
    }
    case "cancelAppointment": {
      const call = state.calls.find((c) => c.id === action.callId);
      const appt = call?.appointmentId ? state.appointments.find((a) => a.id === call.appointmentId) : undefined;
      if (!call || !appt) return state;
      const next = updateAppointment(state, appt.id, (a) => ({ ...a, state: "annule" }));
      return updateCall(next, call.id, (c) => ({
        ...c,
        status: action.status,
        appointmentId: undefined,
        history: [
          ...c.history,
          event("plombier", "Rendez-vous annulé", formatDayTime(appt.start, now)),
          smsEvent(state, "SMS d'annulation envoyé", cancellationSms(clientName(c.clientId), appt.start, profile)),
        ],
      }));
    }
    case "requestDecision":
      return updateCall(state, action.callId, (c) => ({
        ...c,
        status: "a_confirmer",
        proposedSlots: action.slots,
        // Les décisions liées au créneau sont conservées ; les autres sont remplacées.
        decision: ["verifier_urgence", "choisir_creneau", "confirmer_creneau"].includes(c.decision?.kind ?? "")
          ? c.decision
          : {
              kind: "confirmer_creneau",
              reason: "Astio suggère ce créneau d'après votre planning et les disponibilités recueillies.",
              expectedAction: "Confirmer le créneau",
            },
        history: [
          ...c.history,
          event("astio", "Créneau suggéré par Astio", action.slots[0] ? formatDayTime(action.slots[0].start, now) : undefined),
        ],
      }));
    case "markDone": {
      const appt = state.appointments.find((a) => a.id === action.appointmentId);
      if (!appt) return state;
      if (appt.callId) return reducer(state, { type: "complete", callId: appt.callId });
      return updateAppointment(state, appt.id, (a) => ({
        ...a,
        state: "realise",
        history: [...(a.history ?? []), event("plombier", "Intervention réalisée")],
      }));
    }
    case "resolveDecision":
      return updateCall(state, action.callId, (c) => ({
        ...c,
        decision: null,
        history: [...c.history, event("plombier", action.label, action.detail)],
      }));
    case "setStatus":
      return updateCall(state, action.callId, (c) => ({
        ...c,
        status: action.status,
        history: [
          ...c.history,
          event("plombier", "Statut modifié", `${CALL_STATUS[c.status].label} → ${CALL_STATUS[action.status].label}`),
        ],
      }));
    case "complete": {
      const call = state.calls.find((c) => c.id === action.callId);
      // Seul un rendez-vous confirmé et déjà commencé est considéré comme réalisé.
      const next = updateAppointment(state, call?.appointmentId, (a) =>
        a.state === "confirme" && new Date(a.start).getTime() <= now ? { ...a, state: "realise" } : a,
      );
      return updateCall(next, action.callId, (c) => ({
        ...c,
        status: "termine",
        decision: null,
        history: [...c.history, event("plombier", "Dossier marqué comme terminé")],
      }));
    }
    case "disqualify": {
      const call = state.calls.find((c) => c.id === action.callId);
      const next = updateAppointment(state, call?.appointmentId, (a) =>
        a.state === "realise" ? a : { ...a, state: "annule" },
      );
      // La transcription et l'historique sont conservés.
      return updateCall(next, action.callId, (c) => ({
        ...c,
        status: "non_qualifie",
        decision: null,
        history: [
          ...c.history,
          event("plombier", "Classé non qualifié", action.reason),
          ...(action.notifyClient ? [smsEvent(state, "SMS de refus envoyé", declineSms(clientName(c.clientId), profile))] : []),
        ],
      }));
    }
    case "updateCall":
      return updateCall(state, action.callId, (c) => ({
        ...c,
        ...action.patch,
        history: [...c.history, event("plombier", "Informations du dossier modifiées")],
      }));
    case "updateSettings":
      return { ...state, settings: action.settings };
    case "reset":
      return { ...buildDemoState(now), settings: state.settings };
  }
}

// ------------------------------------------------------------ Store externe

let state: AppState | null = null;
const listeners = new Set<() => void>();

function load(): AppState {
  const fresh = () => buildDemoState(Date.now());
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return fresh();
    const saved = JSON.parse(raw) as AppState;
    if (saved.version !== STATE_VERSION) return fresh();
    // Les données de démonstration sont relatives à la date du jour :
    // on les régénère chaque jour en conservant les réglages.
    if (saved.seededOn !== dayKey(new Date())) return { ...fresh(), settings: saved.settings };
    return saved;
  } catch {
    return fresh();
  }
}

function persist(s: AppState) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    // Stockage indisponible (navigation privée…) : l'application reste utilisable.
  }
}

function getSnapshot(): AppState {
  if (!state) {
    state = load();
    persist(state);
  }
  return state;
}

function getServerSnapshot(): AppState | null {
  return null;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function dispatch(action: Action) {
  state = reducer(getSnapshot(), action);
  persist(state);
  listeners.forEach((l) => l());
}

/** Renvoie null tant que l'état local n'est pas chargé (rendu serveur, hydratation). */
export function useAppState(): AppState | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
