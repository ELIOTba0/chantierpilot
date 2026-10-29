"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarCheck2, Clock3, X } from "lucide-react";
import type { Call, SlotProposal } from "@/lib/types";
import { DECISION_KIND } from "@/lib/labels";
import { formatDayTime, formatDuration, formatRelativeDay, formatTime } from "@/lib/format";
import { useAstio } from "@/lib/app-context";
import { appointmentMap, callsToPlan, clientMap, suggestedSlot } from "@/lib/selectors";
import { suggestSlots } from "@/lib/slots";
import { cn } from "@/lib/cn";
import { SideSheet } from "@/components/ui/side-sheet";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PriorityBadge } from "@/components/calls/badges";
import { confirmSlot } from "@/components/calls/call-actions";
import { ConfirmSlotDialog } from "@/components/calls/call-dialogs";

interface ToPlanSheetProps {
  open: boolean;
  onClose: () => void;
  /** Amène le calendrier sur la date d'un créneau. */
  onFocusDate: (iso: string) => void;
}

function Availability({ slot }: { slot: SlotProposal }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium",
        slot.availability === "libre" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800",
      )}
    >
      {slot.availability === "libre" ? "Libre" : "Marge réduite"}
    </span>
  );
}

/**
 * Appels qui attendent un rendez-vous. Astio suggère un créneau d'après les
 * disponibilités du client ; le professionnel répond oui ou non.
 */
export function ToPlanSheet({ open, onClose, onFocusDate }: ToPlanSheetProps) {
  const { state, now } = useAstio();
  const [otherFor, setOtherFor] = useState<Call | null>(null);
  const clients = clientMap(state);
  const appts = appointmentMap(state);
  const calls = callsToPlan(state);

  const durationOf = (c: Call) => c.estimatedDurationMin || state.settings.hours.defaultDurationMin;
  const confirm = (call: Call, slot: SlotProposal) => {
    confirmSlot(call, slot, now);
    onFocusDate(slot.start);
  };

  return (
    <SideSheet open={open} onClose={onClose} labelledBy="to-plan-title">
      <header className="flex items-start justify-between gap-3 border-b border-line px-5 pt-5 pb-4 sm:px-6">
        <div>
          <h2 id="to-plan-title" className="text-xl font-semibold tracking-tight text-ink">
            À planifier
          </h2>
          <p className="mt-0.5 text-sm text-ink-soft">
            {calls.length ? `${calls.length} appel${calls.length > 1 ? "s" : ""} attendent votre réponse` : "Rien en attente"}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="-mr-1 rounded-full p-1.5 text-ink-muted hover:bg-stone-100 hover:text-ink"
          aria-label="Fermer"
        >
          <X className="size-5" />
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">
      {calls.length === 0 ? (
        <EmptyState icon={<CalendarCheck2 className="size-5" />} title="Tout est planifié" description="Chaque demande a un rendez-vous confirmé ou n'en nécessite pas." />
      ) : (
        <ul className="divide-y divide-line">
          {calls.map((call) => {
            const current = call.appointmentId ? appts.get(call.appointmentId) : undefined;
            // Créneau suggéré par Astio ; à défaut (ou s'il est passé), le premier créneau libre du planning.
            const slot =
              suggestedSlot(call, now, state.appointments) ?? suggestSlots(state, { durationMin: durationOf(call), now, count: 1, excludeAppointmentId: call.appointmentId })[0];
            const fromAstio = slot !== undefined && call.proposedSlots.includes(slot);
            return (
              <li key={call.id} className="px-5 py-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link href={`/appels?appel=${call.id}`} className="text-sm font-semibold text-ink hover:underline">
                      {clients.get(call.clientId)?.name}
                    </Link>
                    <p className="truncate text-[13px] text-ink-soft">{call.motif}</p>
                  </div>
                  {(call.priority === "urgente" || call.priority === "haute") && <PriorityBadge priority={call.priority} />}
                </div>
                <p className="mt-1 flex flex-wrap items-center gap-1 text-xs text-ink-muted">
                  <Clock3 aria-hidden className="size-3" /> {formatDuration(durationOf(call))}
                  {call.decision && <span className="text-brand-800"> · {DECISION_KIND[call.decision.kind].label}</span>}
                </p>
                {current?.state === "confirme" && (
                  <p className="mt-1 text-xs text-ink-soft">Rendez-vous actuel : {formatDayTime(current.start, now)} · report demandé</p>
                )}

                {slot ? (
                  <div className="mt-2.5 rounded-lg border border-line p-2.5">
                    <p className="text-[11px] text-ink-muted">{fromAstio ? "Suggéré par Astio" : "Premier créneau libre"}</p>
                    <div className="mt-0.5 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onFocusDate(slot.start)}
                        className="min-w-0 flex-1 truncate text-left text-[13px] hover:underline"
                        aria-label={`Afficher le ${formatDayTime(slot.start, now)} dans le calendrier`}
                      >
                        <span className="font-medium text-ink">{formatRelativeDay(slot.start, now)}</span>{" "}
                        <span className="text-ink-soft tabular-nums">
                          {formatTime(slot.start)} – {formatTime(slot.end)}
                        </span>
                      </button>
                      <Availability slot={slot} />
                    </div>
                    {slot.note && <p className="mt-0.5 truncate text-[11px] text-ink-muted">{slot.note}</p>}
                    <div className="mt-2 flex gap-2">
                      <Button variant="primary" size="sm" onClick={() => confirm(call, slot)}>
                        Oui
                      </Button>
                      <Button size="sm" onClick={() => setOtherFor(call)}>
                        Non, autre créneau
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button size="sm" className="mt-2.5" onClick={() => setOtherFor(call)}>
                    Choisir un créneau
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      </div>
      <p className="border-t border-line px-5 py-3 text-xs leading-relaxed text-ink-muted sm:px-6">
        « Oui » confirme le rendez-vous et Astio prévient le client par SMS (simulé). Disponibilités calculées d&apos;après
        votre planning, sans vérification d&apos;agenda externe.
      </p>

      <ConfirmSlotDialog call={otherFor} onClose={() => setOtherFor(null)} />
    </SideSheet>
  );
}
