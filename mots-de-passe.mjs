/**
 * Donne un mot de passe aux comptes de l'équipe.
 *
 * Le code par courriel suppose un service d'envoi qui accepte vos
 * destinataires. Resend ne le fait pas sans domaine vérifié, et pour
 * trois associés qui se parlent tous les jours, c'est une complication
 * inutile : un mot de passe transmis de vive voix fait le travail,
 * ne s'expire pas, et ne dépend d'aucun tiers.
 *
 * Ce script s'exécute SUR VOTRE MACHINE uniquement. Il utilise la clé
 * service_role, qui a tous les droits sur la base : elle ne doit
 * jamais partir dans le navigateur ni dans un dépôt Git.
 *
 *   node mots-de-passe.mjs
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

// On lit .env.local à la main pour ne dépendre d'aucun paquet.
function env() {
  const valeurs = {};
  for (const nom of [".env.local", ".env"]) {
    try {
      for (const ligne of readFileSync(nom, "utf8").split("\n")) {
        const m = ligne.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
        if (m) valeurs[m[1]] ??= m[2].replace(/^["']|["']$/g, "");
      }
    } catch { /* fichier absent : on continue */ }
  }
  return valeurs;
}

const e = env();
const url = e.NEXT_PUBLIC_SUPABASE_URL;
const cle = e.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !cle) {
  console.error(
    "Il manque NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY dans .env.local.\n" +
    "La clé service_role se trouve dans Supabase → Project Settings → API keys.");
  process.exit(1);
}

// Changez ces mots de passe avant de lancer le script.
// Douze caractères au moins : Supabase refuse les plus courts, et
// un mot de passe partagé par trois personnes mérite mieux que six.
const COMPTES = [
  { email: "bailliet.mael35@gmail.com", motDePasse: "123456789101112" },
  { email: "eliotbarre0@gmail.com",     motDePasse: "123456789101112" },
  { email: "rbn.math@yahoo.com",        motDePasse: "123456789101112" },
];

const sb = createClient(url, cle, { auth: { persistSession: false } });

// On cherche le compte par son adresse plutôt que de supposer un
// identifiant : les comptes ont déjà été recréés une fois.
const { data: liste, error: eListe } = await sb.auth.admin.listUsers({ perPage: 200 });
if (eListe) { console.error("Lecture des comptes impossible :", eListe.message); process.exit(1); }

let echecs = 0;
for (const c of COMPTES) {
  if (c.motDePasse.startsWith("A-CHANGER")) {
    console.error(`✗ ${c.email} : mot de passe non modifié dans le script, ignoré.`);
    echecs++;
    continue;
  }

  const u = liste.users.find((x) => x.email?.toLowerCase() === c.email.toLowerCase());
  if (!u) { console.error(`✗ ${c.email} : aucun compte à cette adresse.`); echecs++; continue; }

  const { error } = await sb.auth.admin.updateUserById(u.id, {
    password: c.motDePasse,
    email_confirm: true,
  });
  if (error) { console.error(`✗ ${c.email} : ${error.message}`); echecs++; continue; }

  console.log(`✓ ${c.email} — mot de passe défini`);
}

console.log(echecs === 0
  ? "\nTerminé. Ils peuvent se connecter avec leur adresse et ce mot de passe."
  : `\nTerminé avec ${echecs} échec(s).`);
