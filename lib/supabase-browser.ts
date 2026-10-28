"use client";

import { createClient } from "@supabase/supabase-js";

/**
 * Client Supabase pour le navigateur.
 *
 * Il utilise la clé publique, soumise au Row Level Security : même
 * en cas d'erreur dans le code de l'interface, Postgres refuse de
 * renvoyer les lignes d'un autre plombier.
 *
 * Ne jamais y mettre la clé service_role, qui contourne le RLS.
 */
export const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export type Demande = {
  id: string;
  type_probleme: string | null;
  description_client: string | null;
  adresse: string | null;
  commune: string | null;
  urgence: "haute" | "moyenne" | "basse" | null;
  duree_estimee_min: number | null;
  nom_client: string | null;
  telephone_client: string | null;
  statut: string;
  questions_en_suspens: string | null;
  latitude: number | null;
  longitude: number | null;
  cree_le: string;
  appel_id: string | null;
  rendez_vous?: { debut: string; fin: string; statut: string }[];
};

export type Plombier = {
  id: string;
  nom: string;
  entreprise: string;
  email: string;
  telephone: string;
  ville: string;
  communes: string[];
  horaires: Record<string, string>;
};
