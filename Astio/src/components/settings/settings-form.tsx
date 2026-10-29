"use client";

import { useState, type ReactNode } from "react";
import { Info, RotateCcw } from "lucide-react";
import type { Settings, Weekday } from "@/lib/types";
import { useAstio } from "@/lib/app-context";
import { dispatch } from "@/lib/store";
import { validateSettings } from "@/lib/settings-validation";
import { cn } from "@/lib/cn";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "@/components/ui/toast";
import { Field, ListEditor, Switch, inputClass } from "./fields";

const WEEKDAYS: { value: Weekday; label: string; long: string }[] = [
  { value: 1, label: "Lun", long: "lundi" },
  { value: 2, label: "Mar", long: "mardi" },
  { value: 3, label: "Mer", long: "mercredi" },
  { value: 4, label: "Jeu", long: "jeudi" },
  { value: 5, label: "Ven", long: "vendredi" },
  { value: 6, label: "Sam", long: "samedi" },
  { value: 0, label: "Dim", long: "dimanche" },
];

const DURATIONS = [30, 45, 60, 90, 120];
const BUFFERS = [0, 15, 30, 45, 60];

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader title={title} description={description} />
      <div className="space-y-5 px-5 py-5">{children}</div>
    </Card>
  );
}

/**
 * Réglages du professionnel, persistés localement. Les préférences horaires
 * pilotent les créneaux suggérés et les plages libres du planning.
 */
export function SettingsForm() {
  const { state } = useAstio();
  const [draft, setDraft] = useState<Settings>(state.settings);
  const [showErrors, setShowErrors] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);

  const dirty = JSON.stringify(draft) !== JSON.stringify(state.settings);
  const errors = validateSettings(draft);
  const visibleErrors = showErrors ? errors : {};
  const hasErrors = Object.keys(errors).length > 0;

  const setProfile = (patch: Partial<Settings["profile"]>) => setDraft((d) => ({ ...d, profile: { ...d.profile, ...patch } }));
  const setHours = (patch: Partial<Settings["hours"]>) => setDraft((d) => ({ ...d, hours: { ...d.hours, ...patch } }));
  const setHandling = (patch: Partial<Settings["handling"]>) => setDraft((d) => ({ ...d, handling: { ...d.handling, ...patch } }));

  const save = () => {
    if (hasErrors) {
      setShowErrors(true);
      toast("Réglages non enregistrés", { description: "Corrigez les champs signalés.", kind: "info" });
      return;
    }
    const saved = { ...draft, profile: { ...draft.profile, phone: draft.profile.phone.replace(/\D/g, "") } };
    dispatch({ type: "updateSettings", settings: saved });
    setDraft(saved);
    setShowErrors(false);
    toast("Réglages enregistrés", { description: "Enregistrés dans ce navigateur. Aucune règle réelle de l'agent n'est modifiée." });
  };

  const toggleDay = (day: Weekday) =>
    setHours({
      workdays: draft.hours.workdays.includes(day)
        ? draft.hours.workdays.filter((d) => d !== day)
        : [...draft.hours.workdays, day].sort(),
    });

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-24">
      <p className="flex items-start gap-2 rounded-2xl bg-surface px-4 py-3 shadow-(--shadow-card) text-[13px] text-ink-soft">
        <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-ink-muted" />
        Ces réglages sont enregistrés dans votre navigateur. Ils pilotent la simulation (créneaux suggérés, plages libres,
        SMS) sans modifier le comportement réel de l&apos;agent vocal.
      </p>

      <Section title="Profil">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nom" error={visibleErrors.name}>
            {({ id, describedBy, invalid }) => (
              <input id={id} value={draft.profile.name} onChange={(e) => setProfile({ name: e.target.value })} aria-describedby={describedBy} aria-invalid={invalid} className={inputClass} autoComplete="name" />
            )}
          </Field>
          <Field label="Entreprise" error={visibleErrors.company}>
            {({ id, describedBy, invalid }) => (
              <input id={id} value={draft.profile.company} onChange={(e) => setProfile({ company: e.target.value })} aria-describedby={describedBy} aria-invalid={invalid} className={inputClass} autoComplete="organization" />
            )}
          </Field>
          <Field label="Téléphone" hint="Utilisé en signature des SMS envoyés aux clients." error={visibleErrors.phone}>
            {({ id, describedBy, invalid }) => (
              <input id={id} type="tel" inputMode="tel" value={draft.profile.phone} onChange={(e) => setProfile({ phone: e.target.value })} aria-describedby={describedBy} aria-invalid={invalid} className={inputClass} autoComplete="tel" />
            )}
          </Field>
          <Field label="Zone d'intervention">
            {({ id }) => <input id={id} value={draft.profile.zone} onChange={(e) => setProfile({ zone: e.target.value })} className={inputClass} />}
          </Field>
        </div>
        <ListEditor
          label="Prestations proposées"
          hint="Une demande hors de cette liste vous est remontée pour décision."
          items={draft.profile.services}
          onChange={(services) => setProfile({ services })}
          placeholder="Ex. : Pose de radiateur"
        />
        {visibleErrors.services && <p className="text-xs text-red-700">{visibleErrors.services}</p>}
      </Section>

      <Section title="Préférences horaires" description="Utilisées pour suggérer des créneaux et afficher vos disponibilités.">
        <fieldset>
          <legend className="text-[13px] font-medium text-ink">Jours travaillés</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {WEEKDAYS.map((d) => {
              const on = draft.hours.workdays.includes(d.value);
              return (
                <button
                  key={d.value}
                  type="button"
                  aria-pressed={on}
                  aria-label={d.long}
                  onClick={() => toggleDay(d.value)}
                  className={cn(
                    "h-9 w-12 rounded-lg text-[13px] font-medium ring-1 ring-inset transition",
                    on ? "bg-brand-50 text-brand-800 ring-brand-300" : "bg-surface text-ink-soft ring-line hover:text-ink",
                  )}
                >
                  {d.label}
                </button>
              );
            })}
          </div>
          {visibleErrors.workdays && <p className="mt-1 text-xs text-red-700">{visibleErrors.workdays}</p>}
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Début de journée" error={visibleErrors.hours}>
            {({ id, describedBy, invalid }) => (
              <input id={id} type="time" step={900} value={draft.hours.start} onChange={(e) => setHours({ start: e.target.value })} aria-describedby={describedBy} aria-invalid={invalid} className={inputClass} />
            )}
          </Field>
          <Field label="Fin de journée">
            {({ id }) => <input id={id} type="time" step={900} value={draft.hours.end} onChange={(e) => setHours({ end: e.target.value })} className={inputClass} />}
          </Field>
          <Field label="Début de pause" error={visibleErrors.break}>
            {({ id, describedBy, invalid }) => (
              <input id={id} type="time" step={900} value={draft.hours.breakStart} onChange={(e) => setHours({ breakStart: e.target.value })} aria-describedby={describedBy} aria-invalid={invalid} className={inputClass} />
            )}
          </Field>
          <Field label="Fin de pause">
            {({ id }) => <input id={id} type="time" step={900} value={draft.hours.breakEnd} onChange={(e) => setHours({ breakEnd: e.target.value })} className={inputClass} />}
          </Field>
          <Field label="Durée habituelle d'une intervention" hint="Utilisée quand Astio n'a pas pu estimer la durée.">
            {({ id, describedBy }) => (
              <select id={id} value={draft.hours.defaultDurationMin} onChange={(e) => setHours({ defaultDurationMin: Number(e.target.value) })} aria-describedby={describedBy} className={inputClass}>
                {DURATIONS.map((m) => (
                  <option key={m} value={m}>
                    {m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60}` : ""}`}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Marge entre deux interventions" hint="En dessous, un créneau est signalé « Marge réduite ».">
            {({ id, describedBy }) => (
              <select id={id} value={draft.hours.bufferMin} onChange={(e) => setHours({ bufferMin: Number(e.target.value) })} aria-describedby={describedBy} className={inputClass}>
                {BUFFERS.map((m) => (
                  <option key={m} value={m}>
                    {m === 0 ? "Aucune" : m < 60 ? `${m} min` : "1 h"}
                  </option>
                ))}
              </select>
            )}
          </Field>
        </div>
        <ListEditor
          label="Plages réservées aux urgences"
          hint="Facultatif. Par exemple : « Lundi au vendredi, 18:00 – 19:00 »."
          items={draft.hours.emergencySlots}
          onChange={(emergencySlots) => setHours({ emergencySlots })}
          placeholder="Jours et horaires"
        />
      </Section>

      <Section title="Gestion des appels" description="Comportement simulé d'Astio.">
        <div className="rounded-lg bg-canvas px-3 py-2.5 text-[13px] text-ink-soft">
          <span className="font-medium text-ink">Règle fixe :</span> Astio ne fixe jamais de rendez-vous. Il recueille les
          disponibilités du client et vous suggère un créneau ; vous répondez oui ou non.
        </div>
        <div className="divide-y divide-line">
          <Switch
            checked={draft.handling.smsOnDecision}
            onChange={(smsOnDecision) => setHandling({ smsOnDecision })}
            label="Prévenir le client par SMS après chaque décision"
            description="Confirmation, report, annulation ou refus (simulé). Désactivé, vous prévenez le client vous-même."
          />
          <Switch
            checked={draft.handling.flagUrgent}
            onChange={(flagUrgent) => setHandling({ flagUrgent })}
            label="Remonter les urgences en priorité"
            description="Les dossiers urgents passent en tête des décisions et des appels à planifier."
          />
        </div>
        <ListEditor
          label="Demandes à remonter en priorité"
          hint="Astio signale ces sujets comme prioritaires quand un client les évoque."
          items={draft.handling.priorityTopics}
          onChange={(priorityTopics) => setHandling({ priorityTopics })}
          placeholder="Ex. : Odeur de gaz"
        />
      </Section>

      <Section title="Données de démonstration">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-md text-[13px] text-ink-soft">
            Restaure les appels, rendez-vous et clients fictifs de départ. Vos réglages sont conservés.
          </p>
          <Button variant="danger" size="sm" icon={<RotateCcw aria-hidden className="size-3.5" />} onClick={() => setResetOpen(true)}>
            Réinitialiser la démo
          </Button>
        </div>
      </Section>

      {/* Barre d'enregistrement, visible dès qu'une modification est en cours */}
      {dirty && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur lg:left-64">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <p className="text-[13px] text-ink-soft">
              {showErrors && hasErrors ? "Certains champs sont à corriger." : "Modifications non enregistrées"}
            </p>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setDraft(state.settings);
                  setShowErrors(false);
                }}
              >
                Annuler
              </Button>
              <Button variant="primary" size="sm" onClick={save}>
                Enregistrer
              </Button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        title="Réinitialiser les données de démonstration ?"
        description="Les actions effectuées sur les appels et le planning seront perdues. Vos réglages sont conservés."
        confirmLabel="Réinitialiser"
        danger
        onConfirm={() => {
          dispatch({ type: "reset" });
          toast("Données de démonstration restaurées");
        }}
      />
    </div>
  );
}
