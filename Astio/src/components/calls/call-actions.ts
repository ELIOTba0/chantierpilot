import type { Appointment, Call, CallStatus, SlotProposal } from "@/lib/types";
import { dispatch, type Action } from "@/lib/store";
import { CALL_STATUS } from "@/lib/labels";
import { formatDayTime } from "@/lib/format";
import { toast } from "@/components/ui/toast";

/**
 * Actions métier déclenchées depuis l'interface : mise à jour du store local
 * et retour visuel. Les SMS au client sont simulés : rien n'est réellement envoyé.
 */

const SMS_NOTE = "SMS au client simulé : aucun message réel n'est envoyé.";

/** « Oui » : le professionnel confirme le créneau, Astio prévient le client. */
export function confirmSlot(call: Call, slot: SlotProposal, now: number) {
  dispatch({ type: "confirmSlot", callId: call.id, slot });
  toast("Rendez-vous confirmé", { description: `${formatDayTime(slot.start, now)}. ${SMS_NOTE}` });
}

export function rescheduleAppointment(appt: Appointment, slot: SlotProposal, now: number) {
  dispatch({ type: "reschedule", appointmentId: appt.id, start: slot.start, end: slot.end });
  toast("Rendez-vous reprogrammé", { description: `${formatDayTime(slot.start, now)}. ${SMS_NOTE}` });
}

export function cancelAppointment(call: Call, status: "a_traiter" | "a_confirmer" = "a_traiter") {
  dispatch({ type: "cancelAppointment", callId: call.id, status });
  toast("Rendez-vous annulé", { description: SMS_NOTE });
}

export function requestDecision(call: Call, slots: SlotProposal[]) {
  dispatch({ type: "requestDecision", callId: call.id, slots });
  toast("Créneau à confirmer", { description: "Le dossier attend votre réponse oui / non.", kind: "info" });
}

export function resolveDecision(call: Call, label: string, message: string) {
  dispatch({ type: "resolveDecision", callId: call.id, label });
  toast(message);
}

export function completeCall(call: Call) {
  dispatch({ type: "complete", callId: call.id });
  toast("Dossier terminé", { description: "Il reste consultable dans la colonne « Terminé »." });
}

export function changeStatus(call: Call, status: CallStatus) {
  dispatch({ type: "setStatus", callId: call.id, status });
  toast("Statut modifié", { description: `${CALL_STATUS[call.status].label} → ${CALL_STATUS[status].label}` });
}

export function disqualify(call: Call, reason: string, notifyClient = false) {
  dispatch({ type: "disqualify", callId: call.id, reason, notifyClient });
  toast("Dossier classé non qualifié", {
    description: notifyClient
      ? `La transcription et l'historique sont conservés. ${SMS_NOTE}`
      : "La transcription et l'historique sont conservés.",
  });
}

export function updateCallInfo(call: Call, patch: Extract<Action, { type: "updateCall" }>["patch"]) {
  dispatch({ type: "updateCall", callId: call.id, patch });
  if (call.decision?.kind === "completer_infos" && patch.missingInfo?.length === 0) {
    dispatch({ type: "resolveDecision", callId: call.id, label: "Informations complétées par le professionnel" });
  }
  toast("Informations enregistrées");
}
