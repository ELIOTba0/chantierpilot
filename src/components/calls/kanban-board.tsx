"use client";

import { useState } from "react";
import type { Appointment, Call, CallStatus, Client } from "@/lib/types";
import { CALL_STATUS, CALL_STATUS_ORDER } from "@/lib/labels";
import { suggestedSlot } from "@/lib/selectors";
import { cn } from "@/lib/cn";
import { TONE_CLASSES } from "@/components/ui/badge";
import { CallCard } from "./call-card";

interface KanbanBoardProps {
  calls: Call[];
  statuses: CallStatus[];
  clients: Map<string, Client>;
  appointments: Map<string, Appointment>;
  now: number;
  selectedId: string | null;
  onOpen: (id: string) => void;
  /** Déplacement d'une carte vers une autre colonne (glisser-déposer). */
  onMove: (call: Call, status: CallStatus) => void;
}

/** Le glisser-déposer n'est proposé qu'avec un pointeur précis (souris, trackpad). */
function canDrag() {
  return window.matchMedia("(pointer: fine)").matches;
}

/**
 * Colonnes par statut de traitement. Sur ordinateur, les cartes se déplacent
 * d'une colonne à l'autre ; sur petit écran, défilement horizontal et
 * changement de statut depuis le panneau de détail.
 */
export function KanbanBoard({ calls, statuses, clients, appointments, now, selectedId, onOpen, onMove }: KanbanBoardProps) {
  const columns = CALL_STATUS_ORDER.filter((s) => statuses.length === 0 || statuses.includes(s));
  const [dragEnabled] = useState(canDrag);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overStatus, setOverStatus] = useState<CallStatus | null>(null);
  const dragging = calls.find((c) => c.id === draggingId);
  const apptList = [...appointments.values()];

  const endDrag = () => {
    setDraggingId(null);
    setOverStatus(null);
  };

  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      {dragEnabled && (
        <p className="mb-2 text-xs text-ink-muted">Faites glisser une carte vers une autre colonne pour changer son statut.</p>
      )}
      <div className="flex snap-x snap-mandatory gap-4 lg:snap-none">
        {columns.map((status) => {
          const items = calls.filter((c) => c.status === status);
          const isTarget = dragging !== undefined && dragging.status !== status;
          return (
            <section
              key={status}
              aria-labelledby={`col-${status}`}
              onDragOver={(e) => {
                if (!isTarget) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                if (overStatus !== status) setOverStatus(status);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOverStatus(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (dragging && isTarget) onMove(dragging, status);
                endDrag();
              }}
              className={cn(
                "flex w-[82vw] max-w-[320px] shrink-0 snap-start flex-col rounded-xl bg-stone-100/70 p-2 transition sm:w-72 xl:w-auto xl:max-w-none xl:min-w-52 xl:flex-1",
                isTarget && "ring-1 ring-line-strong ring-inset",
                overStatus === status && isTarget && "bg-brand-50 ring-2 ring-brand-400",
              )}
            >
              <header className="flex items-center gap-2 px-1.5 pt-1 pb-2.5">
                <span aria-hidden className={cn("size-2 rounded-full", TONE_CLASSES[CALL_STATUS[status].tone].dot)} />
                <h2 id={`col-${status}`} className="text-[13px] font-semibold text-ink">
                  {CALL_STATUS[status].label}
                </h2>
                <span className="ml-auto rounded-md bg-surface px-1.5 text-xs font-medium text-ink-soft tabular-nums ring-1 ring-line">
                  {items.length}
                </span>
              </header>
              {items.length === 0 ? (
                <p className="rounded-lg border border-dashed border-line-strong px-3 py-6 text-center text-xs text-ink-muted">
                  {isTarget ? "Déposer ici" : "Aucun dossier"}
                </p>
              ) : (
                <ul className="space-y-2">
                  {items.map((call) => (
                    <li key={call.id}>
                      <CallCard
                        call={call}
                        client={clients.get(call.clientId)}
                        appt={call.appointmentId ? appointments.get(call.appointmentId) : undefined}
                        suggestion={call.status === "a_confirmer" ? suggestedSlot(call, now, apptList) : undefined}
                        now={now}
                        selected={call.id === selectedId}
                        onOpen={() => onOpen(call.id)}
                        draggable={dragEnabled}
                        dragging={call.id === draggingId}
                        onDragStart={() => setDraggingId(call.id)}
                        onDragEnd={endDrag}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
