import crypto from "crypto";

/**
 * Vérifie la signature d'un webhook Retell.
 *
 * Le endpoint webhook est une URL publique : n'importe qui peut y
 * poster. Sans cette vérification, on accepterait de faux appels et
 * de fausses fiches clients.
 *
 * Schéma Retell (docs.retellai.com/features/secure-webhook) :
 *   en-tête  X-Retell-Signature
 *   format   v={horodatage_ms},d={empreinte_hex}
 *   calcul   HMAC-SHA256( corps_brut + horodatage )  clé = clé API Retell
 *
 * Trois points qui comptent :
 *  - la clé est la clé API Retell, celle qui porte le badge webhook
 *  - le corps doit être le texte BRUT reçu, jamais du JSON
 *    re-sérialisé : un espace ou un ordre de clés différent casse tout
 *  - l'horodatage est rejeté au-delà de 5 minutes, ce qui empêche
 *    quelqu'un de rejouer un webhook capturé
 */
export function signatureValide(corpsBrut: string, signature: string | null): boolean {
  const cle = process.env.RETELL_WEBHOOK_SECRET;
  if (!cle || !signature) return false;

  const m = /v=(\d+),d=(.+)/.exec(signature);
  if (!m) return false;

  const [, horodatage, empreinte] = m;

  // Protection contre le rejeu.
  if (Math.abs(Date.now() - Number(horodatage)) > 5 * 60 * 1000) return false;

  const attendue = crypto
    .createHmac("sha256", cle)
    .update(corpsBrut + horodatage)
    .digest("hex");

  // Comparaison en temps constant : une comparaison ordinaire
  // laisserait deviner la clé caractère par caractère.
  let a: Buffer;
  let b: Buffer;
  try {
    a = Buffer.from(attendue, "hex");
    b = Buffer.from(empreinte, "hex");
  } catch {
    return false;
  }
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * Vérifie la clé partagée que Retell envoie sur les appels de fonction
 * (check_availability, book_appointment, verify_address).
 *
 * Ce n'est pas le même mécanisme que le webhook : ici c'est un simple
 * secret partagé, que nous avons choisi et déclaré dans les en-têtes
 * de chaque fonction côté Retell.
 */
export function cleFonctionValide(entete: string | null): boolean {
  const attendue = process.env.RETELL_FUNCTION_SECRET;
  if (!attendue || !entete) return false;
  const a = Buffer.from(attendue);
  const b = Buffer.from(entete);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
