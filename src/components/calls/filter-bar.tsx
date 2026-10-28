"use client";

import type { ReactNode } from "react";
import { Columns3, List, Search, Sparkles, X } from "lucide-react";
import type { AppointmentState, CallStatus, Priority } from "@/lib/types";
import { APPOINTMENT_STATE, CALL_STATUS, CALL_STATUS_ORDER, PRIORITY } from "@/lib/labels";
import { type AppointmentFilter, type CallFilters, type SortKey, activeFilterCount, EMPTY_FILTERS } from "@/lib/call-filters";
import { cn } from "@/lib/cn";
import { MultiSelect } from "@/components/ui/multi-select";

export type CallsMode = "kanban" | "liste";

interface FilterBarProps {
  filters: CallFilters;
  onChange: (f: CallFilters) => void;
  mode: CallsMode;
  onModeChange: (m: CallsMode) => void;
  counts: { decisions: number; toPlan: number; results: number; total: number };
}

const STATUS_OPTIONS = CALL_STATUS_ORDER.map((s) => ({ value: s, label: CALL_STATUS[s].label }));
const PRIORITY_OPTIONS = (Object.keys(PRIORITY) as Priority[]).map((p) => ({ value: p, label: PRIORITY[p].label }));
const APPOINTMENT_OPTIONS: { value: AppointmentFilter; label: string }[] = [
  { value: "none", label: "Sans rendez-vous" },
  ...(["confirme", "realise", "annule"] as AppointmentState[]).map((s) => ({
    value: s,
    label: APPOINTMENT_STATE[s].label,
  })),
];

const SORTS: { value: SortKey; label: string }[] = [
  { value: "priorite", label: "Priorité" },
  { value: "date", label: "Date" },
  { value: "statut", label: "Statut" },
];

function Toggle({
  pressed,
  onClick,
  children,
  count,
}: {
  pressed: boolean;
  onClick: () => void;
  children: ReactNode;
  count?: number;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-medium ring-1 ring-inset transition",
        pressed ? "bg-brand-50 text-brand-800 ring-brand-200" : "bg-surface text-ink-soft ring-line hover:text-ink",
      )}
    >
      {children}
      {count !== undefined && (
        <span
          className={cn(
            "rounded px-1 text-[11px] tabular-nums",
            pressed ? "bg-brand-100 text-brand-800" : "bg-stone-100 text-ink-soft",
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}

export function FilterBar({ filters, onChange, mode, onModeChange, counts }: FilterBarProps) {
  const set = <K extends keyof CallFilters>(key: K, value: CallFilters[K]) => onChange({ ...filters, [key]: value });
  const active = activeFilterCount(filters);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 basis-56 sm:max-w-xs">
          <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted" />
          <input
            type="search"
            value={filters.query}
            onChange={(e) => set("query", e.target.value)}
            placeholder="Nom, téléphone ou motif"
            aria-label="Rechercher un appel par nom, téléphone ou motif"
            className="h-9 w-full rounded-lg border border-line bg-surface pr-3 pl-9 text-sm placeholder:text-ink-muted focus:border-brand-500 focus:outline-none"
          />
        </div>

        <div className="ml-auto flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-[13px] text-ink-soft">
            <span className="hidden sm:inline">Trier par</span>
            <select
              value={filters.sort}
              onChange={(e) => set("sort", e.target.value as SortKey)}
              aria-label="Trier les appels"
              className="h-8 rounded-lg border border-line bg-surface px-2 text-[13px] font-medium text-ink focus:border-brand-500 focus:outline-none"
            >
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <div role="tablist" aria-label="Mode d'affichage" className="flex rounded-lg bg-stone-100 p-0.5">
            {(
              [
                { key: "kanban", label: "Kanban", icon: Columns3 },
                { key: "liste", label: "Liste", icon: List },
              ] as const
            ).map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={mode === key}
                onClick={() => onModeChange(key)}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[13px] font-medium transition",
                  mode === key ? "bg-surface text-ink shadow-sm" : "text-ink-soft hover:text-ink",
                )}
              >
                <Icon aria-hidden className="size-3.5" />
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Toggle pressed={filters.decisionOnly} onClick={() => set("decisionOnly", !filters.decisionOnly)} count={counts.decisions}>
          <Sparkles aria-hidden className="size-3.5" />
          Décision requise
        </Toggle>
        <Toggle pressed={filters.toPlanOnly} onClick={() => set("toPlanOnly", !filters.toPlanOnly)} count={counts.toPlan}>
          À planifier
        </Toggle>
        <Toggle pressed={filters.todayOnly} onClick={() => set("todayOnly", !filters.todayOnly)}>
          Aujourd&apos;hui
        </Toggle>
        <span aria-hidden className="mx-1 hidden h-5 w-px bg-line sm:block" />
        <MultiSelect<CallStatus> label="Statut" options={STATUS_OPTIONS} value={filters.statuses} onChange={(v) => set("statuses", v)} />
        <MultiSelect<Priority> label="Urgence" options={PRIORITY_OPTIONS} value={filters.priorities} onChange={(v) => set("priorities", v)} />
        <MultiSelect<AppointmentFilter>
          label="Rendez-vous"
          options={APPOINTMENT_OPTIONS}
          value={filters.appointments}
          onChange={(v) => set("appointments", v)}
        />
        {active > 0 && (
          <button
            type="button"
            onClick={() => onChange({ ...EMPTY_FILTERS, sort: filters.sort })}
            className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-[13px] font-medium text-ink-soft hover:bg-stone-100 hover:text-ink"
          >
            <X aria-hidden className="size-3.5" />
            Effacer les filtres
          </button>
        )}
        <p className="ml-auto text-xs text-ink-muted" aria-live="polite">
          {counts.results === counts.total ? `${counts.total} appels` : `${counts.results} sur ${counts.total} appels`}
        </p>
      </div>
    </div>
  );
}
