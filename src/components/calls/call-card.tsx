"use client";

import { CalendarClock, Sparkles } from "lucide-react";
import type { Appointment, Call, Client, SlotProposal } from "@/lib/types";
import { APPOINTMENT_STATE, CALL_STATUS, DECISION_KIND, PRIORITY } from "@/lib/labels";
import { formatDayTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import { TONE_CLASSES } from "@/components/ui/badge";
import { EVENT_STYLE } from "@/components/calendar/event-style";
import { PriorityBadge } from "./badges";

interface CallCardProps {
  /** Créneau suggéré par Astio, en attente du « oui » du professionnel. */
  suggestion?: SlotProposal;
  call: Call;
  client: Client | undefined;
  appt: Appointment | undefined;
  now: number;
  selected: boolean;
  onOpen: () => void;
  /** Glisser-déposer actif (ordinateur uniquement). */
  draggable?: boolean;
  dragging?: boolean;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}

/**
 * Carte compacte du Kanban. Le statut est porté par la colonne ; seules les
 * priorités hautes et urgentes affichent un badge pour limiter le bruit visuel.
 */
export function CallCard({
  call,
  client,
  appt,
  suggestion,
  now,
  selected,
  onOpen,
  draggable = false,
  dragging = false,
  onDragStart,
  onDragEnd,
}: CallCardProps) {
  const showPriority = call.priority === "urgente" || call.priority === "haute";

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      draggable={draggable}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", call.id);
        onDragStart?.();
      }}
      onDragEnd={onDragEnd}
      aria-current={selected ? "true" : undefined}
      className={cn(
        "group relative w-full overflow-hidden rounded-lg border bg-surface p-3 text-left shadow-(--shadow-card) transition hover:border-line-strong hover:shadow-sm",
        selected ? "border-brand-500 ring-2 ring-brand-200" : "border-line",
        draggable && "cursor-grab active:cursor-grabbing",
        dragging && "opacity-40",
      )}
    >
      {call.priority === "urgente" && (
        <span aria-hidden className={cn("absolute inset-y-0 left-0 w-[3px]", TONE_CLASSES.urgent.rail)} />
      )}

      <p className="truncate text-sm font-semibold text-ink">{client?.name ?? "Client inconnu"}</p>
      <p className="text-[11px] text-ink-muted tabular-nums">{formatDayTime(call.receivedAt, now)}</p>

      <p className="mt-2 text-[13px] font-medium text-ink">{call.motif}</p>
      <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-ink-soft">{call.summary}</p>

      {(appt || suggestion || call.decision || showPriority) && (
        <div className="mt-2.5 space-y-1.5 border-t border-line pt-2.5">
          {showPriority && <PriorityBadge priority={call.priority} />}
          {suggestion && (
            <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-ink-soft">
              <CalendarClock aria-hidden className="size-3.5 shrink-0 text-sky-600" />
              <span className="tabular-nums">{formatDayTime(suggestion.start, now)}</span>
              <span className="text-sky-700">· suggéré</span>
            </p>
          )}
          {appt && !suggestion && (
            <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-ink-soft">
              <CalendarClock aria-hidden className="size-3.5 shrink-0 text-ink-muted" />
              <span className="tabular-nums">{formatDayTime(appt.start, now)}</span>
              <span className="flex items-center gap-1">
                <span aria-hidden className={cn("size-1.5 rounded-full", EVENT_STYLE[appt.state].dot)} />
                {APPOINTMENT_STATE[appt.state].short}
              </span>
            </p>
          )}
          {call.decision && (
            <p className="flex items-center gap-1.5 text-xs font-medium text-brand-800">
              <Sparkles aria-hidden className="size-3.5 shrink-0" />
              <span className="truncate">{DECISION_KIND[call.decision.kind].label}</span>
            </p>
          )}
        </div>
      )}

      <span className="sr-only">
        Statut : {CALL_STATUS[call.status].label}. Priorité : {PRIORITY[call.priority].label}.
      </span>
    </div>
  );
}
