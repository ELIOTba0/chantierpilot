/**
 * Modèle de données d'Astio.
 *
 * Quatre dimensions sont volontairement indépendantes :
 * - le statut de traitement du dossier (CallStatus) ;
 * - l'état du rendez-vous (AppointmentState) ;
 * - le niveau de priorité (Priority) ;
 * - la nécessité d'une intervention humaine (Decision | null).
 */

export type CallStatus =
  | "a_traiter"
  /** Astio a suggéré un créneau : le professionnel doit répondre oui ou non. */
  | "a_confirmer"
  | "rdv_confirme"
  | "termine"
  | "non_qualifie";

export type Priority = "urgente" | "haute" | "normale" | "basse";

/**
 * Un rendez-vous n'existe qu'une fois confirmé par le professionnel :
 * l'agent vocal ne fixe jamais de rendez-vous, il recueille les disponibilités.
 */
export type AppointmentState = "confirme" | "realise" | "annule";

export type DecisionKind =
  | "verifier_urgence"
  | "confirmer_creneau"
  | "choisir_creneau"
  | "rappeler"
  | "completer_infos"
  | "hors_prestations";

export interface Decision {
  kind: DecisionKind;
  /** Pourquoi Astio sollicite le professionnel. */
  reason: string;
  /** Action attendue, formulée pour le plombier. */
  expectedAction: string;
}

export type Actor = "astio" | "plombier" | "client";

export interface HistoryEvent {
  id: string;
  at: string;
  actor: Actor;
  label: string;
  detail?: string;
}

export interface TranscriptLine {
  speaker: "astio" | "client";
  /** Secondes écoulées depuis le début de l'appel. */
  t: number;
  text: string;
}

export interface AgentStep {
  label: string;
  done: boolean;
}

export interface SlotProposal {
  start: string;
  end: string;
  /** Disponibilité simulée par rapport au planning local. */
  availability: "libre" | "serre";
  note?: string;
}

export interface Call {
  id: string;
  clientId: string;
  receivedAt: string;
  durationSec: number;
  motif: string;
  summary: string;
  description: string;
  interventionType: string;
  address?: string;
  clientAvailability: string[];
  estimatedDurationMin: number;
  missingInfo: string[];
  priority: Priority;
  /** Formulation prudente : il s'agit d'une estimation, pas d'un diagnostic. */
  urgencyNote: string;
  status: CallStatus;
  appointmentId?: string;
  decision: Decision | null;
  /** Créneaux suggérés par Astio d'après les disponibilités du client ; le premier est recommandé. */
  proposedSlots: SlotProposal[];
  agentSteps: AgentStep[];
  transcript: TranscriptLine[];
  history: HistoryEvent[];
}

export interface Appointment {
  id: string;
  clientId: string;
  callId?: string;
  start: string;
  end: string;
  state: AppointmentState;
  motif: string;
  address: string;
  zone: string;
  /** Horaire de début précédent, conservé après une reprogrammation. */
  rescheduledFrom?: string;
  /** Événements propres au rendez-vous (utile quand il n'est lié à aucun appel). */
  history?: HistoryEvent[];
}

export interface Client {
  id: string;
  name: string;
  phone: string;
  address?: string;
  zone?: string;
  since: string;
}

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface Settings {
  profile: {
    name: string;
    company: string;
    phone: string;
    zone: string;
    services: string[];
  };
  hours: {
    workdays: Weekday[];
    start: string;
    end: string;
    breakStart: string;
    breakEnd: string;
    defaultDurationMin: number;
    bufferMin: number;
    emergencySlots: string[];
  };
  handling: {
    /** Astio prévient le client par SMS après chaque décision du professionnel (simulé). */
    smsOnDecision: boolean;
    /** Les situations urgentes sont remontées en tête de liste. */
    flagUrgent: boolean;
    priorityTopics: string[];
  };
}

export interface AppState {
  version: number;
  /** Jour (AAAA-MM-JJ) auquel les données de démonstration ont été générées. */
  seededOn: string;
  clients: Client[];
  calls: Call[];
  appointments: Appointment[];
  settings: Settings;
}
