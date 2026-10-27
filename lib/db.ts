import { createClient } from "@supabase/supabase-js";

/**
 * Client Supabase côté serveur, avec la clé service role.
 * Ne JAMAIS l'importer depuis un composant client : cette clé
 * contourne toutes les règles de sécurité.
 */
export const db = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

/** Écrit une ligne dans le journal. N'échoue jamais bruyamment. */
export async function journaliser(entree: {
  plombier_id?: string | null;
  appel_id?: string | null;
  niveau?: "info" | "avertissement" | "erreur";
  action: string;
  detail?: unknown;
}) {
  try {
    await db.from("journal").insert({
      plombier_id: entree.plombier_id ?? null,
      appel_id: entree.appel_id ?? null,
      niveau: entree.niveau ?? "info",
      action: entree.action,
      detail: entree.detail ?? null,
    });
  } catch {
    // Le journal ne doit jamais faire tomber une requête.
  }
}
