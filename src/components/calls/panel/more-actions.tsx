"use client";

import { useCallback, useRef, useState } from "react";
import { Check, MoreHorizontal } from "lucide-react";
import type { Call, CallStatus } from "@/lib/types";
import { CALL_STATUS, CALL_STATUS_ORDER } from "@/lib/labels";
import { useDismiss } from "@/lib/use-dismiss";

interface MoreActionsProps {
  call: Call;
  onEdit: () => void;
  /** Même logique que le glisser-déposer du Kanban (confirmation, annulation, refus…). */
  onMove: (call: Call, status: CallStatus) => void;
}

/** Actions secondaires : modification du statut et des informations. */
export function MoreActions({ call, onEdit, onMove }: MoreActionsProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(ref, open, close);

  const pick = (status: CallStatus) => {
    close();
    if (status !== call.status) onMove(call, status);
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-2.5 whitespace-nowrap text-[13px] font-medium text-ink-soft ring-1 ring-inset ring-line hover:bg-stone-50 hover:text-ink"
      >
        <MoreHorizontal aria-hidden className="size-4" />
        Plus d&apos;actions
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 bottom-10 z-10 w-60 rounded-xl border border-line bg-surface p-1 shadow-(--shadow-pop)"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              close();
              onEdit();
            }}
            className="w-full rounded-lg px-2.5 py-1.5 text-left text-[13px] text-ink hover:bg-stone-100"
          >
            Modifier les informations
          </button>
          <p className="mt-1 border-t border-line px-2.5 pt-2 pb-1 text-[11px] font-medium tracking-wide text-ink-muted uppercase">
            Modifier le statut
          </p>
          {CALL_STATUS_ORDER.map((s) => (
            <button
              key={s}
              type="button"
              role="menuitemradio"
              aria-checked={call.status === s}
              onClick={() => pick(s)}
              className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-[13px] text-ink hover:bg-stone-100"
            >
              {CALL_STATUS[s].label}
              {call.status === s && <Check aria-hidden className="size-3.5 text-ink-soft" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
