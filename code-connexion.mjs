/**
 * Génère un code de connexion pour une adresse, sans passer par
 * l'envoi de courriel.
 *
 * Resend refuse d'écrire à une autre adresse que celle du titulaire
 * du compte tant qu'aucun domaine n'est vérifié. Ce script contourne
 * l'envoi : il demande à Supabase de fabriquer le code, et l'affiche
 * ici. On le transmet ensuite par le moyen qu'on veut.
 *
 * À lancer depuis la racine du projet :
 *     node code-connexion.mjs eliotbarre0@gmail.com
 *
 * Ce fichier utilise la clé service_role : il reste en local, jamais
 * déployé, jamais exposé au navigateur.
 */

import { readFileSync } from "node:fs";

function lireEnv(chemin = ".env") {
  const env = {};
  // split sur /\r?\n/ : sous Windows les lignes finissent par \r\n,
  // et une expression régulière avec $ n'attrape pas le \r.
  for (const ligne of readFileSync(chemin, "utf8").split(/\r?\n/)) {
    const nette = ligne.trim();
    if (!nette || nette.startsWith("#")) continue;
    const i = nette.indexOf("=");
    if (i === -1) continue;
    env[nette.slice(0, i).trim()] = nette.slice(i + 1).trim();
  }
  return env;
}

const env = lireEnv();
const url = env.SUPABASE_URL;
const cle = env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.argv[2];

if (!url || !cle) {
  console.error("SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquant dans .env");
  process.exit(1);
}
if (!email) {
  console.error("Usage : node code-connexion.mjs adresse@exemple.fr");
  process.exit(1);
}

/** magiclink pour un compte existant, invite pour un nouveau. */
async function generer(type) {
  const r = await fetch(`${url}/auth/v1/admin/generate_link`, {
    method: "POST",
    headers: {
      apikey: cle,
      Authorization: `Bearer ${cle}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ type, email }),
  });
  const corps = await r.json().catch(() => ({}));
  return { ok: r.ok, statut: r.status, corps };
}

let res = await generer("magiclink");

// Le compte n'existe pas encore : on le crée par une invitation.
if (!res.ok && JSON.stringify(res.corps).includes("not found")) {
  console.log("Aucun compte pour cette adresse, création en cours…");
  res = await generer("invite");
}

if (!res.ok) {
  console.error(`Échec (${res.statut}) :`, res.corps);
  process.exit(1);
}

const p = res.corps.properties ?? res.corps;

console.log("");
console.log("  Adresse  :", email);
console.log("  Code     :", p.email_otp ?? "(non renvoyé)");
console.log("");
console.log("  Lien direct (vaut connexion, à usage unique) :");
console.log(" ", p.action_link ?? "(non renvoyé)");
console.log("");
console.log("  Le code expire au bout d'une heure.");
console.log("  Transmets-le de la main à la main : il ouvre le compte.");
console.log("");
