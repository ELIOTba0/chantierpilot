"use client";

import { useSyncExternalStore } from "react";
import { CheckCircle2, Info, X } from "lucide-react";

/** Retours visuels après une action (simulée). */

interface Toast {
  id: number;
  title: string;
  description?: string;
  kind: "success" | "info";
}

let toasts: Toast[] = [];
let seq = 0;
const listeners = new Set<() => void>();
const EMPTY: Toast[] = [];

function emit() {
  listeners.forEach((l) => l());
}

export function dismissToast(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

export function toast(title: string, options: { description?: string; kind?: Toast["kind"] } = {}) {
  seq += 1;
  const id = seq;
  toasts = [...toasts.slice(-2), { id, title, description: options.description, kind: options.kind ?? "success" }];
  emit();
  setTimeout(() => dismissToast(id), 4500);
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function Toaster() {
  const items = useSyncExternalStore(subscribe, () => toasts, () => EMPTY);
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:items-end"
    >
      {items.map((t) => {
        const Icon = t.kind === "success" ? CheckCircle2 : Info;
        return (
          <div
            key={t.id}
            role="status"
            className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl bg-surface px-4 py-3 shadow-(--shadow-pop)"
          >
            <Icon
              aria-hidden
              className={t.kind === "success" ? "mt-0.5 size-4 text-emerald-600" : "mt-0.5 size-4 text-sky-600"}
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-ink">{t.title}</p>
              {t.description && <p className="mt-0.5 text-[13px] text-ink-muted">{t.description}</p>}
            </div>
            <button
              type="button"
              onClick={() => dismissToast(t.id)}
              className="rounded p-0.5 text-ink-muted hover:bg-stone-100 hover:text-ink"
              aria-label="Fermer la notification"
            >
              <X className="size-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
