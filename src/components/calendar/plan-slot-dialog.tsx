"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarCheck2 } from "lucide-react";
import type { Call, SlotProposal } from "@/lib/types";
import type { FreeBlock } from "@/lib/slots";
import { DECISION_KIND } from "@/lib/labels";
import { formatDuration, formatLongDay } from "@/lib/format";
import { useAstio } from "@/lib/app-context";
import { callsToPlan, clientMap } from "@/lib/selectors";
import { cn } from "@/lib/cn";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { PriorityBadge } from "@/components/calls/badges";
import { confirmSlot } from "@/components/calls/call-actions";

export interface FreeSlotTarget {
  day: Date;
  startMin: number;
  block: FreeBlock;
}

const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

/** Propose une plage libre du planning à un appel en attente de rendez-vous. */
export function PlanSlotDialog({ target, onClose }: { target: FreeSlotTarget | null; onClose: () => void }) {
  return (
    <Modal
      open={target !== null}
      onClose={onClose}
      title="Planifier sur cette plage"
      description={target ? `${formatLongDay(target.day)} · libre de ${hhmm(target.block.start)} à ${hhmm(target.block.end)}` : undefined}
    >
      {target && <PlanSlotForm key={`${target.day.toISOString()}-${target.startMin}`} target={target} onDone={onClose} />}
    </Modal>
  );
}

function PlanSlotForm({ target, onDone }: { target: FreeSlotTarget; onDone: () => void }) {
  const { state, now } = useAstio();
  const clients = clientMap(state);
  // Appels qui attendent un rendez-vous (y compris une demande de report).
  const candidates = callsToPlan(state);
  const [start, setStart] = useState(target.startMin);
  const [callId, setCallId] = useState<string | null>(candidates[0]?.id ?? null);

  const starts: number[] = [];
  for (let m = target.block.start; m + 30 <= target.block.end; m += 30) starts.push(m);

  const durationOf = (c: Call) => c.estimatedDurationMin || state.settings.hours.defaultDurationMin;
  const call = candidates.find((c) => c.id === callId);
  const fits = (c: Call) => start + durationOf(c) <= target.block.end;

  if (candidates.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-6 text-center">
        <CalendarCheck2 aria-hidden className="size-6 text-emerald-600" />
        <p className="text-sm font-medium">Aucun appel en attente de créneau</p>
        <p className="text-[13px] text-ink-muted">Tous les appels qui nécessitent un rendez-vous ont déjà un créneau confirmé.</p>
      </div>
    );
  }

  const submit = () => {
    if (!call) return;
    const day = new Date(target.day);
    day.setHours(0, start, 0, 0);
    const slotStart = day.toISOString();
    const slot: SlotProposal = {
      start: slotStart,
      end: new Date(day.getTime() + durationOf(call) * 60_000).toISOString(),
      availability: fits(call) ? "libre" : "serre",
      note: fits(call) ? undefined : "Dépasse la plage libre",
    };
    confirmSlot(call, slot, now);
    onDone();
  };

  return (
    <div className="space-y-4">
      <label className="block text-xs font-medium text-ink-soft">
        Heure de début
        <select
          value={start}
          onChange={(e) => setStart(Number(e.target.value))}
          className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-brand-500 focus:outline-none"
        >
          {starts.map((m) => (
            <option key={m} value={m}>
              {hhmm(m)}
            </option>
          ))}
        </select>
      </label>

      <fieldset>
        <legend className="mb-2 text-xs font-medium text-ink-soft">Appel à planifier</legend>
        <div className="space-y-2">
          {candidates.map((c) => {
            const checked = c.id === callId;
            const ok = fits(c);
            return (
              <label
                key={c.id}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5",
                  checked ? "border-brand-500 bg-brand-50/60 ring-1 ring-brand-500" : "border-line hover:border-line-strong",
                )}
              >
                <input type="radio" name="call" checked={checked} onChange={() => setCallId(c.id)} className="mt-1 accent-brand-600" />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-ink">{clients.get(c.clientId)?.name}</span>
                    {(c.priority === "urgente" || c.priority === "haute") && <PriorityBadge priority={c.priority} />}
                  </span>
                  <span className="block text-[13px] text-ink-soft">{c.motif}</span>
                  <span className="mt-0.5 block text-xs text-ink-muted">
                    Durée estimée {formatDuration(durationOf(c))}
                    {c.decision && ` · ${DECISION_KIND[c.decision.kind].label}`}
                  </span>
                  {!ok && (
                    <span className="mt-1 block text-xs font-medium text-amber-800">
                      Dépasse la plage libre de {formatDuration(start + durationOf(c) - target.block.end)}
                    </span>
                  )}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <p className="text-[11px] leading-relaxed text-ink-muted">
        Le rendez-vous sera confirmé et Astio préviendra le client par SMS (simulé). Disponibilité simulée, aucun
        agenda externe n&apos;est vérifié.
      </p>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4">
        {call ? (
          <Link href={`/appels?appel=${call.id}`} className="text-[13px] font-medium text-ink-soft hover:text-ink hover:underline">
            Voir le dossier
          </Link>
        ) : (
          <span />
        )}
        <Button variant="primary" size="sm" disabled={!call} onClick={submit}>
          Confirmer {hhmm(start)} et prévenir le client
        </Button>
      </div>
    </div>
  );
}
