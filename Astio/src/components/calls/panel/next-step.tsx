"use client";

import type { ReactNode } from "react";
import { CalendarClock, CheckCircle2, MessageSquareText, Phone, Sparkles } from "lucide-react";
import type { Appointment, Call, Client, SlotProposal } from "@/lib/types";
import { DECISION_KIND } from "@/lib/labels";
import { formatDuration, formatPhone, formatRelativeDay, formatTimeRange } from "@/lib/format";
import { confirmationSms, rescheduleSms } from "@/lib/messages";
import { suggestedSlot } from "@/lib/selectors";
import { useAstio } from "@/lib/app-context";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { changeStatus, completeCall, confirmSlot, resolveDecision } from "../call-actions";

export type PanelMode = "view" | "pick" | "edit";

interface NextStepProps {
  call: Call;
  client: Client | undefined;
  appt: Appointment | undefined;
  now: number;
  onMode: (mode: PanelMode) => void;
  onDisqualify: () => void;
  onCancelAppointment: () => void;
}

function CallButton({ client, primary }: { client: Client; primary?: boolean }) {
  return (
    <a
      href={`tel:${client.phone}`}
      className={
        primary
          ? "inline-flex h-8 items-center gap-1.5 rounded-full bg-brand-500 px-3.5 text-[13px] font-medium text-ink hover:bg-brand-400"
          : "inline-flex h-8 items-center gap-1.5 rounded-full bg-black/[0.05] px-3.5 text-[13px] font-medium text-ink hover:bg-black/[0.08]"
      }
    >
      <Phone aria-hidden className="size-3.5" />
      Appeler le {formatPhone(client.phone)}
    </a>
  );
}

/** Créneau suggéré par Astio et aperçu du SMS qui sera envoyé si le professionnel dit oui. */
export function SuggestedSlotCard({ slot, sms, now }: { slot: SlotProposal; sms: string | null; now: number }) {
  const minutes = Math.round((new Date(slot.end).getTime() - new Date(slot.start).getTime()) / 60_000);
  return (
    <div className="mt-3 rounded-lg border border-line bg-surface p-3">
      <p className="flex items-center gap-1.5 text-xs font-medium text-ink-muted">
        <CalendarClock aria-hidden className="size-3.5" />
        Créneau suggéré par Astio
      </p>
      <p className="mt-1 flex flex-wrap items-baseline gap-x-2 text-sm">
        <span className="font-semibold text-ink">{formatRelativeDay(slot.start, now)}</span>
        <span className="text-ink tabular-nums">{formatTimeRange(slot.start, slot.end)}</span>
        <span className="text-xs text-ink-muted">{formatDuration(minutes)}</span>
        <span
          className={cn(
            "rounded px-1.5 py-0.5 text-[11px] font-medium",
            slot.availability === "libre" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800",
          )}
        >
          {slot.availability === "libre" ? "Libre" : "Marge réduite"}
        </span>
      </p>
      {slot.note && <p className="mt-0.5 text-xs text-ink-soft">{slot.note}</p>}
      {sms && (
        <details className="group mt-2.5">
          <summary className="flex cursor-pointer list-none items-center gap-1.5 text-xs font-medium text-ink-soft hover:text-ink">
            <MessageSquareText aria-hidden className="size-3.5" />
            Aperçu du SMS envoyé au client si vous confirmez
          </summary>
          <p className="mt-1.5 rounded-lg rounded-tl-sm bg-canvas px-3 py-2 text-[13px] leading-relaxed text-ink">{sms}</p>
        </details>
      )}
    </div>
  );
}

/**
 * Bloc « prochaine étape ». Astio ne fixe jamais de rendez-vous : il suggère un
 * créneau d'après les disponibilités du client, et le professionnel répond oui ou non.
 */
export function NextStep({ call, client, appt, now, onMode, onDisqualify, onCancelAppointment }: NextStepProps) {
  const { state } = useAstio();
  const decision = call.decision;
  const slot = call.status === "a_confirmer" || decision ? suggestedSlot(call, now, state.appointments) : undefined;
  const name = client?.name ?? "";
  const smsOn = state.settings.handling.smsOnDecision;
  const moving = appt?.state === "confirme";
  const sms =
    slot && smsOn
      ? moving
        ? rescheduleSms(name, slot.start, slot.end, state.settings.profile)
        : confirmationSms(name, slot.start, slot.end, state.settings.profile)
      : null;

  // Réponse oui / non sur le créneau suggéré.
  const yesNo = slot && (
    <>
      <Button variant="primary" size="sm" onClick={() => confirmSlot(call, slot, now)}>
        {decision?.kind === "verifier_urgence" ? "Oui, urgence vérifiée : confirmer" : "Oui, confirmer"}
      </Button>
      <Button size="sm" onClick={() => onMode("pick")}>
        Non, autre créneau
      </Button>
    </>
  );

  if (decision) {
    let actions: ReactNode = null;
    switch (decision.kind) {
      case "verifier_urgence":
      case "confirmer_creneau":
      case "choisir_creneau":
        actions = yesNo ?? (
          <Button variant="primary" size="sm" onClick={() => onMode("pick")}>
            Choisir un créneau
          </Button>
        );
        break;
      case "rappeler":
        actions = client && (
          <>
            <CallButton client={client} primary />
            <Button size="sm" onClick={() => resolveDecision(call, "Client rappelé par le professionnel", "Rappel enregistré")}>
              Marquer comme rappelé
            </Button>
          </>
        );
        break;
      case "completer_infos":
        actions = (
          <>
            {client && <CallButton client={client} primary />}
            <Button size="sm" onClick={() => onMode("edit")}>
              Compléter les informations
            </Button>
          </>
        );
        break;
      case "hors_prestations":
        actions = (
          <>
            <Button
              variant="primary"
              size="sm"
              onClick={() => resolveDecision(call, "Demande acceptée malgré le hors prestations", "Demande conservée à traiter")}
            >
              Oui, donner suite
            </Button>
            <Button size="sm" onClick={onDisqualify}>
              Non, refuser la demande
            </Button>
          </>
        );
        break;
    }

    return (
      <div className="rounded-xl border border-brand-200 bg-brand-50/60 p-4">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-brand-800">
          <Sparkles aria-hidden className="size-3.5" />
          Astio a besoin de vous · {DECISION_KIND[decision.kind].label}
        </p>
        <p className="mt-1.5 text-[13px] leading-relaxed text-ink">{decision.reason}</p>
        {slot && <SuggestedSlotCard slot={slot} sms={sms} now={now} />}
        <div className="mt-3 flex flex-wrap gap-2">{actions}</div>
      </div>
    );
  }

  // Pas de décision requise : action principale selon le statut et le rendez-vous.
  let message: ReactNode;
  let actions: ReactNode;
  if (call.status === "termine" || call.status === "non_qualifie") {
    message = call.status === "termine" ? "Dossier terminé." : "Dossier classé non qualifié.";
    actions = (
      <Button size="sm" onClick={() => changeStatus(call, "a_traiter")}>
        Rouvrir le dossier
      </Button>
    );
  } else if (slot) {
    message = "Astio attend votre réponse sur ce créneau.";
    actions = yesNo;
  } else if (appt?.state === "confirme") {
    const started = new Date(appt.start).getTime() <= now;
    message = started ? "Intervention prévue : pensez à clôturer le dossier." : "Rendez-vous confirmé, le client a été prévenu.";
    actions = (
      <>
        {started && (
          <Button variant="primary" size="sm" onClick={() => completeCall(call)}>
            Marquer comme terminé
          </Button>
        )}
        <Button size="sm" onClick={() => onMode("pick")}>
          Reprogrammer
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancelAppointment}>
          Annuler le rendez-vous
        </Button>
      </>
    );
  } else {
    message = "Aucun rendez-vous n'est encore prévu.";
    actions = (
      <>
        <Button variant="primary" size="sm" onClick={() => onMode("pick")}>
          Choisir un créneau
        </Button>
        <Button size="sm" onClick={() => completeCall(call)}>
          Terminer sans rendez-vous
        </Button>
      </>
    );
  }

  return (
    <div className="rounded-xl border border-line bg-canvas p-4">
      <p className="flex items-center gap-1.5 text-[13px] text-ink-soft">
        <CheckCircle2 aria-hidden className="size-4 text-emerald-600" />
        {message}
      </p>
      {slot && <SuggestedSlotCard slot={slot} sms={sms} now={now} />}
      <div className="mt-3 flex flex-wrap gap-2">{actions}</div>
    </div>
  );
}
