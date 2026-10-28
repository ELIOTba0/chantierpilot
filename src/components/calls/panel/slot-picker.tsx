"use client";

import { useState } from "react";
import { CalendarClock, Check } from "lucide-react";
import type { SlotProposal } from "@/lib/types";
import { formatDuration, formatRelativeDay, formatTimeRange } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";

interface SlotPickerProps {
  /** Créneaux préparés par Astio lors de l'appel. */
  astioSlots: SlotProposal[];
  /** Autres créneaux calculés à partir du planning local. */
  otherSlots: SlotProposal[];
  now: number;
  submitLabel: string;
  onSubmit: (slot: SlotProposal) => void;
  onCancel?: () => void;
}

function slotKey(s: SlotProposal) {
  return `${s.start}|${s.end}`;
}

function minutes(s: SlotProposal) {
  return Math.round((new Date(s.end).getTime() - new Date(s.start).getTime()) / 60_000);
}

/** Choix d'un créneau : date, heure, durée, disponibilité simulée et contraintes. */
export function SlotPicker({ astioSlots, otherSlots, now, submitLabel, onSubmit, onCancel }: SlotPickerProps) {
  const astioKeys = new Set(astioSlots.map(slotKey));
  const others = otherSlots.filter((s) => !astioKeys.has(slotKey(s)));
  const all = [...astioSlots, ...others];
  const [selected, setSelected] = useState<string | null>(all[0] ? slotKey(all[0]) : null);
  const chosen = all.find((s) => slotKey(s) === selected);

  const renderGroup = (title: string, slots: SlotProposal[]) =>
    slots.length > 0 && (
      <fieldset className="space-y-2">
        <legend className="mb-2 text-xs font-medium text-ink-soft">{title}</legend>
        {slots.map((s) => {
          const key = slotKey(s);
          const checked = key === selected;
          return (
            <label
              key={key}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 transition",
                checked ? "border-brand-500 bg-brand-50/60 ring-1 ring-brand-500" : "border-line hover:border-line-strong",
              )}
            >
              <input
                type="radio"
                name="slot"
                value={key}
                checked={checked}
                onChange={() => setSelected(key)}
                className="sr-only"
              />
              <span
                aria-hidden
                className={cn(
                  "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border",
                  checked ? "border-brand-600 bg-brand-500 text-ink" : "border-line-strong",
                )}
              >
                {checked && <Check className="size-2.5" strokeWidth={3.5} />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-sm font-medium text-ink">{formatRelativeDay(s.start, now)}</span>
                  <span className="text-sm text-ink tabular-nums">{formatTimeRange(s.start, s.end)}</span>
                  <span className="text-xs text-ink-muted">{formatDuration(minutes(s))}</span>
                </span>
                {s.note && <span className="mt-0.5 block text-xs text-ink-soft">{s.note}</span>}
              </span>
              <span
                className={cn(
                  "shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-medium",
                  s.availability === "libre" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800",
                )}
              >
                {s.availability === "libre" ? "Libre" : "Marge réduite"}
              </span>
            </label>
          );
        })}
      </fieldset>
    );

  if (all.length === 0) {
    return <p className="text-[13px] text-ink-muted">Aucun créneau disponible dans les 10 prochains jours selon vos horaires.</p>;
  }

  return (
    <div className="space-y-4">
      {renderGroup("Suggérés par Astio d'après les disponibilités du client", astioSlots)}
      {renderGroup(astioSlots.length ? "Autres créneaux libres" : "Créneaux libres dans votre planning", others)}
      <p className="text-[11px] leading-relaxed text-ink-muted">
        Disponibilité simulée d&apos;après le planning Astio et vos préférences horaires. Aucun agenda externe n&apos;est
        vérifié.
      </p>
      <div className="flex flex-wrap justify-end gap-2">
        {onCancel && (
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Annuler
          </Button>
        )}
        <Button
          variant="primary"
          size="sm"
          disabled={!chosen}
          icon={<CalendarClock aria-hidden className="size-3.5" />}
          onClick={() => chosen && onSubmit(chosen)}
        >
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}
