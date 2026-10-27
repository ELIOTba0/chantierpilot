import crypto from "crypto";

/**
 * Vérifie la signature d'un webhook Retell.
 *
 * Le endpoint webhook est une URL publique : n'importe qui peut y poster.
 * Sans cette vérification, on accepterait des faux appels et de faux
 * rendez-vous. On compare en temps constant pour ne pas fuiter la clé.
 *
 * Le nom exact de l'en-tête et le schéma de signature sont à confirmer
 * dans la doc Retell au moment du branchement — adapter ici seulement.
 */
export function signatureValide(corpsBrut: string, signature: string | null): boolean {
  const secret = process.env.RETELL_WEBHOOK_SECRET;
  if (!secret) return false;
  if (!signature) return false;

  const attendue = crypto
    .createHmac("sha256", secret)
    .update(corpsBrut, "utf8")
    .digest("hex");

  const a = Buffer.from(attendue);
  const b = Buffer.from(signature);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * Vérifie la clé partagée que Retell envoie sur les appels de fonction
 * (check-availability, book-appointment). Même logique : ces endpoints
 * sont publics.
 */
export function cleFonctionValide(entete: string | null): boolean {
  const attendue = process.env.RETELL_FUNCTION_SECRET;
  if (!attendue || !entete) return false;
  const a = Buffer.from(attendue);
  const b = Buffer.from(entete);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
