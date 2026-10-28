/**
 * Test des endpoints ChantierPilot.
 * Usage : node test-endpoints.mjs [url-de-base]
 * Par défaut http://localhost:3000
 */
import { readFileSync } from "node:fs";

const BASE = process.argv[2] ?? "http://localhost:3000";

// --- Lecture du .env ---------------------------------------------
let env = {};
try {
  for (const brut of readFileSync(".env", "utf8").split(/\r?\n/)) {
    const ligne = brut.trim();
    if (!ligne || ligne.startsWith("#")) continue;
    const i = ligne.indexOf("=");
    if (i > 0) env[ligne.slice(0, i).trim()] = ligne.slice(i + 1).trim();
  }
} catch {
  console.error("Fichier .env introuvable. Lance ce script depuis la racine du projet.");
  process.exit(1);
}

const CLE = env.RETELL_FUNCTION_SECRET;
if (!CLE) {
  console.error("RETELL_FUNCTION_SECRET est vide dans le .env.");
  process.exit(1);
}

// --- Le plombier de test ------------------------------------------
const PLOMBIER = process.env.PLOMBIER_ID ?? "6b525aa4-1aff-4ae8-a3a2-344ee312917a";

async function appel(chemin, corps) {
  const r = await fetch(`${BASE}${chemin}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-chantierpilot-cle": CLE,
    },
    body: JSON.stringify(corps),
  });
  return { statut: r.status, data: await r.json().catch(() => null) };
}

function verdict(ok, titre, detail) {
  console.log(`${ok ? "  OK  " : " ECHEC"} | ${titre}`);
  if (detail) console.log(`       ${detail}`);
}

console.log(`\nTests sur ${BASE}`);
console.log(`Plombier ${PLOMBIER}\n`);

// --- 1. Clé invalide : doit être refusé ---------------------------
{
  const r = await fetch(`${BASE}/api/functions/check-availability`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-chantierpilot-cle": "mauvaise" },
    body: JSON.stringify({ plombier_id: PLOMBIER }),
  });
  verdict(r.status === 401, "1. Clé invalide refusée", `statut ${r.status}, attendu 401`);
}

// --- 2. Disponibilités réelles ------------------------------------
let creneau = null;
{
  const { data } = await appel("/api/functions/check-availability", {
    plombier_id: PLOMBIER,
    type_probleme: "fuite",
    commune: "Angers",
  });
  const ok = data?.disponible === true && data.creneaux?.length > 0;
  verdict(ok, "2. Créneaux réels depuis Google Calendar",
    ok ? data.creneaux.map(c => c.libelle).join("  |  ")
       : `réponse : ${JSON.stringify(data)}`);
  if (ok) creneau = data.creneaux[0];
}

// --- 3. Hors zone : doit être refusé ------------------------------
{
  const { data } = await appel("/api/functions/check-availability", {
    plombier_id: PLOMBIER,
    type_probleme: "fuite",
    commune: "Marseille",
  });
  const ok = data?.disponible === false && data.raison === "hors_zone";
  verdict(ok, "3. Commune hors zone refusée", `raison : ${data?.raison}`);
}

// --- 4. Réservation sans confirmation : doit être refusée ---------
{
  const { data } = await appel("/api/functions/book-appointment", {
    plombier_id: PLOMBIER,
    debut: creneau?.debut ?? new Date(Date.now() + 86400000).toISOString(),
    type_probleme: "fuite",
    commune: "Angers",
    adresse: "12 rue Bressigny",
    nom_client: "Test",
  });
  const ok = data?.reserve === false && data.raison === "confirmation_manquante";
  verdict(ok, "4. Réservation sans confirmation orale refusée", `raison : ${data?.raison}`);
}

// --- 5. Réservation complète --------------------------------------
if (!creneau) {
  console.log("  SAUTÉ | 5. Réservation réelle (pas de créneau obtenu au test 2)");
} else {
  const { data } = await appel("/api/functions/book-appointment", {
    plombier_id: PLOMBIER,
    debut: creneau.debut,
    type_probleme: "fuite",
    commune: "Angers",
    adresse: "12 rue Bressigny, Angers",
    description_client: "ça goutte sous l'évier depuis hier soir",
    urgence: "moyenne",
    nom_client: "Mme Lemoine",
    telephone_client: "+33600000000",
    confirme_par_client: true,
  });
  const ok = data?.reserve === true;
  verdict(ok, "5. Réservation complète",
    ok ? `${data.libelle} — vérifie ton Google Calendar`
       : `réponse : ${JSON.stringify(data)}`);
}

console.log("");
