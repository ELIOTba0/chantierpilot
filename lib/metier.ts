/**
 * Règles métier. Centralisées ici pour qu'elles soient testables
 * et qu'elles ne se dispersent pas dans les endpoints.
 */

/** Durée à bloquer dans l'agenda, par type de problème. */
export const DUREES_MIN: Record<string, number> = {
  fuite: 60,
  robinetterie: 60,
  debouchage: 60,
  wc: 90,
  recherche_fuite: 120,
  chauffe_eau_depannage: 90,
  chauffe_eau_remplacement: 180,
  entretien_chaudiere: 90,
  devis: 30,
  autre: 60,
};

export function dureePour(typeProbleme: string | null | undefined): number {
  if (!typeProbleme) return DUREES_MIN.autre;
  return DUREES_MIN[typeProbleme] ?? DUREES_MIN.autre;
}

/**
 * Normalise une commune pour la comparaison : minuscules, sans accents,
 * tirets et espaces unifiés. « Saint-Barthélemy-d'Anjou » et
 * « saint barthelemy d anjou » doivent correspondre.
 */
export function normaliserCommune(valeur: string): string {
  return valeur
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’]/g, " ")
    .replace(/[-_]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function dansLaZone(commune: string | null | undefined, communes: string[]): boolean {
  if (!commune) return false;
  const cible = normaliserCommune(commune);
  return communes.some((c) => normaliserCommune(c) === cible);
}

/** Les trois niveaux d'urgence acceptés. Tout le reste retombe sur « moyenne ». */
export function normaliserUrgence(valeur: string | null | undefined): "haute" | "moyenne" | "basse" {
  const v = (valeur ?? "").toLowerCase();
  if (v === "haute" || v === "high") return "haute";
  if (v === "basse" || v === "low") return "basse";
  return "moyenne";
}

/** Formatage d'un créneau pour que l'agent le dise à voix haute. */
export function creneauEnFrancais(iso: string): string {
  const d = new Date(iso);
  const jour = d.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Europe/Paris",
  });
  const heure = d.toLocaleTimeString("fr-FR", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Europe/Paris",
  });
  return `${jour} à ${heure}`;
}
