"use client";

import { useState } from "react";
import { Check, Circle, Pencil, Phone, X } from "lucide-react";
import type { Appointment, Call, CallStatus, Client } from "@/lib/types";
import { formatCallDuration, formatDayTime, formatPhone } from "@/lib/format";
import { useAstio } from "@/lib/app-context";
import { suggestSlots } from "@/lib/slots";
import { SideSheet } from "@/components/ui/side-sheet";
import { PriorityBadge, StatusBadge } from "./badges";
import { confirmSlot, rescheduleAppointment } from "./call-actions";
import { CancelAppointmentDialog, DisqualifyDialog } from "./call-dialogs";
import { PanelSection } from "./panel/section";
import { RequestSummary } from "./panel/request-summary";
import { AppointmentStatus } from "./panel/appointment-status";
import { SlotPicker } from "./panel/slot-picker";
import { Transcript } from "./panel/transcript";
import { HistoryTimeline } from "./panel/history-timeline";
import { EditCallForm } from "./panel/edit-call-form";
import { NextStep, type PanelMode } from "./panel/next-step";
import { MoreActions } from "./panel/more-actions";

interface CallPanelProps {
  call: Call | undefined;
  onClose: () => void;
  onMove: (call: Call, status: CallStatus) => void;
}

/** Panneau latéral de détail d'un appel, ouvert sans quitter la page. */
export function CallPanel({ call, onClose, onMove }: CallPanelProps) {
  return (
    <SideSheet open={Boolean(call)} onClose={onClose} labelledBy="call-panel-title">
      {call && <PanelContent key={call.id} call={call} onClose={onClose} onMove={onMove} />}
    </SideSheet>
  );
}

function PanelContent({ call, onClose, onMove }: { call: Call; onClose: () => void; onMove: CallPanelProps["onMove"] }) {
  const { state, now } = useAstio();
  const client: Client | undefined = state.clients.find((c) => c.id === call.clientId);
  const appt: Appointment | undefined = call.appointmentId
    ? state.appointments.find((a) => a.id === call.appointmentId)
    : undefined;

  const [mode, setMode] = useState<PanelMode>("view");
  const [disqualifyOpen, setDisqualifyOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  // Un rendez-vous confirmé se reprogramme ; sinon le créneau choisi est confirmé.
  const rescheduling = call.status === "rdv_confirme" && appt?.state === "confirme";

  // Ouvrir le choix de créneau amène la section Rendez-vous à l'écran.
  const changeMode = (next: PanelMode) => {
    setMode(next);
    if (next === "pick") {
      requestAnimationFrame(() => document.getElementById("panel-rdv")?.scrollIntoView({ behavior: "smooth", block: "start" }));
    }
  };

  const clientName = client?.name ?? "Client inconnu";
  const astioSlots = call.proposedSlots.filter((s) => new Date(s.start).getTime() > now);
  const otherSlots =
    mode === "pick"
      ? suggestSlots(state, {
          durationMin: call.estimatedDurationMin || state.settings.hours.defaultDurationMin,
          now,
          excludeAppointmentId: call.appointmentId,
        })
      : [];

  const doneSteps = call.agentSteps.filter((s) => s.done).length;

  return (
    <>
      {/* En-tête */}
      <header className="border-b border-line px-5 pt-5 pb-4 sm:px-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-ink-muted">
              Dossier {call.id} · {formatDayTime(call.receivedAt, now)} · {formatCallDuration(call.durationSec)}
            </p>
            <h2 id="call-panel-title" className="mt-1 truncate text-xl font-semibold tracking-tight text-ink">
              {clientName}
            </h2>
            {client && (
              <a
                href={`tel:${client.phone}`}
                className="mt-0.5 inline-flex items-center gap-1.5 text-sm text-ink-soft tabular-nums hover:text-ink hover:underline"
              >
                <Phone aria-hidden className="size-3.5" />
                {formatPhone(client.phone)}
              </a>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="-mr-1 rounded-lg p-1.5 text-ink-muted hover:bg-stone-100 hover:text-ink"
            aria-label="Fermer le panneau"
          >
            <X className="size-5" />
          </button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <StatusBadge status={call.status} />
          <PriorityBadge priority={call.priority} />
        </div>
      </header>

      {/* Contenu défilant */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="px-5 py-5 sm:px-6">
          <NextStep
            call={call}
            client={client}
            appt={appt}
            now={now}
            onMode={changeMode}
            onDisqualify={() => setDisqualifyOpen(true)}
            onCancelAppointment={() => setCancelOpen(true)}
          />
        </div>

        {(appt || mode === "pick") && (
          <PanelSection title="Rendez-vous" id="panel-rdv">
            <div className="space-y-4">
              {appt && <AppointmentStatus appt={appt} now={now} />}
              {mode === "pick" && (
                <SlotPicker
                  astioSlots={astioSlots}
                  otherSlots={otherSlots}
                  now={now}
                  submitLabel={rescheduling ? "Reprogrammer et prévenir le client" : "Confirmer et prévenir le client"}
                  onSubmit={(slot) => {
                    if (rescheduling && appt) rescheduleAppointment(appt, slot, now);
                    else confirmSlot(call, slot, now);
                    setMode("view");
                  }}
                  onCancel={() => setMode("view")}
                />
              )}
            </div>
          </PanelSection>
        )}

        <PanelSection
          title="Résumé de la demande"
          id="panel-summary"
          action={
            mode !== "edit" && (
              <button
                type="button"
                onClick={() => setMode("edit")}
                className="inline-flex items-center gap-1 text-xs font-medium text-ink-soft hover:text-ink"
              >
                <Pencil aria-hidden className="size-3" />
                Modifier
              </button>
            )
          }
        >
          {mode === "edit" ? <EditCallForm call={call} onDone={() => setMode("view")} /> : <RequestSummary call={call} />}
        </PanelSection>

        <PanelSection title={`Ce qu'Astio a fait · ${doneSteps}/${call.agentSteps.length}`} id="panel-agent">
          <ul className="space-y-2">
            {call.agentSteps.map((s) => (
              <li key={s.label} className="flex items-start gap-2.5 text-[13px]">
                {s.done ? (
                  <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                    <Check aria-hidden className="size-2.5" strokeWidth={3.5} />
                  </span>
                ) : (
                  <Circle aria-hidden className="mt-0.5 size-4 shrink-0 text-brand-600" strokeDasharray="3 3" />
                )}
                <span className={s.done ? "text-ink-soft" : "font-medium text-ink"}>{s.label}</span>
                <span className="sr-only">{s.done ? "(fait)" : "(en attente de votre part)"}</span>
              </li>
            ))}
          </ul>
        </PanelSection>

        <Transcript lines={call.transcript} clientName={clientName} durationSec={call.durationSec} />

        <PanelSection title="Historique" id="panel-history">
          <HistoryTimeline events={call.history} now={now} />
        </PanelSection>
      </div>

      {/* Pied : actions secondaires */}
      <footer className="flex items-center justify-between gap-2 border-t border-line bg-canvas px-5 py-3 sm:px-6">
        <p className="text-[11px] text-ink-muted">Simulation : les SMS au client ne sont pas réellement envoyés.</p>
        <MoreActions call={call} onEdit={() => setMode("edit")} onMove={onMove} />
      </footer>

      <DisqualifyDialog call={disqualifyOpen ? call : null} onClose={() => setDisqualifyOpen(false)} />
      <CancelAppointmentDialog call={cancelOpen ? call : null} onClose={() => setCancelOpen(false)} />
    </>
  );
}
