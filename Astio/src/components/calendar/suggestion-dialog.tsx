"use client";

import { useState } from "react";
import type { Call, SlotProposal } from "@/lib/types";
import { DECISION_KIND } from "@/lib/labels";
import { confirmationSms, rescheduleSms } from "@/lib/messages";
import { useAstio } from "@/lib/app-context";
import { Modal } from "@/components/ui/modal";
import { Button, ButtonLink } from "@/components/ui/button";
import { confirmSlot } from "@/components/calls/call-actions";
import { ConfirmSlotDialog } from "@/components/calls/call-dialogs";
import { SuggestedSlotCard } from "@/components/calls/panel/next-step";

interface SuggestionDialogProps {
  suggestion: { call: Call; slot: SlotProposal } | null;
  onClose: () => void;
}

/** Réponse oui / non à un créneau suggéré par Astio, depuis le calendrier. */
export function SuggestionDialog({ suggestion, onClose }: SuggestionDialogProps) {
  const { state, now } = useAstio();
  const [otherFor, setOtherFor] = useState<Call | null>(null);
  const call = suggestion?.call;
  const client = call ? state.clients.find((c) => c.id === call.clientId) : undefined;
  const moving = call?.appointmentId
    ? state.appointments.find((a) => a.id === call.appointmentId)?.state === "confirme"
    : false;
  const sms =
    suggestion && state.settings.handling.smsOnDecision
      ? (moving ? rescheduleSms : confirmationSms)(client?.name ?? "", suggestion.slot.start, suggestion.slot.end, state.settings.profile)
      : null;

  return (
    <>
      <Modal
        open={suggestion !== null}
        onClose={onClose}
        title={client?.name ?? "Créneau suggéré"}
        description={call?.motif}
        footer={
          suggestion && (
            <>
              <ButtonLink href={`/appels?appel=${suggestion.call.id}`} variant="ghost" size="sm" className="mr-auto">
                Voir le dossier
              </ButtonLink>
              <Button
                size="sm"
                onClick={() => {
                  setOtherFor(suggestion.call);
                  onClose();
                }}
              >
                Non, autre créneau
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  confirmSlot(suggestion.call, suggestion.slot, now);
                  onClose();
                }}
              >
                Oui, confirmer
              </Button>
            </>
          )
        }
      >
        {suggestion && (
          <div>
            {suggestion.call.decision && (
              <p className="text-[13px] leading-relaxed text-ink-soft">
                <span className="font-medium text-ink">{DECISION_KIND[suggestion.call.decision.kind].label} · </span>
                {suggestion.call.decision.reason}
              </p>
            )}
            <SuggestedSlotCard slot={suggestion.slot} sms={sms} now={now} />
          </div>
        )}
      </Modal>
      <ConfirmSlotDialog call={otherFor} onClose={() => setOtherFor(null)} />
    </>
  );
}
