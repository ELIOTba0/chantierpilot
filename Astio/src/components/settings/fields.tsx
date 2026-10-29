"use client";

import { useId, useState, type ReactNode } from "react";
import { Plus, X } from "lucide-react";
import { cn } from "@/lib/cn";

export const inputClass =
  "mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:border-brand-500 focus:outline-none aria-[invalid=true]:border-red-400";

interface FieldProps {
  label: string;
  hint?: string;
  error?: string;
  children: (props: { id: string; describedBy?: string; invalid: boolean }) => ReactNode;
  className?: string;
}

/** Champ de formulaire avec libellé, aide et message d'erreur reliés pour l'accessibilité. */
export function Field({ label, hint, error, children, className }: FieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint && hintId, error && errorId].filter(Boolean).join(" ") || undefined;
  return (
    <div className={className}>
      <label htmlFor={id} className="block text-[13px] font-medium text-ink">
        {label}
      </label>
      {children({ id, describedBy, invalid: Boolean(error) })}
      {hint && !error && (
        <p id={hintId} className="mt-1 text-xs text-ink-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="mt-1 text-xs text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
}

/** Interrupteur on/off, annoncé comme tel aux lecteurs d'écran. */
export function Switch({ checked, onChange, label, description }: SwitchProps) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div>
        <p id={id} className="text-sm font-medium text-ink">
          {label}
        </p>
        {description && <p className="mt-0.5 text-[13px] text-ink-soft">{description}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={id}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition",
          checked ? "bg-brand-500" : "bg-stone-300",
        )}
      >
        <span
          aria-hidden
          className={cn("inline-block size-5 rounded-full bg-white shadow transition", checked ? "translate-x-5.5" : "translate-x-0.5")}
        />
      </button>
    </div>
  );
}

interface ListEditorProps {
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
  placeholder: string;
  hint?: string;
}

/** Liste éditable (prestations, plages d'urgence, sujets prioritaires). */
export function ListEditor({ label, items, onChange, placeholder, hint }: ListEditorProps) {
  const [draft, setDraft] = useState("");
  const id = useId();

  const add = () => {
    const value = draft.trim();
    if (!value || items.includes(value)) return;
    onChange([...items, value]);
    setDraft("");
  };

  return (
    <div>
      <p id={id} className="text-[13px] font-medium text-ink">
        {label}
      </p>
      {hint && <p className="mt-0.5 text-xs text-ink-muted">{hint}</p>}
      <ul aria-labelledby={id} className="mt-2 flex flex-wrap gap-2">
        {items.map((item) => (
          <li
            key={item}
            className="inline-flex items-center gap-1 rounded-lg bg-stone-100 py-1 pr-1 pl-2.5 text-[13px] text-ink"
          >
            {item}
            <button
              type="button"
              onClick={() => onChange(items.filter((i) => i !== item))}
              className="rounded p-0.5 text-ink-muted hover:bg-stone-200 hover:text-ink"
              aria-label={`Retirer « ${item} »`}
            >
              <X className="size-3.5" />
            </button>
          </li>
        ))}
        {items.length === 0 && <li className="text-[13px] text-ink-muted">Aucun élément</li>}
      </ul>
      <div className="mt-2 flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder={placeholder}
          aria-label={`Ajouter : ${label}`}
          className={cn(inputClass, "mt-0 flex-1")}
        />
        <button
          type="button"
          onClick={add}
          disabled={!draft.trim()}
          className="inline-flex h-9 items-center gap-1 rounded-lg px-3 text-[13px] font-medium text-ink ring-1 ring-inset ring-line-strong hover:bg-stone-50 disabled:opacity-50"
        >
          <Plus aria-hidden className="size-3.5" />
          Ajouter
        </button>
      </div>
    </div>
  );
}
