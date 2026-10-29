"use client";

import { useCallback, useId, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";
import { useDismiss } from "@/lib/use-dismiss";

interface Option<T extends string> {
  value: T;
  label: string;
}

interface MultiSelectProps<T extends string> {
  label: string;
  options: Option<T>[];
  value: T[];
  onChange: (value: T[]) => void;
}

/** Menu de filtre à choix multiples. */
export function MultiSelect<T extends string>({ label, options, value, onChange }: MultiSelectProps<T>) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  const close = useCallback(() => setOpen(false), []);
  useDismiss(ref, open, close);

  const toggle = (v: T) => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  const summary =
    value.length === 0
      ? null
      : value.length === 1
        ? options.find((o) => o.value === value[0])?.label
        : `${value.length}`;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={id}
        className={cn(
          "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium transition",
          value.length ? "bg-black/[0.1] text-ink" : "bg-black/[0.05] text-ink-soft hover:bg-black/[0.08] hover:text-ink",
        )}
      >
        {label}
        {summary && <span className="max-w-28 truncate font-semibold text-ink">: {summary}</span>}
        <ChevronDown aria-hidden className="size-3.5 text-ink-muted" />
      </button>
      {open && (
        <div
          id={id}
          role="group"
          aria-label={label}
          className="absolute top-10 left-0 z-30 w-56 rounded-2xl bg-surface p-1 shadow-(--shadow-pop)"
        >
          {options.map((o) => {
            const checked = value.includes(o.value);
            return (
              <button
                key={o.value}
                type="button"
                role="checkbox"
                aria-checked={checked}
                onClick={() => toggle(o.value)}
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[13px] text-ink hover:bg-stone-100"
              >
                <span
                  aria-hidden
                  className={cn(
                    "flex size-4 items-center justify-center rounded border",
                    checked ? "border-ink bg-ink text-white" : "border-line-strong",
                  )}
                >
                  {checked && <Check className="size-3" strokeWidth={3} />}
                </span>
                {o.label}
              </button>
            );
          })}
          {value.length > 0 && (
            <button
              type="button"
              onClick={() => onChange([])}
              className="mt-1 w-full border-t border-line px-2.5 pt-2 pb-1 text-left text-xs font-medium text-ink-soft hover:text-ink"
            >
              Tout désélectionner
            </button>
          )}
        </div>
      )}
    </div>
  );
}
