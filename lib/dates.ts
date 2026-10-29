/**
 * Bornes de dates en heure de Paris, quel que soit le fuseau de
 * l'appareil. Un plombier en déplacement ou un serveur en UTC doit
 * voir les mêmes « 7 derniers jours » que la base (cp_debut_fenetre).
 */

export const FUSEAU = "Europe/Paris";

/** Décalage de Paris par rapport à UTC à cet instant, en minutes. */
function decalageParis(instant: number): number {
  const morceaux = new Intl.DateTimeFormat("en-US", {
    timeZone: FUSEAU, timeZoneName: "longOffset",
  }).formatToParts(new Date(instant));
  const nom = morceaux.find((m) => m.type === "timeZoneName")?.value ?? "GMT";
  const m = /GMT([+-])(\d{2}):?(\d{2})?/.exec(nom);
  if (!m) return 0;
  const signe = m[1] === "-" ? -1 : 1;
  return signe * (Number(m[2]) * 60 + Number(m[3] ?? 0));
}

/** Année, mois (1-12) et jour à Paris pour un instant donné. */
export function jourParis(instant: Date = new Date()): { a: number; m: number; j: number } {
  const [a, m, j] = new Intl.DateTimeFormat("en-CA", {
    timeZone: FUSEAU, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(instant).split("-").map(Number);
  return { a, m, j };
}

/** Minuit à Paris pour une date calendaire, en instant UTC. */
export function minuitParis(a: number, m: number, j: number): Date {
  const utc = Date.UTC(a, m - 1, j);
  // Deux passes : le décalage peut changer la nuit du passage à
  // l'heure d'été ou d'hiver.
  let t = utc - decalageParis(utc) * 60000;
  t = utc - decalageParis(t) * 60000;
  return new Date(t);
}

/** Début des « N derniers jours » : aujourd'hui compte pour un. */
export function debutFenetre(jours: number): Date {
  const { a, m, j } = jourParis();
  return minuitParis(a, m, j - (Math.max(jours, 1) - 1));
}

/** « 2026-10-29 » (valeur d'un input date) → minuit à Paris. */
export function depuisSaisie(valeur: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valeur);
  if (!m) return null;
  return minuitParis(Number(m[1]), Number(m[2]), Number(m[3]));
}

/** Date du jour à Paris au format d'un input date. */
export function aujourdhuiSaisie(decalageJours = 0): string {
  const { a, m, j } = jourParis(new Date(Date.now() + decalageJours * 86400000));
  return `${a}-${String(m).padStart(2, "0")}-${String(j).padStart(2, "0")}`;
}

/** Valeur d'un input datetime-local (heure de Paris) → ISO UTC. */
export function depuisSaisieHoraire(valeur: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(valeur);
  if (!m) return null;
  const minuit = minuitParis(Number(m[1]), Number(m[2]), Number(m[3]));
  return new Date(minuit.getTime() + (Number(m[4]) * 60 + Number(m[5])) * 60000).toISOString();
}

const DATE_HEURE = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: FUSEAU,
});
const DATE_COURTE = new Intl.DateTimeFormat("fr-FR", {
  weekday: "short", day: "numeric", month: "short", timeZone: FUSEAU,
});
const DATE_LONGUE = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: FUSEAU,
});

/** « 29 oct., 14:05 » */
export function dateHeure(iso: string | null | undefined): string {
  return iso ? DATE_HEURE.format(new Date(iso)) : "—";
}
/** « jeu. 29 oct. » */
export function dateCourte(iso: string | null | undefined): string {
  return iso ? DATE_COURTE.format(new Date(iso)) : "—";
}
/** « jeudi 29 octobre 2026 » */
export function dateLongue(iso: string | null | undefined): string {
  return iso ? DATE_LONGUE.format(new Date(iso)) : "—";
}

const HEURE = new Intl.DateTimeFormat("fr-FR", {
  hour: "2-digit", minute: "2-digit", timeZone: FUSEAU,
});
/** « 14:05 », heure de Paris */
export function heureParis(iso: string | null | undefined): string {
  return iso ? HEURE.format(new Date(iso)) : "—";
}
