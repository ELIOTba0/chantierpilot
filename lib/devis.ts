"use client";

import { sb } from "@/lib/supabase-browser";

/**
 * Création d'un devis, côté navigateur.
 *
 * La numérotation passe par une fonction de la base plutôt que par
 * un « maximum plus un » calculé ici : deux devis créés à la même
 * seconde porteraient le même numéro, et une numérotation à trous ou
 * en double est une irrégularité comptable.
 */
export async function creerDevis(demandeId?: string): Promise<string> {
  const { data: ent, error: errEnt } = await sb.rpc("entreprise_courante");
  if (errEnt || !ent) throw new Error("Entreprise introuvable.");

  const { data: numero, error: errNum } =
    await sb.rpc("prochain_numero_devis", { ent });
  if (errNum || !numero) throw new Error("Numérotation indisponible.");

  // Les informations du client sont recopiées, pas référencées : un
  // devis est un document figé. Si le client déménage l'an prochain,
  // celui de cette année doit garder l'ancienne adresse.
  let depuis: Record<string, unknown> = {};
  if (demandeId) {
    const { data: d } = await sb
      .from("demandes")
      .select("id, client_id, nom_client, adresse, commune, telephone_client, description_client")
      .eq("id", demandeId)
      .maybeSingle();
    if (d) {
      depuis = {
        demande_id: d.id,
        client_id: d.client_id,
        client_nom: d.nom_client ?? "Client",
        client_adresse: d.adresse,
        client_commune: d.commune,
        client_tel: d.telephone_client,
        lieu_travaux: [d.adresse, d.commune].filter(Boolean).join(", ") || null,
        notes_internes: d.description_client,
      };
    }
  }

  const { data: reglages } = await sb
    .from("entreprises")
    .select("conditions_paiement, delai_execution_defaut, devis_payant_defaut, prix_devis_ht")
    .eq("id", ent)
    .maybeSingle();

  const { data: cree, error } = await sb
    .from("devis")
    .insert({
      entreprise_id: ent,
      numero,
      client_nom: "Client",
      conditions: reglages?.conditions_paiement ?? null,
      delai_execution: reglages?.delai_execution_defaut ?? null,
      devis_payant: reglages?.devis_payant_defaut ?? false,
      prix_devis_ht: reglages?.prix_devis_ht ?? null,
      ...depuis,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return cree.id;
}

export const EUROS = new Intl.NumberFormat("fr-FR", {
  style: "currency", currency: "EUR",
});
