"use client";

/**
 * Accès aux données du tableau de bord.
 *
 * Toutes les lectures passent par les vues v_* et toutes les écritures
 * sensibles par des fonctions SQL : c'est la base qui vérifie les
 * droits (RLS et contrôles dans les fonctions), pas l'interface. Les
 * écrans n'importent que ce module ; le jour où les données viendront
 * d'ailleurs, c'est ici seulement que ça change.
 */

import { sb } from "@/lib/supabase-browser";
import type {
  Administrateur, Appel, Entreprise, Indicateurs, IndicateursPlateforme,
  Page, Plombier, Rappel, RendezVous, Session,
} from "./types";

export * from "./types";

// ------------------------------------------------------------------
// Erreurs
// ------------------------------------------------------------------

type ErreurBrute = { message: string; code?: string } | null;

/** Erreur dont le message peut être montré tel quel à l'utilisateur. */
export class ErreurDonnees extends Error {
  constructor(message: string, public code?: string) {
    super(message);
  }
}

/**
 * Les fonctions SQL lèvent des messages rédigés pour l'utilisateur
 * (codes 22023, P0002, 23505, 42501). Pour tout le reste, message
 * générique : on n'affiche pas le détail technique d'une erreur base.
 */
function traduire(e: ErreurBrute): ErreurDonnees {
  const code = e?.code;
  if (code === "22023" || code === "P0002" || code === "23505") {
    return new ErreurDonnees(e!.message, code);
  }
  if (code === "42501" || code === "PGRST301") {
    return new ErreurDonnees("Accès refusé. Reconnectez-vous ou vérifiez vos droits.", code);
  }
  if (process.env.NODE_ENV !== "production" && e) console.error(e);
  return new ErreurDonnees("Une erreur est survenue. Réessayez dans un instant.", code);
}

function verifier<T>(r: { data: T | null; error: ErreurBrute }): T {
  if (r.error) throw traduire(r.error);
  return r.data as T;
}

export function messageErreur(e: unknown): string {
  return e instanceof ErreurDonnees ? e.message : "Une erreur est survenue.";
}

// ------------------------------------------------------------------
// Filtres communs
// ------------------------------------------------------------------

export type Periode = { du?: string | null; au?: string | null };
export const TAILLE_PAGE = 25;

/**
 * Nettoie une recherche avant de l'insérer dans un filtre or() de
 * PostgREST : virgules, parenthèses et points y ont un sens.
 */
function nettoyer(texte: string): string {
  return texte.replace(/[,().*%\\:"]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
}

/** Filtre « nom ou numéro » ; le numéro est cherché sans espaces. */
function filtreRecherche(texte: string, colNom: string, colChiffres: string): string | null {
  const t = nettoyer(texte);
  if (!t) return null;
  const chiffres = t.replace(/\D/g, "");
  const conditions = [`${colNom}.ilike.*${t}*`];
  if (chiffres.length >= 2) conditions.push(`${colChiffres}.ilike.*${chiffres}*`);
  return conditions.join(",");
}

// ------------------------------------------------------------------
// Session
// ------------------------------------------------------------------

export async function chargerSession(): Promise<Session> {
  return verifier(await sb.rpc("cp_session")) as Session;
}

// ------------------------------------------------------------------
// Indicateurs
// ------------------------------------------------------------------

export async function chargerIndicateurs(entrepriseId?: string): Promise<Indicateurs> {
  return verifier(await sb.rpc("cp_indicateurs", { p_entreprise: entrepriseId ?? null })) as Indicateurs;
}

export async function chargerIndicateursPlateforme(): Promise<IndicateursPlateforme> {
  return verifier(await sb.rpc("cp_indicateurs_plateforme")) as IndicateursPlateforme;
}

// ------------------------------------------------------------------
// Appels
// ------------------------------------------------------------------

export type FiltresAppels = Periode & {
  recherche?: string;
  resultat?: string;        // valeur de RESULTAT_APPEL, ou « inconnu »
  traitement?: string;
  entreprise?: string;
  ordre?: "recent" | "ancien";
  page?: number;
};

const COLONNES_APPEL =
  "id, plombier_id, entreprise_id, entreprise_nom, demo, plombier_nom, date_appel, fin, " +
  "duree_s, statut, numero_appelant, nom_appelant, motif, resume, resultat, traitement, " +
  "rappels_ouverts, demande_id, urgence, client_id";

export async function listerAppels(f: FiltresAppels): Promise<Page<Appel>> {
  const page = f.page ?? 0;
  let q = sb.from("v_appels").select(COLONNES_APPEL, { count: "exact" });

  if (f.du) q = q.gte("date_appel", f.du);
  if (f.au) q = q.lt("date_appel", f.au);
  if (f.entreprise) q = q.eq("entreprise_id", f.entreprise);
  if (f.traitement) q = q.eq("traitement", f.traitement);
  if (f.resultat === "inconnu") q = q.is("resultat", null);
  else if (f.resultat) q = q.eq("resultat", f.resultat);
  const recherche = f.recherche ? filtreRecherche(f.recherche, "nom_appelant", "numero_chiffres") : null;
  if (recherche) q = q.or(recherche);

  const r = await q
    .order("date_appel", { ascending: f.ordre === "ancien" })
    .range(page * TAILLE_PAGE, page * TAILLE_PAGE + TAILLE_PAGE - 1);
  return { lignes: verifier(r) as unknown as Appel[], total: r.count ?? 0 };
}

export type DetailAppel = Appel & {
  transcript: string | null;
  enregistrement_url: string | null;
};

export async function chargerAppel(id: string): Promise<DetailAppel | null> {
  const vue = verifier(await sb.from("v_appels").select(COLONNES_APPEL).eq("id", id).maybeSingle());
  if (!vue) return null;
  const brut = verifier(await sb.from("appels")
    .select("transcript, enregistrement_url").eq("id", id).maybeSingle()) as
    { transcript: string | null; enregistrement_url: string | null } | null;
  return { ...(vue as unknown as Appel), transcript: brut?.transcript ?? null,
           enregistrement_url: brut?.enregistrement_url ?? null };
}

// ------------------------------------------------------------------
// Rappels
// ------------------------------------------------------------------

export type FiltresRappels = {
  vue?: "ouverts" | "clos" | "tous";
  priorite?: string;
  recherche?: string;
  entreprise?: string;
  appel?: string;
  page?: number;
};

export async function listerRappels(f: FiltresRappels): Promise<Page<Rappel>> {
  const page = f.page ?? 0;
  let q = sb.from("v_rappels").select("*", { count: "exact" });
  const vue = f.vue ?? "ouverts";
  if (vue === "ouverts") q = q.eq("ouvert", true);
  if (vue === "clos") q = q.eq("ouvert", false);
  if (f.priorite) q = q.eq("priorite", f.priorite);
  if (f.entreprise) q = q.eq("entreprise_id", f.entreprise);
  if (f.appel) q = q.eq("appel_id", f.appel);
  const recherche = f.recherche ? filtreRecherche(f.recherche, "nom_client", "telephone_chiffres") : null;
  if (recherche) q = q.or(recherche);

  // Ouverts : d'abord ceux en retard, puis par priorité, puis les plus
  // anciens. Clos : les derniers traités d'abord.
  q = vue === "ouverts"
    ? q.order("en_retard", { ascending: false })
       .order("rang_priorite", { ascending: true })
       .order("date_appel", { ascending: true })
    : q.order("modifie_le", { ascending: false });

  const r = await q.range(page * TAILLE_PAGE, page * TAILLE_PAGE + TAILLE_PAGE - 1);
  return { lignes: verifier(r) as unknown as Rappel[], total: r.count ?? 0 };
}

export async function mettreAJourRappel(
  id: string,
  statut: Rappel["statut"],
  options: { echeance?: string | null; note?: string | null } = {}
): Promise<void> {
  verifier(await sb.rpc("rappel_mettre_a_jour", {
    p_id: id, p_statut: statut,
    p_echeance: options.echeance ?? null, p_note: options.note ?? null,
  }));
}

// ------------------------------------------------------------------
// Rendez-vous
// ------------------------------------------------------------------

export type FiltresRdv = Periode & {
  statut?: string;
  origine?: "ia" | "manuel" | "";
  recherche?: string;
  entreprise?: string;
  ordre?: "chrono" | "inverse";
  page?: number;
};

export async function listerRendezVous(f: FiltresRdv): Promise<Page<RendezVous>> {
  const page = f.page ?? 0;
  let q = sb.from("v_rendez_vous").select("*", { count: "exact" });
  if (f.du) q = q.gte("debut", f.du);
  if (f.au) q = q.lt("debut", f.au);
  if (f.statut) q = q.eq("statut_affiche", f.statut);
  if (f.origine === "ia") q = q.eq("par_ia", true);
  if (f.origine === "manuel") q = q.eq("par_ia", false);
  if (f.entreprise) q = q.eq("entreprise_id", f.entreprise);
  const recherche = f.recherche ? filtreRecherche(f.recherche, "nom_client", "telephone_chiffres") : null;
  if (recherche) q = q.or(recherche);

  const r = await q
    .order("debut", { ascending: f.ordre !== "inverse" })
    .range(page * TAILLE_PAGE, page * TAILLE_PAGE + TAILLE_PAGE - 1);
  return { lignes: verifier(r) as unknown as RendezVous[], total: r.count ?? 0 };
}

export async function rendezVousDeLAppel(appelId: string): Promise<RendezVous[]> {
  return verifier(await sb.from("v_rendez_vous").select("*").eq("appel_id", appelId)
    .order("debut")) as unknown as RendezVous[];
}

export async function changerStatutRdv(
  id: string, action: "confirmer" | "terminer" | "annuler", motif?: string
): Promise<void> {
  verifier(await sb.rpc("rendez_vous_changer_statut", {
    p_id: id, p_action: action, p_motif: motif ?? null,
  }));
}

// ------------------------------------------------------------------
// Administration
// ------------------------------------------------------------------

export type FiltresEntreprises = {
  recherche?: string;
  statut?: string;
  ordre?: "nom" | "activite" | "recent";
  page?: number;
};

export async function listerEntreprises(f: FiltresEntreprises): Promise<Page<Entreprise>> {
  const page = f.page ?? 0;
  let q = sb.from("v_entreprises").select("*", { count: "exact" });
  if (f.statut) q = q.eq("statut", f.statut);
  const t = f.recherche ? nettoyer(f.recherche) : "";
  if (t) {
    q = q.or(["nom", "contact_nom", "email", "ville", "titulaire_nom"]
      .map((c) => `${c}.ilike.*${t}*`).join(","));
  }
  if (f.ordre === "activite") q = q.order("nb_appels_7j", { ascending: false });
  else if (f.ordre === "recent") q = q.order("cree_le", { ascending: false });
  const r = await q.order("nom").range(page * TAILLE_PAGE, page * TAILLE_PAGE + TAILLE_PAGE - 1);
  return { lignes: verifier(r) as unknown as Entreprise[], total: r.count ?? 0 };
}

/** Liste courte pour les filtres « par entreprise ». */
export async function optionsEntreprises(): Promise<{ id: string; nom: string }[]> {
  return verifier(await sb.from("entreprises").select("id, nom").order("nom")) as
    { id: string; nom: string }[];
}

export async function chargerEntreprise(id: string): Promise<Entreprise | null> {
  return verifier(await sb.from("v_entreprises").select("*").eq("id", id).maybeSingle()) as
    Entreprise | null;
}

export type SaisieEntreprise = {
  nom: string; contact_nom: string; email: string; telephone: string;
  ville: string; statut: Entreprise["statut"];
};

export async function enregistrerEntreprise(id: string | null, e: SaisieEntreprise): Promise<string> {
  return verifier(await sb.rpc("admin_enregistrer_entreprise", {
    p_id: id, p_nom: e.nom, p_contact_nom: e.contact_nom, p_email: e.email,
    p_telephone: e.telephone, p_ville: e.ville, p_statut: e.statut,
  })) as string;
}

const COLONNES_PLOMBIER = "id, entreprise_id, nom, email, telephone, role, actif, auth_user_id, cree_le";

export async function listerPlombiers(entrepriseId?: string): Promise<Plombier[]> {
  let q = sb.from("plombiers").select(COLONNES_PLOMBIER);
  if (entrepriseId) q = q.eq("entreprise_id", entrepriseId);
  return verifier(await q.order("nom")) as unknown as Plombier[];
}

export type SaisiePlombier = {
  entreprise_id: string; nom: string; email: string; telephone: string;
  role: string; actif: boolean;
};

export async function enregistrerPlombier(id: string | null, p: SaisiePlombier): Promise<string> {
  return verifier(await sb.rpc("admin_enregistrer_plombier", {
    p_id: id, p_entreprise_id: p.entreprise_id, p_nom: p.nom, p_email: p.email,
    p_telephone: p.telephone, p_role: p.role, p_actif: p.actif,
  })) as string;
}

export async function listerAdministrateurs(): Promise<Administrateur[]> {
  return verifier(await sb.from("administrateurs")
    .select("id, email, nom, actif, auth_user_id, cree_le").order("nom")) as Administrateur[];
}

export async function definirAdministrateur(email: string, nom: string, actif: boolean): Promise<void> {
  verifier(await sb.rpc("admin_definir_administrateur", { p_email: email, p_nom: nom, p_actif: actif }));
}
