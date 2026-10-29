/**
 * La base de calcul d'un artisan.
 *
 * Un plombier ne connaît presque jamais le prix d'une prestation par
 * cœur : il connaît son taux horaire, le temps que prend le travail,
 * et ce que lui coûtent les fournitures. Le prix se déduit des trois.
 *
 *     prix HT = (temps ÷ 60) × taux horaire
 *             + fournitures × coefficient
 *
 * Le coefficient est la marge appliquée aux pièces : 1 signifie
 * revendre au prix d'achat, 1,3 signifie trente pour cent de marge.
 * C'est ainsi que raisonne le métier, et c'est la seule façon
 * d'obtenir des prix cohérents entre eux.
 *
 * Deux garde-fous. Le prix saisi à la main l'emporte toujours : un
 * tarif négocié, un forfait d'appel d'offres ne doivent pas être
 * écrasés par une formule. Et si la base est incomplète, on ne rend
 * rien plutôt qu'un prix faux — un zéro sur un devis se remarque,
 * un prix plausible mais erroné se signe.
 */

export type BaseCalcul = {
  /** Ce que coûte une heure de main-d'œuvre, hors taxes. */
  taux_horaire_ht: number | null;
  /** Marge sur les fournitures. 1 = revente au prix d'achat. */
  coef_fournitures: number;
  /** Forfait de déplacement, hors taxes. */
  frais_deplacement_ht: number | null;
};

export type ElementsPrix = {
  /** Prix fixé à la main. S'il existe, il fait loi. */
  prix_ht: number | null;
  /** Temps de main-d'œuvre, en minutes. */
  temps_min: number | null;
  /** Coût d'achat des fournitures, hors taxes. */
  fourniture_ht: number | null;
};

export type Calcul = {
  prix: number;
  /** D'où vient ce prix, en clair, pour que rien ne soit magique. */
  detail: string;
  /** Vrai si le prix a été saisi à la main plutôt que calculé. */
  fixe: boolean;
};

export const BASE_VIDE: BaseCalcul = {
  taux_horaire_ht: null,
  coef_fournitures: 1,
  frais_deplacement_ht: null,
};

/** Les montants d'un devis se comptent au centime, pas au millième. */
function centimes(n: number): number {
  return Math.round(n * 100) / 100;
}

export function dureeLisible(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${String(m).padStart(2, "0")}`;
}

/**
 * Le prix d'une prestation, et d'où il vient.
 *
 * Rend null quand ni prix fixé ni base suffisante : l'appelant doit
 * alors afficher « à définir », jamais zéro.
 */
export function calculerPrix(e: ElementsPrix, b: BaseCalcul): Calcul | null {
  if (e.prix_ht !== null && e.prix_ht > 0) {
    return { prix: centimes(e.prix_ht), detail: "prix fixé", fixe: true };
  }

  const morceaux: string[] = [];
  let total = 0;

  const temps = e.temps_min ?? 0;
  if (temps > 0) {
    // Sans taux horaire, le temps ne vaut rien : on refuse de
    // facturer la main-d'œuvre à zéro sans le dire.
    if (b.taux_horaire_ht === null || b.taux_horaire_ht <= 0) return null;
    const mo = centimes((temps / 60) * b.taux_horaire_ht);
    total += mo;
    morceaux.push(`${dureeLisible(temps)} × ${b.taux_horaire_ht} €`);
  }

  const four = e.fourniture_ht ?? 0;
  if (four > 0) {
    const coef = b.coef_fournitures > 0 ? b.coef_fournitures : 1;
    const f = centimes(four * coef);
    total += f;
    morceaux.push(coef === 1
      ? `fournitures ${four} €`
      : `fournitures ${four} € × ${String(coef).replace(".", ",")}`);
  }

  if (morceaux.length === 0) return null;
  return { prix: centimes(total), detail: morceaux.join(" + "), fixe: false };
}
