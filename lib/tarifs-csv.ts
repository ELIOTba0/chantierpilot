/**
 * Lecture d'une liste de tarifs exportée d'un tableur.
 *
 * Le plombier a déjà ses prix quelque part : dans un classeur, dans
 * un ancien logiciel, dans un tableau Word. Lui demander de les
 * retaper un par un, c'est l'assurance qu'il ne le fera jamais.
 *
 * On lit du CSV plutôt que du .xlsx volontairement. Décoder un vrai
 * fichier Excel demanderait d'embarquer une bibliothèque de près
 * d'un mégaoctet, qui casse à chaque version du format ; « Fichier →
 * Enregistrer sous → CSV » prend dix secondes et ne casse jamais.
 * Ce lecteur accepte aussi le texte collé depuis un tableur, qui
 * arrive séparé par des tabulations.
 */

export type LigneTarif = {
  libelle: string;
  unite: string | null;
  prix_ht: number | null;
  taux_tva: number | null;
  /** Temps de main-d'œuvre, en minutes. */
  temps_min: number | null;
  /** Coût d'achat des fournitures, hors taxes. */
  fourniture_ht: number | null;
};

export type Lecture = {
  lignes: LigneTarif[];
  /** Lignes écartées, avec la raison : on ne jette rien en silence. */
  rejets: { ligne: string; raison: string }[];
  separateur: string;
};

/** Accentuation, casse et espaces en trop ne doivent pas empêcher un rapprochement. */
export function normaliser(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * « 1 234,50 € » → 1234.5
 *
 * Les tableurs français écrivent la virgule décimale et séparent
 * les milliers par une espace insécable. Les deux doivent partir
 * avant la conversion, sinon Number() rend NaN et le prix est perdu.
 */
export function nombreFrancais(brut: string): number | null {
  const t = brut
    .replace(/[  \s]/g, "")
    .replace(/[€%]/g, "")
    .replace(",", ".")
    .trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** Découpe une ligne CSV en respectant les guillemets. */
function decouper(ligne: string, sep: string): string[] {
  const cases: string[] = [];
  let courant = "";
  let dansGuillemets = false;
  for (let i = 0; i < ligne.length; i++) {
    const c = ligne[i];
    if (c === '"') {
      if (dansGuillemets && ligne[i + 1] === '"') { courant += '"'; i++; }
      else dansGuillemets = !dansGuillemets;
    } else if (c === sep && !dansGuillemets) {
      cases.push(courant); courant = "";
    } else {
      courant += c;
    }
  }
  cases.push(courant);
  return cases.map((x) => x.trim());
}

/** Le séparateur est celui qui revient le plus souvent sur la première ligne. */
function separateurProbable(premiere: string): string {
  const candidats = [";", "\t", ",", "|"];
  let meilleur = ";";
  let max = 0;
  for (const c of candidats) {
    const n = premiere.split(c).length - 1;
    if (n > max) { max = n; meilleur = c; }
  }
  return max === 0 ? ";" : meilleur;
}

const MOTS_LIBELLE = ["libelle", "designation", "prestation", "intitule", "article", "description"];
const MOTS_PRIX = ["prix", "tarif", "montant", "pu", "prix ht", "prix unitaire"];
const MOTS_UNITE = ["unite", "u"];
const MOTS_TVA = ["tva", "taux", "taux tva"];
const MOTS_TEMPS = ["temps", "duree", "minutes", "heures", "main d oeuvre", "mo"];
const MOTS_FOURNITURE = ["fourniture", "fournitures", "achat", "materiel", "matiere", "piece", "pieces"];

/**
 * « 1h30 », « 90 », « 1,5 » : trois façons d'écrire la même durée.
 *
 * Un nombre nu est ambigu. On tranche avec l'en-tête : une colonne
 * nommée « heures » contient des heures, tout le reste des minutes.
 * Deviner autrement produirait des devis faux d'un facteur soixante.
 */
export function minutesDepuis(brut: string, enHeures: boolean): number | null {
  const t = brut.trim().toLowerCase().replace(/\s/g, "");
  if (t === "") return null;

  const hm = t.match(/^(\d+)h(\d{1,2})?$/);
  if (hm) return Number(hm[1]) * 60 + (hm[2] ? Number(hm[2]) : 0);

  const mm = t.match(/^(\d+)(?:min|mn|m)$/);
  if (mm) return Number(mm[1]);

  const n = nombreFrancais(t);
  if (n === null || n < 0) return null;
  return Math.round(enHeures ? n * 60 : n);
}

function trouve(entetes: string[], mots: string[]): number {
  for (let i = 0; i < entetes.length; i++) {
    const e = normaliser(entetes[i]);
    if (mots.some((m) => e === m || e.startsWith(m + " ") || e.includes(m))) return i;
  }
  return -1;
}

const UNITES_CONNUES: Record<string, string> = {
  forfait: "forfait", f: "forfait",
  heure: "heure", h: "heure", "l heure": "heure",
  unite: "unite", u: "unite", piece: "unite", "l unite": "unite",
  m: "m", ml: "m", metre: "m", "le metre": "m",
  m2: "m2", "m²": "m2", "le m2": "m2",
};

export function lireTarifs(texte: string): Lecture {
  // Un BOM en tête ferait échouer la reconnaissance de l'en-tête.
  const propre = texte.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  const brutes = propre.split("\n").filter((l) => l.trim() !== "");
  if (brutes.length === 0) return { lignes: [], rejets: [], separateur: ";" };

  const sep = separateurProbable(brutes[0]);
  const premiere = decouper(brutes[0], sep);

  // En-tête ou non : si la première ligne porte un mot connu et
  // aucun prix lisible, c'est un en-tête.
  let iLib = 0, iPrix = 1, iUnite = -1, iTva = -1, iTemps = -1, iFour = -1, debut = 0;
  let tempsEnHeures = false;
  const aMotLibelle = trouve(premiere, MOTS_LIBELLE) !== -1;
  const aMotPrix = trouve(premiere, MOTS_PRIX) !== -1;
  if (aMotLibelle || aMotPrix) {
    iLib = Math.max(0, trouve(premiere, MOTS_LIBELLE));
    iPrix = trouve(premiere, MOTS_PRIX);
    iUnite = trouve(premiere, MOTS_UNITE);
    iTva = trouve(premiere, MOTS_TVA);
    iTemps = trouve(premiere, MOTS_TEMPS);
    iFour = trouve(premiere, MOTS_FOURNITURE);
    tempsEnHeures = iTemps >= 0 && normaliser(premiere[iTemps]).includes("heure");
    debut = 1;
    // « Unité » contient « u » ; si les deux colonnes se confondent,
    // on préfère ne pas deviner.
    if (iUnite === iLib || iUnite === iPrix) iUnite = -1;
    if (iTva === iPrix) iTva = -1;
    if (iTemps === iLib || iTemps === iPrix) iTemps = -1;
    if (iFour === iLib || iFour === iPrix || iFour === iTemps) iFour = -1;
    // Sans en-tête de prix on suppose la colonne suivante — sauf si
    // elle sert déjà à autre chose.
    if (iPrix === -1) {
      const suivante = iLib + 1;
      iPrix = [iUnite, iTva, iTemps, iFour].includes(suivante) ? -1 : suivante;
    }
  }

  const lignes: LigneTarif[] = [];
  const rejets: { ligne: string; raison: string }[] = [];

  for (let n = debut; n < brutes.length; n++) {
    const cases = decouper(brutes[n], sep);
    const libelle = (cases[iLib] ?? "").replace(/\s+/g, " ").trim();
    if (libelle === "") {
      rejets.push({ ligne: brutes[n], raison: "pas de désignation" });
      continue;
    }

    const prix = iPrix >= 0 ? nombreFrancais(cases[iPrix] ?? "") : null;
    if (prix !== null && prix < 0) {
      rejets.push({ ligne: brutes[n], raison: "prix négatif" });
      continue;
    }

    const temps = iTemps >= 0 ? minutesDepuis(cases[iTemps] ?? "", tempsEnHeures) : null;
    const fourniture = iFour >= 0 ? nombreFrancais(cases[iFour] ?? "") : null;

    // Une ligne sans prix et sans rien à calculer n'apporte rien.
    if (prix === null && temps === null && fourniture === null) {
      rejets.push({ ligne: brutes[n], raison: "ni prix, ni temps, ni fourniture" });
      continue;
    }

    let unite: string | null = null;
    if (iUnite >= 0) {
      const u = normaliser(cases[iUnite] ?? "");
      unite = UNITES_CONNUES[u] ?? null;
    }

    let tva: number | null = null;
    if (iTva >= 0) {
      const t = nombreFrancais(cases[iTva] ?? "");
      // On n'accepte que les taux français : une colonne mal
      // devinée ne doit pas écrire 1 200 % de TVA dans la base.
      if (t !== null && [2.1, 5.5, 10, 20].includes(t)) tva = t;
    }

    lignes.push({
      libelle, unite,
      prix_ht: prix,
      taux_tva: tva,
      temps_min: temps,
      fourniture_ht: fourniture !== null && fourniture >= 0 ? fourniture : null,
    });
  }

  return { lignes, rejets, separateur: sep };
}
