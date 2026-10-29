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

// ------------------------------------------------------------------
// Statuts du tableau de bord. Chaque libellé a un « ton » qui choisit
// la couleur de la puce : accent (fait, positif), urgent (action
// attendue), neutre (le reste). Trois couleurs, pas une par statut :
// le plombier doit voir d'un coup d'œil ce qui attend une action.
// ------------------------------------------------------------------

export type Ton = "accent" | "urgent" | "neutre" | "attenue";
export type Libelle = { libelle: string; ton: Ton };

/** Ce qu'il reste à faire après l'appel (v_appels.traitement). */
export const TRAITEMENT_APPEL: Record<string, Libelle> = {
  a_rappeler: { libelle: "Rappel nécessaire", ton: "urgent" },
  traite:     { libelle: "Traité", ton: "accent" },
  en_cours:   { libelle: "En cours", ton: "neutre" },
  echec:      { libelle: "Appel échoué", ton: "neutre" },
};

/** Ce que l'appel a produit (v_appels.resultat). */
export const RESULTAT_APPEL: Record<string, Libelle> = {
  rdv_pris:       { libelle: "RDV pris", ton: "accent" },
  a_rappeler:     { libelle: "À rappeler", ton: "urgent" },
  renseigne:      { libelle: "Renseigné", ton: "neutre" },
  hors_perimetre: { libelle: "Hors secteur", ton: "neutre" },
  sans_suite:     { libelle: "Sans suite", ton: "attenue" },
  transfere:      { libelle: "Transféré", ton: "neutre" },
};
export const RESULTAT_INCONNU: Libelle = { libelle: "Non déterminé", ton: "attenue" };

export const STATUT_RAPPEL: Record<string, Libelle> = {
  a_faire:   { libelle: "À faire", ton: "urgent" },
  reporte:   { libelle: "Reporté", ton: "neutre" },
  effectue:  { libelle: "Effectué", ton: "accent" },
  abandonne: { libelle: "Abandonné", ton: "attenue" },
};

export const PRIORITE: Record<string, Libelle> = {
  haute:   { libelle: "Priorité haute", ton: "urgent" },
  moyenne: { libelle: "Priorité moyenne", ton: "neutre" },
  basse:   { libelle: "Priorité basse", ton: "attenue" },
};

/** v_rendez_vous.statut_affiche : jamais « confirmé » sans preuve. */
export const STATUT_RDV: Record<string, Libelle> = {
  confirme:   { libelle: "Confirmé", ton: "accent" },
  en_attente: { libelle: "En attente", ton: "urgent" },
  annule:     { libelle: "Annulé", ton: "attenue" },
  termine:    { libelle: "Terminé", ton: "neutre" },
  echec:      { libelle: "Échec de création", ton: "urgent" },
};

export const STATUT_ENTREPRISE: Record<string, Libelle> = {
  actif:    { libelle: "Actif", ton: "accent" },
  essai:    { libelle: "Essai", ton: "neutre" },
  suspendu: { libelle: "Suspendu", ton: "urgent" },
  resilie:  { libelle: "Résilié", ton: "attenue" },
};

export const ROLE_PLOMBIER: Record<string, string> = {
  titulaire: "Titulaire",
  technicien: "Technicien",
  secretariat: "Secrétariat",
};

export function libelleProbleme(type: string | null | undefined): string {
  if (!type) return "Non précisé";
  return LIBELLES_PROBLEME[type] ?? type;
}

/** « 3 min 20 » */
export function dureeAppel(s: number | null | undefined): string {
  if (!s) return "—";
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m ? `${m} min ${String(r).padStart(2, "0")}` : `${r} s`;
}

/**
 * Découpe une transcription « Assistant : … / Client : … » en tours
 * de parole. Retell écrit tantôt « Agent », tantôt « Assistant ».
 * Si rien ne correspond, renvoie null : on affiche alors le texte brut
 * plutôt que de perdre l'information.
 */
export function tours(transcript: string): { qui: "assistant" | "client"; texte: string }[] | null {
  const lignes = transcript.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const sortie: { qui: "assistant" | "client"; texte: string }[] = [];

  for (const ligne of lignes) {
    const m = /^(assistant|agent|client|user|utilisateur)\s*:\s*(.*)$/i.exec(ligne);
    if (!m) return null;
    const qui = /^(assistant|agent)$/i.test(m[1]) ? "assistant" : "client";
    sortie.push({ qui, texte: m[2] });
  }
  return sortie.length > 0 ? sortie : null;
}
