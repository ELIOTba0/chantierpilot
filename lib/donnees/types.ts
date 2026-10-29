/**
 * Formes des lignes renvoyées par les vues du tableau de bord
 * (db/migration-005-dashboard.sql). Une seule définition, partagée par
 * l'espace plombier et l'espace administrateur.
 */

export type Role = "admin" | "user" | null;

export type Session = {
  role: Role;
  email: string | null;
  admin: { id: string; nom: string } | null;
  plombier: { id: string; nom: string; role: string } | null;
  entreprise: { id: string; nom: string; statut: string; demo: boolean } | null;
};

export type Appel = {
  id: string;
  plombier_id: string;
  entreprise_id: string | null;
  entreprise_nom: string | null;
  demo: boolean;
  plombier_nom: string;
  date_appel: string;
  fin: string | null;
  duree_s: number | null;
  statut: string;
  numero_appelant: string | null;
  nom_appelant: string | null;
  motif: string | null;
  resume: string | null;
  resultat: string | null;
  traitement: "a_rappeler" | "traite" | "en_cours" | "echec";
  rappels_ouverts: number;
  demande_id: string | null;
  urgence: string | null;
  client_id: string | null;
};

export type RendezVous = {
  id: string;
  plombier_id: string;
  entreprise_id: string | null;
  entreprise_nom: string | null;
  demo: boolean;
  plombier_nom: string;
  debut: string;
  fin: string;
  statut: string;
  statut_affiche: "confirme" | "en_attente" | "annule" | "termine" | "echec";
  par_ia: boolean;
  origine: string | null;
  confirme_par_client: boolean;
  dans_agenda: boolean;
  termine_le: string | null;
  annule_le: string | null;
  motif_annulation: string | null;
  cree_le: string;
  demande_id: string | null;
  appel_id: string | null;
  nom_client: string | null;
  telephone_client: string | null;
  type_probleme: string | null;
  description_client: string | null;
  adresse: string | null;
  commune: string | null;
  urgence: string | null;
  assigne_a: string | null;
  client_id: string | null;
};

export type Client = {
  id: string;
  entreprise_id: string;
  entreprise_nom: string | null;
  demo: boolean;
  nom: string | null;
  telephone: string | null;
  adresse: string | null;
  commune: string | null;
  notes: string | null;
  cree_le: string;
  premier_appel: string | null;
  nb_appels: number;
  dernier_appel: string | null;
  nb_rdv: number;
  prochain_rdv: string | null;
  rappels_ouverts: number;
};

export type Rappel = {
  id: string;
  plombier_id: string;
  appel_id: string | null;
  demande_id: string | null;
  client_id: string | null;
  nom_client: string | null;
  telephone: string | null;
  motif: string | null;
  raison: string;
  priorite: "haute" | "moyenne" | "basse" | null;
  statut: "a_faire" | "reporte" | "effectue" | "abandonne";
  echeance: string | null;
  note: string | null;
  effectue_le: string | null;
  cree_le: string;
  modifie_le: string;
  entreprise_id: string | null;
  entreprise_nom: string | null;
  demo: boolean;
  plombier_nom: string;
  date_appel: string;
  ouvert: boolean;
  en_retard: boolean;
};

export type Entreprise = {
  id: string;
  nom: string;
  contact_nom: string | null;
  email: string | null;
  telephone: string | null;
  ville: string | null;
  statut: "essai" | "actif" | "suspendu" | "resilie";
  demo: boolean;
  cree_le: string;
  modifie_le: string;
  titulaire_nom: string | null;
  nb_plombiers: number;
  nb_appels: number;
  nb_appels_7j: number;
  nb_rdv: number;
  nb_rappels_ouverts: number;
  dernier_appel: string | null;
};

export type Plombier = {
  id: string;
  entreprise_id: string | null;
  nom: string;
  email: string;
  telephone: string;
  role: string;
  actif: boolean;
  auth_user_id: string | null;
  cree_le: string;
};

export type Administrateur = {
  id: string;
  email: string;
  nom: string;
  actif: boolean;
  auth_user_id: string | null;
  cree_le: string;
};

export type Indicateurs = {
  depuis: string;
  appels_7j: number;
  appels_traites_7j: number;
  rdv_ia_7j: number;
  rdv_a_venir: number;
  rappels_en_attente: number;
  rappels_en_retard: number;
  rappels_priorite_haute: number;
  appels_aujourdhui: number;
  appels_aujourdhui_traites: number;
};

export type IndicateursPlateforme = Indicateurs & {
  entreprises_total: number;
  entreprises_actives: number;
  entreprises_suspendues: number;
  plombiers_actifs: number;
  entreprises_sans_appel_7j: number;
  webhooks_en_erreur_7j: number;
  plombiers_sans_compte: number;
};

/** Une page de résultats et le total, pour la pagination. */
export type Page<T> = { lignes: T[]; total: number };
