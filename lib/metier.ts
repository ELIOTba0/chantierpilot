/**
 * Règles métier. Centralisées ici pour qu'elles soient testables
 * et qu'elles ne se dispersent pas dans les endpoints.
 */

const FUSEAU = "Europe/Paris";

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

// ------------------------------------------------------------------
// Mise en mots pour la synthèse vocale
//
// « 16:00 » se fait lire « seize » par le moteur vocal, et « 14:30 »
// devient « quatorze trente ». Au téléphone, c'est immédiatement
// identifiable comme une machine. On écrit donc tout en lettres :
// l'agent n'a plus qu'à lire ce qu'on lui donne.
// ------------------------------------------------------------------

const UNITES = [
  "zéro", "une", "deux", "trois", "quatre", "cinq", "six", "sept", "huit",
  "neuf", "dix", "onze", "douze", "treize", "quatorze", "quinze", "seize",
  "dix-sept", "dix-huit", "dix-neuf",
];

const DIZAINES: Record<number, string> = {
  20: "vingt", 30: "trente", 40: "quarante", 50: "cinquante",
};

/** Nombre de 0 à 59, en toutes lettres. */
function enLettres(n: number): string {
  if (n < 20) return UNITES[n];
  const d = Math.floor(n / 10) * 10;
  const u = n % 10;
  if (u === 0) return DIZAINES[d];
  if (u === 1) return `${DIZAINES[d]} et une`;
  return `${DIZAINES[d]}-${UNITES[u]}`;
}

/** « quatorze heures trente », « seize heures », « midi ». */
function heureEnLettres(h: number, m: number): string {
  if (h === 0 && m === 0) return "minuit";
  if (h === 12 && m === 0) return "midi";

  const heure = h === 12 ? "midi" : h === 0 ? "minuit" : `${enLettres(h)} heure${h > 1 ? "s" : ""}`;
  if (m === 0) return heure;
  return `${heure} ${enLettres(m)}`;
}

const JOURS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const MOIS = [
  "janvier", "février", "mars", "avril", "mai", "juin", "juillet",
  "août", "septembre", "octobre", "novembre", "décembre",
];

function memeJour(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * Formate un créneau comme un humain le dirait au téléphone.
 *
 * Aujourd'hui et demain sont nommés tels quels : personne ne dit
 * « mercredi 28 octobre » quand on est mercredi.
 *
 *   « aujourd'hui à seize heures »
 *   « demain à quatorze heures trente »
 *   « vendredi 30 octobre à neuf heures »
 */
export function creneauEnFrancais(iso: string): string {
  const d = new Date(iso);

  // On raisonne en heure de Paris, pas en heure du serveur.
  const paris = new Date(d.toLocaleString("en-US", { timeZone: FUSEAU }));
  const maintenant = new Date(new Date().toLocaleString("en-US", { timeZone: FUSEAU }));
  const demain = new Date(maintenant.getTime() + 86400000);

  const heure = heureEnLettres(paris.getHours(), paris.getMinutes());

  if (memeJour(paris, maintenant)) return `aujourd'hui à ${heure}`;
  if (memeJour(paris, demain)) return `demain à ${heure}`;

  const jour = JOURS[paris.getDay()];
  const quantieme = paris.getDate() === 1 ? "premier" : String(paris.getDate());
  const mois = MOIS[paris.getMonth()];
  return `${jour} ${quantieme} ${mois} à ${heure}`;
}
