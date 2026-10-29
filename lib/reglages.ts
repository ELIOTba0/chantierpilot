import { db } from "@/lib/db";

/**
 * Les réglages de l'entreprise, lus au moment où l'agent appelle.
 *
 * C'est le cœur du branchement entre le site et Retell : le
 * comportement de l'assistant n'est pas écrit dans son prompt mais
 * dans la base. Un plombier qui change d'avis le change dans ses
 * réglages, et l'appel suivant en tient compte. Sans cela, il
 * faudrait rééditer l'agent de chaque client à la main.
 */

export type Mode = "auto" | "manuelle" | "aucune";

export type Reglages = {
  entrepriseId: string | null;
  nomEntreprise: string;
  mode: Mode;
  delaiReponseMin: number;
  delaiMinRdvH: number;
  dureeDefautMin: number;
  creneauxProposes: number;
  canalNotification: string;
};

const PAR_DEFAUT: Reglages = {
  entrepriseId: null,
  nomEntreprise: "votre plombier",
  // En cas de doute, on ne confirme rien tout seul. Un rendez-vous
  // qu'on n'aurait pas dû prendre coûte plus cher qu'un rappel.
  mode: "manuelle",
  delaiReponseMin: 60,
  delaiMinRdvH: 2,
  dureeDefautMin: 90,
  creneauxProposes: 2,
  canalNotification: "interface",
};

function lireMode(valeur: unknown): Mode {
  if (valeur === "auto" || valeur === "aucune") return valeur;
  return "manuelle";
}

export async function reglagesPour(plombierId: string): Promise<Reglages> {
  const { data: p } = await db
    .from("plombiers")
    .select("entreprise_id")
    .eq("id", plombierId)
    .maybeSingle();

  if (!p?.entreprise_id) return PAR_DEFAUT;

  const { data: e } = await db
    .from("entreprises")
    .select("id, nom, validation_mode, delai_reponse_min, delai_min_rdv_h, duree_defaut_min, creneaux_proposes, canal_notification")
    .eq("id", p.entreprise_id)
    .maybeSingle();

  if (!e) return PAR_DEFAUT;

  return {
    entrepriseId: e.id,
    nomEntreprise: e.nom ?? PAR_DEFAUT.nomEntreprise,
    mode: lireMode(e.validation_mode),
    delaiReponseMin: e.delai_reponse_min ?? PAR_DEFAUT.delaiReponseMin,
    delaiMinRdvH: e.delai_min_rdv_h ?? PAR_DEFAUT.delaiMinRdvH,
    dureeDefautMin: e.duree_defaut_min ?? PAR_DEFAUT.dureeDefautMin,
    creneauxProposes: e.creneaux_proposes ?? PAR_DEFAUT.creneauxProposes,
    canalNotification: e.canal_notification ?? PAR_DEFAUT.canalNotification,
  };
}

/**
 * Ce que l'agent doit dire, selon le mode.
 *
 * On renvoie la consigne avec la réponse plutôt que de la laisser
 * dans le prompt : c'est la seule façon qu'un même agent serve des
 * plombiers aux réglages différents sans se contredire.
 */
export function consignePourMode(r: Reglages, cas: "creneaux" | "reserve" | "refus"): string {
  if (r.mode === "aucune") {
    return cas === "creneaux"
      ? "Ne propose aucun créneau. Recueille la demande, l'adresse et le numéro, "
        + "puis dis que le plombier rappellera pour fixer le rendez-vous."
      : "Ne confirme aucun rendez-vous. Dis que la demande est transmise et "
        + "que le plombier rappellera.";
  }

  if (r.mode === "manuelle") {
    return cas === "creneaux"
      ? "Présente ce créneau comme une proposition, jamais comme un rendez-vous "
        + "pris. Précise que le plombier confirme par message."
      : `Dis exactement : la demande est notée pour ce créneau, et ${r.nomEntreprise} `
        + "confirme par message. N'emploie jamais « c'est noté » ni « c'est réservé » "
        + "sans parler de la confirmation à venir.";
  }

  return cas === "creneaux"
    ? "Tu peux proposer ce créneau comme disponible."
    : "Le rendez-vous est ferme. Tu peux le confirmer au client.";
}
