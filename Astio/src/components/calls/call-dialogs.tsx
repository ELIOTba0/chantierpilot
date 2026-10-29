"use client";

import { useState } from "react";
import type { Call } from "@/lib/types";
import { formatDayTime } from "@/lib/format";
import { useAstio } from "@/lib/app-context";
import { suggestSlots } from "@/lib/slots";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Modal } from "@/components/ui/modal";
import { cancelAppointment, confirmSlot, disqualify } from "./call-actions";
import { SlotPicker } from "./panel/slot-picker";

const REASONS = [
  "Hors prestations proposées",
  "Hors zone d'intervention",
  "Démarchage commercial",
  "Erreur de numéro",
  "Demande annulée par le client",
];

const selectClass =
  "mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-brand-500 focus:outline-none";

interface DialogProps {
  call: Call | null;
  onClose: () => void;
}

/** Refus de la demande / classement en non qualifié, avec SMS optionnel au client. */
export function DisqualifyDialog({ call, onClose }: DialogProps) {
  const [reason, setReason] = useState(REASONS[0]);
  const [notify, setNotify] = useState(true);
  const { state } = useAstio();
  const smsOn = state.settings.handling.smsOnDecision;

  return (
    <ConfirmDialog
      open={call !== null}
      onClose={onClose}
      title="Refuser la demande ?"
      description="Le dossier est classé non qualifié. La transcription et l'historique restent consultables."
      confirmLabel="Refuser la demande"
      danger
      onConfirm={() => call && disqualify(call, reason, smsOn && notify)}
    >
      <div className="space-y-3">
        <label className="block text-xs font-medium text-ink-soft">
          Motif
          <select value={reason} onChange={(e) => setReason(e.target.value)} className={selectClass}>
            {REASONS.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </label>
        {smsOn && (
          <label className="flex items-center gap-2 text-[13px] text-ink">
            <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} className="accent-brand-600" />
            Prévenir le client par SMS (simulé)
          </label>
        )}
      </div>
    </ConfirmDialog>
  );
}

/** Annulation d'un rendez-vous confirmé ; le client est prévenu par SMS (simulé). */
export function CancelAppointmentDialog({
  call,
  onClose,
  status = "a_traiter",
  afterCancel,
}: DialogProps & { status?: "a_traiter" | "a_confirmer"; afterCancel?: () => void }) {
  const { state, now } = useAstio();
  const appt = call?.appointmentId ? state.appointments.find((a) => a.id === call.appointmentId) : undefined;
  return (
    <ConfirmDialog
      open={call !== null}
      onClose={onClose}
      title="Annuler le rendez-vous ?"
      description={
        appt
          ? `Le rendez-vous du ${formatDayTime(appt.start, now).toLowerCase()} sera annulé et le client prévenu par SMS (simulé). Le dossier repasse à traiter.`
          : "Le rendez-vous sera annulé."
      }
      confirmLabel="Annuler le rendez-vous"
      danger
      onConfirm={() => {
        if (!call) return;
        cancelAppointment(call, status);
        afterCancel?.();
      }}
    />
  );
}

/** Choix et confirmation d'un créneau (utilisé notamment par le glisser-déposer du Kanban). */
export function ConfirmSlotDialog({ call, onClose }: DialogProps) {
  const { state, now } = useAstio();
  const client = call ? state.clients.find((c) => c.id === call.clientId) : undefined;
  return (
    <Modal open={call !== null} onClose={onClose} title={`Confirmer un créneau pour ${client?.name ?? "ce client"}`} description={call?.motif}>
      {call && (
        <SlotPicker
          astioSlots={call.proposedSlots.filter((s) => new Date(s.start).getTime() > now)}
          otherSlots={suggestSlots(state, {
            durationMin: call.estimatedDurationMin || state.settings.hours.defaultDurationMin,
            now,
            excludeAppointmentId: call.appointmentId,
          })}
          now={now}
          submitLabel="Confirmer et prévenir le client"
          onCancel={onClose}
          onSubmit={(slot) => {
            confirmSlot(call, slot, now);
            onClose();
          }}
        />
      )}
    </Modal>
  );
}
