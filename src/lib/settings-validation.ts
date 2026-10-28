import type { Settings } from "./types";
import { parseHHMM } from "./calendar";

export type SettingsErrors = Partial<Record<"name" | "company" | "phone" | "workdays" | "hours" | "break" | "services", string>>;

/** Vérifie la cohérence des réglages avant enregistrement. */
export function validateSettings(s: Settings): SettingsErrors {
  const errors: SettingsErrors = {};
  if (!s.profile.name.trim()) errors.name = "Indiquez votre nom.";
  if (!s.profile.company.trim()) errors.company = "Indiquez le nom de l'entreprise.";
  if (s.profile.phone.replace(/\D/g, "").length !== 10) errors.phone = "Le numéro doit comporter 10 chiffres.";
  if (s.profile.services.length === 0) errors.services = "Ajoutez au moins une prestation.";
  if (s.hours.workdays.length === 0) errors.workdays = "Sélectionnez au moins un jour travaillé.";

  const start = parseHHMM(s.hours.start);
  const end = parseHHMM(s.hours.end);
  if (!(start < end)) errors.hours = "L'heure de fin doit être postérieure à l'heure de début.";

  if (s.hours.breakStart || s.hours.breakEnd) {
    const bs = parseHHMM(s.hours.breakStart);
    const be = parseHHMM(s.hours.breakEnd);
    if (!(bs < be)) errors.break = "La fin de la pause doit être postérieure à son début.";
    else if (bs < start || be > end) errors.break = "La pause doit se situer dans vos horaires de travail.";
  }
  return errors;
}
