import type { AppointmentState, CallStatus, DecisionKind, Priority } from "./types";

/**
 * Libellés et tons sémantiques. Les tons sont traduits en classes par les
 * composants d'interface (voir components/ui/badge.tsx) afin de garder une
 * seule source de vérité pour les couleurs.
 */
export type Tone = "urgent" | "warning" | "info" | "success" | "neutral" | "muted" | "brand";

export const CALL_STATUS: Record<CallStatus, { label: string; tone: Tone }> = {
  a_traiter: { label: "À traiter", tone: "brand" },
  a_confirmer: { label: "À confirmer", tone: "info" },
  rdv_confirme: { label: "Rendez-vous confirmé", tone: "success" },
  termine: { label: "Terminé", tone: "neutral" },
  non_qualifie: { label: "Non qualifié", tone: "muted" },
};

export const CALL_STATUS_ORDER: CallStatus[] = [
  "a_traiter",
  "a_confirmer",
  "rdv_confirme",
  "termine",
  "non_qualifie",
];

export const PRIORITY: Record<Priority, { label: string; tone: Tone; rank: number }> = {
  urgente: { label: "Urgente", tone: "urgent", rank: 0 },
  haute: { label: "Haute", tone: "warning", rank: 1 },
  normale: { label: "Normale", tone: "neutral", rank: 2 },
  basse: { label: "Basse", tone: "muted", rank: 3 },
};

export const APPOINTMENT_STATE: Record<AppointmentState, { label: string; short: string; tone: Tone }> = {
  confirme: { label: "Rendez-vous confirmé", short: "Confirmé", tone: "success" },
  realise: { label: "Intervention réalisée", short: "Réalisé", tone: "neutral" },
  annule: { label: "Annulé", short: "Annulé", tone: "muted" },
};

export const DECISION_KIND: Record<DecisionKind, { label: string }> = {
  verifier_urgence: { label: "Urgence à vérifier" },
  confirmer_creneau: { label: "Créneau à confirmer" },
  choisir_creneau: { label: "Créneau à choisir" },
  rappeler: { label: "Rappel demandé" },
  completer_infos: { label: "Informations incomplètes" },
  hors_prestations: { label: "Hors prestations" },
};
