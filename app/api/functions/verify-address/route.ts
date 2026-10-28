import { NextRequest, NextResponse } from "next/server";
import { journaliser } from "@/lib/db";
import { cleFonctionValide } from "@/lib/retell";
import { normaliserCommune } from "@/lib/metier";

export const runtime = "nodejs";

type TraitBAN = {
  label: string;
  score: number;
  housenumber?: string;
  street?: string;
  postcode: string;
  city: string;
  type: string;
};

async function interrogerBAN(requete: string): Promise<TraitBAN[]> {
  const url = new URL("https://api-adresse.data.gouv.fr/search/");
  url.searchParams.set("q", requete);
  url.searchParams.set("limit", "8");
  url.searchParams.set("autocomplete", "0");

  const r = await fetch(url, { signal: AbortSignal.timeout(6000) });
  if (!r.ok) throw new Error(`BAN a répondu ${r.status}`);
  const data = await r.json();
  return (data.features ?? []).map(
    (f: { properties: TraitBAN }) => f.properties
  );
}

/**
 * Vérifie une adresse contre la Base Adresse Nationale, le référentiel
 * officiel publié en open data par l'État. Gratuit, sans clé.
 *
 * GARDE-FOU ESSENTIEL : on ne propose jamais une adresse située dans
 * une autre commune que celle annoncée par le client. Sans ce filtre,
 * une recherche sur « rue des Lilas, Avrillé » remonte des résultats
 * en Meurthe-et-Moselle et en Ariège — et un plombier envoyé à 500 km
 * est un client définitivement perdu.
 */
export async function POST(req: NextRequest) {
  if (!cleFonctionValide(req.headers.get("x-chantierpilot-cle"))) {
    return NextResponse.json({ erreur: "non autorise" }, { status: 401 });
  }

  let a: Record<string, string | undefined>;
  try {
    const corps = await req.json();
    a = corps.args ?? corps;
  } catch {
    return NextResponse.json({ valide: false, raison: "requete_illisible" });
  }

  const adresse = (a.adresse ?? "").trim();
  const commune = (a.commune ?? "").trim();

  if (!adresse) {
    return NextResponse.json({ valide: false, raison: "adresse_vide" });
  }

  try {
    const traits = await interrogerBAN(
      commune ? `${adresse} ${commune}` : adresse
    );

    if (traits.length === 0) {
      return NextResponse.json({
        valide: false,
        raison: "introuvable",
        consigne: "Fais épeler le nom de la rue, lettre par lettre.",
      });
    }

    // --- Filtre géographique ---------------------------------------
    // Tout ce qui n'est pas dans la commune annoncée est écarté.
    let candidats = traits;
    if (commune) {
      const cible = normaliserCommune(commune);
      candidats = traits.filter(
        (t) => normaliserCommune(t.city) === cible
      );

      if (candidats.length === 0) {
        const ailleurs = [...new Set(traits.map((t) => t.city))].slice(0, 3);
        await journaliser({
          niveau: "info",
          action: "adresse_hors_commune_ecartee",
          detail: { adresse, commune, trouve_ailleurs: ailleurs },
        });
        return NextResponse.json({
          valide: false,
          raison: "introuvable_dans_commune",
          commune_demandee: commune,
          consigne:
            `Cette rue n'a pas été trouvée à ${commune}. Demande au client ` +
            `de confirmer la commune, puis fais-lui épeler le nom de la rue. ` +
            `Ne propose jamais une adresse d'une autre commune.`,
        });
      }
    }

    const meilleur = candidats[0];
    const sur = meilleur.score >= 0.7 && meilleur.type === "housenumber";

    if (sur) {
      const rue = [meilleur.housenumber, meilleur.street]
        .filter(Boolean)
        .join(" ");

      return NextResponse.json({
        valide: true,
        // Forme écrite, pour la fiche du plombier.
        adresse_normalisee: meilleur.label,
        rue,
        code_postal: meilleur.postcode,
        commune: meilleur.city,
        // Forme parlée : sans code postal. Personne ne récite
        // « quarante neuf mille cent » au téléphone.
        a_dire: `${rue}, à ${meilleur.city}`,
        consigne:
          "Répète au client exactement le contenu de a_dire, puis attends " +
          "sa confirmation. Ne prononce jamais le code postal.",
      });
    }

    return NextResponse.json({
      valide: false,
      raison: meilleur.type === "housenumber" ? "incertain" : "numero_manquant",
      suggestions: candidats.slice(0, 3).map((t) => t.label),
      suggestions_a_dire: candidats.slice(0, 3).map((t) =>
        `${[t.housenumber, t.street].filter(Boolean).join(" ") || t.label.replace(/\s*\d{5}.*$/, "")}, à ${t.city}`
      ),
      consigne:
        meilleur.type === "housenumber"
          ? "Propose ces adresses au client et demande laquelle est la bonne."
          : "La rue existe mais le numéro manque. Demande le numéro de rue.",
    });
  } catch (e) {
    await journaliser({
      niveau: "avertissement",
      action: "echec_verification_adresse",
      detail: { adresse, commune, message: String(e) },
    });
    return NextResponse.json({
      valide: false,
      raison: "verification_indisponible",
      consigne:
        "Impossible de vérifier. Fais répéter l'adresse complète au client, " +
        "fais épeler le nom de la rue, et note-la telle quelle.",
    });
  }
}
