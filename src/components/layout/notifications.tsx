"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { Bell, CheckCircle2 } from "lucide-react";
import type { AppState } from "@/lib/types";
import { DECISION_KIND, PRIORITY } from "@/lib/labels";
import { clientMap, decisionQueue } from "@/lib/selectors";
import { formatAgo } from "@/lib/format";
import { useAstio } from "@/lib/app-context";
import { useDismiss } from "@/lib/use-dismiss";
import { TONE_CLASSES } from "@/components/ui/badge";
import { cn } from "@/lib/cn";

/** Centre de notifications : décisions en attente du professionnel. */
export function Notifications({ state }: { state: AppState }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(ref, open, close);
  const { now } = useAstio();

  const queue = decisionQueue(state);
  const clients = clientMap(state);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={`Notifications${queue.length ? ` : ${queue.length} décisions en attente` : ""}`}
        className="relative flex size-9 items-center justify-center rounded-lg text-ink-soft hover:bg-stone-100 hover:text-ink"
      >
        <Bell className="size-[18px]" />
        {queue.length > 0 && (
          <span className="bg-brand-500 absolute top-1 right-1 flex min-w-4 items-center justify-center rounded-full px-1 text-[10px] leading-4 font-semibold text-ink tabular-nums ring-2 ring-surface">
            {queue.length}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="absolute top-11 right-0 z-40 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl bg-surface shadow-(--shadow-pop)"
        >
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <p className="text-sm font-semibold text-ink">Décisions en attente</p>
            <span className="text-xs text-ink-muted">{queue.length}</span>
          </div>
          {queue.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
              <CheckCircle2 aria-hidden className="size-5 text-emerald-600" />
              <p className="text-[13px] text-ink-muted">Rien à décider pour le moment.</p>
            </div>
          ) : (
            <ul className="max-h-80 divide-y divide-line overflow-y-auto">
              {queue.map((call) => (
                <li key={call.id}>
                  <Link
                    href={`/appels?appel=${call.id}`}
                    onClick={close}
                    className="flex gap-3 px-4 py-3 hover:bg-stone-50"
                  >
                    <span
                      aria-hidden
                      className={cn("mt-1.5 size-2 shrink-0 rounded-full", TONE_CLASSES[PRIORITY[call.priority].tone].dot)}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-ink">
                        <span className="font-medium">{clients.get(call.clientId)?.name}</span> · {call.motif}
                      </span>
                      <span className="block text-xs text-ink-muted">
                        {call.decision && DECISION_KIND[call.decision.kind].label} · {formatAgo(call.receivedAt, now)}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <Link
            href="/appels?vue=decisions"
            onClick={close}
            className="block border-t border-line px-4 py-2.5 text-center text-[13px] font-medium text-brand-800 hover:bg-stone-50"
          >
            Voir toutes les décisions
          </Link>
        </div>
      )}
    </div>
  );
}
