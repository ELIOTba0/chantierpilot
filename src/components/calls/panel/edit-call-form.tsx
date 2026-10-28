"use client";

import { useState, type FormEvent } from "react";
import type { Call } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { updateCallInfo } from "../call-actions";

const DURATIONS = [30, 45, 60, 90, 120, 150, 180, 240];

const inputClass =
  "mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-brand-500 focus:outline-none";

/** Consultation et modification des informations recueillies par Astio. */
export function EditCallForm({ call, onDone }: { call: Call; onDone: () => void }) {
  const [motif, setMotif] = useState(call.motif);
  const [address, setAddress] = useState(call.address ?? "");
  const [description, setDescription] = useState(call.description);
  const [duration, setDuration] = useState(call.estimatedDurationMin || 60);
  const [missing, setMissing] = useState(call.missingInfo.join("\n"));
  const [error, setError] = useState<string | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!motif.trim()) {
      setError("Le motif de l'appel est obligatoire.");
      return;
    }
    updateCallInfo(call, {
      motif: motif.trim(),
      address: address.trim() || undefined,
      description: description.trim(),
      estimatedDurationMin: duration,
      missingInfo: missing
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean),
    });
    onDone();
  };

  return (
    <form onSubmit={submit} className="space-y-3.5" noValidate>
      <label className="block text-xs font-medium text-ink-soft">
        Motif de l&apos;appel
        <input
          value={motif}
          onChange={(e) => setMotif(e.target.value)}
          className={inputClass}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "edit-error" : undefined}
        />
      </label>
      {error && (
        <p id="edit-error" role="alert" className="text-xs text-red-700">
          {error}
        </p>
      )}
      <label className="block text-xs font-medium text-ink-soft">
        Adresse du chantier
        <input value={address} onChange={(e) => setAddress(e.target.value)} className={inputClass} placeholder="Numéro, rue, code postal, ville" />
      </label>
      <label className="block text-xs font-medium text-ink-soft">
        Description du problème
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className={inputClass} />
      </label>
      <label className="block text-xs font-medium text-ink-soft">
        Durée estimée
        <select value={duration} onChange={(e) => setDuration(Number(e.target.value))} className={inputClass}>
          {DURATIONS.map((d) => (
            <option key={d} value={d}>
              {d < 60 ? `${d} min` : `${Math.floor(d / 60)} h${d % 60 ? ` ${d % 60}` : ""}`}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-xs font-medium text-ink-soft">
        Informations manquantes <span className="font-normal text-ink-muted">(une par ligne, laisser vide si complet)</span>
        <textarea value={missing} onChange={(e) => setMissing(e.target.value)} rows={3} className={inputClass} />
      </label>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onDone}>
          Annuler
        </Button>
        <Button variant="primary" size="sm" type="submit">
          Enregistrer
        </Button>
      </div>
    </form>
  );
}
