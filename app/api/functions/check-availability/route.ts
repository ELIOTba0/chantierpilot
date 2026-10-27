import { NextRequest, NextResponse } from "next/server";
import { db, journaliser } from "@/lib/db";
import { cleFonctionValide } from "@/lib/retell";
import { creneauxLibres } from "@/lib/agenda";
import { dureePour, creneauEnFrancais, dansLaZone } from "@/lib/metier";

export const runtime = "nodejs";

/**
 * Appelée par l'agent Retell pendant la conversation.
 * Renvoie DEUX créneaux réellement libres, formulés en français.
 *
 * Règle absolue : si quoi que ce soit échoue, on renvoie
 * disponible: false. L'agent prendra un message. On ne renvoie
 * jamais un créneau qu'on n'a pas vérifié.
 */
export async function POST(req: NextRequest) {
  if (!cleFonctionValide(req.headers.get("x-chantierpilot-cle"))) {
    return NextResponse.json({ erreur: "non autorise" }, { status: 401 });
  }

  let args: {
    plombier_id?: string;
    type_probleme?: string;
    commune?: string;
    preference?: string;
  };

  try {
    const corps = await req.json();
    // Retell encapsule les arguments de la fonction dans `args`.
    args = corps.args ?? corps;
  } catch {
    return NextResponse.json({ disponible: false, raison: "requete_illisible" });
  }

  if (!args.plombier_id) {
    return NextResponse.json({ disponible: false, raison: "plombier_inconnu" });
  }

  const { data: plombier, error } = await db
    .from("plombiers")
    .select("id, communes, horaires, google_refresh_token, google_calendar_id, actif")
    .eq("id", args.plombier_id)
    .single();

  if (error || !plombier || !plombier.actif) {
    return NextResponse.json({ disponible: false, raison: "plombier_inconnu" });
  }

  // Hors zone : on ne propose rien, l'agent prend un message.
  if (args.commune && !dansLaZone(args.commune, plombier.communes ?? [])) {
    await journaliser({
      plombier_id: plombier.id,
      action: "creneaux_refuses_hors_zone",
      detail: { commune: args.commune },
    });
    return NextResponse.json({ disponible: false, raison: "hors_zone" });
  }

  if (!plombier.google_refresh_token) {
    await journaliser({
      plombier_id: plombier.id,
      niveau: "erreur",
      action: "agenda_non_connecte",
    });
    return NextResponse.json({ disponible: false, raison: "agenda_indisponible" });
  }

  try {
    const creneaux = await creneauxLibres({
      refreshToken: plombier.google_refresh_token,
      calendarId: plombier.google_calendar_id ?? "primary",
      dureeMin: dureePour(args.type_probleme),
      horaires: plombier.horaires as Record<string, string>,
      maxResultats: 6,
    });

    if (creneaux.length === 0) {
      return NextResponse.json({ disponible: false, raison: "aucun_creneau" });
    }

    // On en propose deux, jamais une liste : au téléphone,
    // personne ne retient davantage.
    const proposes = creneaux.slice(0, 2);

    return NextResponse.json({
      disponible: true,
      creneaux: proposes.map((c) => ({
        debut: c.debut,
        fin: c.fin,
        libelle: creneauEnFrancais(c.debut),
      })),
    });
  } catch (e) {
    await journaliser({
      plombier_id: plombier.id,
      niveau: "erreur",
      action: "echec_lecture_agenda",
      detail: { message: String(e) },
    });
    // On ne devine jamais une disponibilité.
    return NextResponse.json({ disponible: false, raison: "agenda_indisponible" });
  }
}
