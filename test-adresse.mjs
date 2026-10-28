/**
 * Teste la vérification d'adresse sur quelques cas réels.
 * Usage : node test-adresse.mjs [url-de-base]
 */
import { readFileSync } from "node:fs";

const BASE = process.argv[2] ?? "http://localhost:3000";

const env = {};
for (const brut of readFileSync(".env", "utf8").split(/\r?\n/)) {
  const l = brut.trim();
  if (!l || l.startsWith("#")) continue;
  const i = l.indexOf("=");
  if (i > 0) env[l.slice(0, i).trim()] = l.slice(i + 1).trim();
}

const CLE = env.RETELL_FUNCTION_SECRET;
if (!CLE) { console.error("RETELL_FUNCTION_SECRET vide dans .env"); process.exit(1); }

const cas = [
  { adresse: "12 rue Bressigny", commune: "Angers", attendu: "adresse correcte" },
  { adresse: "2 rue Marmont", commune: "Angers", attendu: "faute de frappe probable" },
  { adresse: "rue Bressigny", commune: "Angers", attendu: "numero manquant" },
  { adresse: "48 rue des Lilas", commune: "Avrillé", attendu: "autre commune" },
  { adresse: "999 rue inexistante zzz", commune: "Angers", attendu: "introuvable" },
];

console.log(`\nVérification d'adresse sur ${BASE}\n`);

for (const c of cas) {
  const r = await fetch(`${BASE}/api/functions/verify-address`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-chantierpilot-cle": CLE },
    body: JSON.stringify({ adresse: c.adresse, commune: c.commune }),
  });
  const d = await r.json().catch(() => null);

  console.log(`"${c.adresse}, ${c.commune}"   (${c.attendu})`);
  if (!d) { console.log("   reponse illisible\n"); continue; }

  if (d.valide) {
    console.log(`   OK  -> ${d.adresse_normalisee}`);
    console.log(`        ${d.code_postal} ${d.commune}`);
  } else {
    console.log(`   refuse : ${d.raison}`);
    if (d.suggestions?.length) {
      for (const s of d.suggestions) console.log(`        - ${s}`);
    }
  }
  console.log("");
}
