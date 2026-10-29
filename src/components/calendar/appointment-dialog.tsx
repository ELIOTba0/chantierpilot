"use client";

import { useState } from "react";
import { Clock3, History, Phone } from "lucide-react";
import type { Appointment } from "@/lib/types";
import { formatDayTime, formatDuration, formatPhone } from "@/lib/format";
import { useAstio } from "@/lib/app-context";
import { dispatch } from "@/lib/store";
import { suggestSlots } from "@/lib/slots";
import { Modal } from "@/components/ui/modal";
import { Button, ButtonLink } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { rescheduleAppointment } from "@/components/calls/call-actions";
import { AppointmentStatus } from "@/components/calls/panel/appointment-status";
import { SlotPicker } from "@/components/calls/panel/slot-picker";

interface AppointmentDialogProps {
  appt: Appointment | null;
  onClose: () => void;
}

/** Détail d'un rendez-vous sélectionné dans le calendrier, avec ses actions et la reprogrammation. */
export function AppointmentDialog({ appt, onClose }: AppointmentDialogProps) {
  const { state } = useAstio();
  const client = appt ? state.clients.find((c) => c.id === appt.clientId) : undefined;

  return (
    <Modal
      open={appt !== null}
      onClose={onClose}
      title={client?.name ?? "Rendez-vous"}
      description={appt?.motif}
      className="w-[min(32rem,calc(100vw-2rem))]"
    >
      {appt && <AppointmentDetail key={appt.id} appt={appt} />}
    </Modal>
  );
}

function AppointmentDetail({ appt }: { appt: Appointment }) {
  const { state, now } = useAstio();
  const [rescheduling, setRescheduling] = useState(false);
  const client = state.clients.find((c) => c.id === appt.clientId);
  const minutes = Math.round((new Date(appt.end).getTime() - new Date(appt.start).getTime()) / 60_000);
  const started = new Date(appt.start).getTime() <= now;

  const markDone = () => {
    dispatch({ type: "markDone", appointmentId: appt.id });
    toast("Intervention marquée comme réalisée");
  };

  if (rescheduling) {
    return (
      <div className="space-y-4">
        <p className="text-[13px] text-ink-soft">
          Actuellement : <span className="font-medium text-ink">{formatDayTime(appt.start, now)}</span> ({formatDuration(minutes)}).
          Astio préviendra le client du nouvel horaire par SMS (simulé).
        </p>
        <SlotPicker
          astioSlots={[]}
          otherSlots={suggestSlots(state, { durationMin: minutes, now, excludeAppointmentId: appt.id, count: 6, maxPerDay: 2 })}
          now={now}
          submitLabel="Reprogrammer et prévenir le client"
          onCancel={() => setRescheduling(false)}
          onSubmit={(slot) => {
            rescheduleAppointment(appt, slot, now);
            setRescheduling(false);
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <AppointmentStatus appt={appt} now={now} />

      <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-ink-soft">
        <span className="flex items-center gap-1.5">
          <Clock3 aria-hidden className="size-3.5 text-ink-muted" />
          Durée {formatDuration(minutes)}
        </span>
        {client && (
          <a href={`tel:${client.phone}`} className="flex items-center gap-1.5 tabular-nums hover:text-ink hover:underline">
            <Phone aria-hidden className="size-3.5 text-ink-muted" />
            {formatPhone(client.phone)}
          </a>
        )}
      </p>

      {appt.history && appt.history.length > 0 && (
        <div>
          <p className="mb-1.5 flex items-center gap-1.5 text-[13px] font-semibold text-ink">
            <History aria-hidden className="size-3.5" /> Historique
          </p>
          <ul className="space-y-1 text-[13px]">
            {[...appt.history].reverse().map((e) => (
              <li key={e.id} className="text-ink-soft">
                <span className="font-medium text-ink">{e.label}</span>
                {e.detail && ` · ${e.detail}`}
                <span className="text-xs text-ink-muted"> · {formatDayTime(e.at, now)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
        {appt.state === "confirme" && started && (
          <Button variant="primary" size="sm" onClick={markDone}>
            Marquer comme réalisé
          </Button>
        )}
        {appt.state === "confirme" && (
          <Button size="sm" onClick={() => setRescheduling(true)}>
            Reprogrammer
          </Button>
        )}
        <ButtonLink
          href={appt.callId ? `/appels?appel=${appt.callId}` : `/clients?client=${appt.clientId}`}
          variant="ghost"
          size="sm"
          className="ml-auto"
        >
          {appt.callId ? "Voir l'appel" : "Voir le client"}
        </ButtonLink>
      </div>
    </div>
  );
}
