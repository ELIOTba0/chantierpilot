/** Mise en forme pour l'interface. Rien ici ne parle à la base. */

const JOURS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const MOIS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.",
              "août", "sept.", "oct.", "nov.", "déc."];

export const LIBELLES_PROBLEME: Record<string, string> = {
  fuite: "Fuite",
  robinetterie: "Robinetterie",
  debouchage: "Débouchage",
  wc: "WC",
  recherche_fuite: "Recherche de fuite",
  chauffe_eau_depannage: "Chauffe-eau — dépannage",
  chauffe_eau_remplacement: "Chauffe-eau — remplacement",
  entretien_chaudiere: "Entretien chaudière",
  devis: "Devis",
  autre: "Autre",
};

export const LIBELLES_STATUT: Record<string, string> = {
  nouvelle: "Nouvelle",
  rdv_pris: "RDV pris",
  a_rappeler: "À rappeler",
  hors_perimetre: "Hors périmètre",
  traitee: "Traitée",
};

export function heure(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("fr-FR", {
    hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris",
  });
}

/** « Aujourd'hui », « Demain », « jeu. 30 oct. » */
export function jour(iso: string): string {
  const d = new Date(iso);
  const auj = new Date();
  const dem = new Date(auj.getTime() + 86400000);
  const meme = (a: Date, b: Date) =>
    a.toDateString() === b.toDateString();

  if (meme(d, auj)) return "Aujourd'hui";
  if (meme(d, dem)) return "Demain";
  return `${JOURS[d.getDay()].slice(0, 3)}. ${d.getDate()} ${MOIS[d.getMonth()]}`;
}

/** « il y a 4 min », « il y a 2 h », « hier » */
export function ilYA(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "à l'instant";
  if (s < 3600) return `il y a ${Math.floor(s / 60)} min`;
  if (s < 86400) return `il y a ${Math.floor(s / 3600)} h`;
  if (s < 172800) return "hier";
  return `il y a ${Math.floor(s / 86400)} j`;
}

export function dureeTexte(min: number | null): string {
  if (!min) return "";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m}` : `${h} h`;
}

/**
 * Première lettre en capitale, et elle seule.
 *
 * La règle CSS « capitalize » met une majuscule à chaque mot : elle
 * produit « Jeudi 29 Octobre », ce qui est faux en français — ni les
 * mois ni les jours ne prennent de capitale en milieu de phrase.
 */
export function majuscule(texte: string): string {
  if (!texte) return texte;
  return texte.charAt(0).toUpperCase() + texte.slice(1);
}

/**
 * Met un numéro français en forme lisible : « 06 71 42 08 93 ».
 *
 * Accepte ce que les gens tapent réellement — +33, points, tirets,
 * espaces — et rend toujours la même chose. Un numéro mal présenté
 * se relit mal, et ces numéros finissent dans des SMS, sur des
 * devis, et sous le pouce d'un plombier qui appelle en conduisant.
 *
 * Ce qui n'est pas reconnu est renvoyé tel quel : mieux vaut un
 * numéro étranger affiché brut qu'un numéro français mutilé.
 */
export function telephoneFrancais(brut: string | null | undefined): string {
  if (!brut) return "";
  let n = brut.replace(/[^\d+]/g, "");
  if (n.startsWith("+33")) n = "0" + n.slice(3);
  else if (n.startsWith("0033")) n = "0" + n.slice(4);
  if (!/^0\d{9}$/.test(n)) return brut.trim();
  return n.replace(/(\d{2})(?=\d)/g, "$1 ").trim();
}

/** Liens de navigation. Waze d'abord : c'est ce qu'utilisent les artisans. */
export function lienWaze(adresse: string): string {
  return `https://waze.com/ul?q=${encodeURIComponent(adresse)}&navigate=yes`;
}
export function lienGoogleMaps(adresse: string): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(adresse)}`;
}
export function lienAppleMaps(adresse: string): string {
  return `https://maps.apple.com/?daddr=${encodeURIComponent(adresse)}`;
}
