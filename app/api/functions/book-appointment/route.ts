import { NextRequest, NextResponse } from "next/server";
import { db, journaliser } from "@/lib/db";
import { cleFonctionValide } from "@/lib/retell";
import { creerRendezVous } from "@/lib/agenda";
import { dureePour, dansLaZone, normaliserUrgence, creneauEnFrancais } from "@/lib/metier";

export const runtime = "nodejs";

/**
 * Crée le rendez-vous. Appelée par l'agent UNIQUEMENT après que le
 * client a confirmé le créneau et l'adresse à voix haute.
 *
 * Le pire scénario du produit, c'est l'agent qui annonce « c'est noté »
 * alors que rien n'a été créé. Ici, si la création échoue, on le dit
 * franchement : la réponse porte reserve: false, la fiche existe quand
 * même en statut « à rappeler », et l'agent bascule sur la prise de
 * message.
 */
export async function POST(req: NextRequest) {
  if (!cleFonctionValide(req.headers.get("x-chantierpilot-cle"))) {
    return NextResponse.json({ erreur: "non autorise" }, { status: 401 });
  }

  let a: Record<string, string | boolean | undefined>;
  let callId: string | null = null;

  try {
    const corps = await req.json();
    a = corps.args ?? corps;
    // Retell joint l'objet call complet à chaque appel de fonction.
    // On garde l'identifiant pour rattacher la fiche à l'appel quand
    // le webhook de fin arrivera.
    callId = (corps.call?.call_id as string) ?? null;
  } catch {
    return NextResponse.json({ reserve: false, raison: "requete_illisible" });
  }

  const plombierId = a.plombier_id as string | undefined;
  const debut = a.debut as string | undefined;
  const confirmeParClient = a.confirme_par_client === true;

  if (!plombierId || !debut) {
    return NextResponse.json({ reserve: false, raison: "parametres_manquants" });
  }

  // Garde-fou dur : pas de confirmation explicite, pas de rendez-vous.
  if (!confirmeParClient) {
    await journaliser({
      plombier_id: plombierId,
      niveau: "avertissement",
      action: "reservation_refusee_sans_confirmation",
      detail: { debut },
    });
    return NextResponse.json({ reserve: false, raison: "confirmation_manquante" });
  }

  // --- Idempotence ---------------------------------------------------
  // Si une réservation existe déjà pour cet appel, on la renvoie au
  // lieu d'en créer une seconde. Un réseau instable ou un retry ne
  // doit jamais produire deux rendez-vous pour le même client.
  if (callId) {
    const { data: deja } = await db
      .from("demandes")
      .select("id, rendez_vous(debut)")
      .eq("retell_call_id", callId)
      .eq("statut", "rdv_pris")
      .maybeSingle();

    if (deja) {
      const existant = (deja as { rendez_vous?: { debut: string }[] }).rendez_vous?.[0];
      return NextResponse.json({
        reserve: true,
        deja_reserve: true,
        debut: existant?.debut ?? debut,
        libelle: creneauEnFrancais(existant?.debut ?? debut),
      });
    }
  }

  const { data: plombier, error } = await db
    .from("plombiers")
    .select("id, nom, communes, google_refresh_token, google_calendar_id, actif")
    .eq("id", plombierId)
    .single();

  if (error || !plombier || !plombier.actif) {
    return NextResponse.json({ reserve: false, raison: "plombier_inconnu" });
  }

  const commune = (a.commune as string) ?? null;
  const dans_zone = dansLaZone(commune, plombier.communes ?? []);
  if (commune && !dans_zone) {
    return NextResponse.json({ reserve: false, raison: "hors_zone" });
  }

  const typeProbleme = (a.type_probleme as string) ?? "autre";
  const dureeMin = dureePour(typeProbleme);
  const fin = new Date(new Date(debut).getTime() + dureeMin * 60000).toISOString();
  const adresse = (a.adresse as string) ?? "";

  // 1. La fiche demande — écrite même si l'agenda échoue ensuite.
  const { data: demande, error: errDemande } = await db
    .from("demandes")
    .insert({
      plombier_id: plombier.id,
      retell_call_id: callId,
      type_probleme: typeProbleme,
      description_client: (a.description_client as string) ?? null,
      adresse,
      commune,
      dans_zone,
      urgence: normaliserUrgence(a.urgence as string),
      duree_estimee_min: dureeMin,
      nom_client: (a.nom_client as string) ?? null,
      telephone_client: (a.telephone_client as string) ?? null,
      statut: "nouvelle",
    })
    .select("id")
    .single();

  if (errDemande) {
    await journaliser({
      plombier_id: plombier.id,
      niveau: "erreur",
      action: "echec_creation_demande",
      detail: { message: errDemande.message },
    });
    return NextResponse.json({ reserve: false, raison: "erreur_interne" });
  }

  // 2. L'événement dans l'agenda.
  if (!plombier.google_refresh_token) {
    await db.from("demandes").update({ statut: "a_rappeler" }).eq("id", demande.id);
    return NextResponse.json({ reserve: false, raison: "agenda_indisponible" });
  }

  try {
    const eventId = await creerRendezVous({
      refreshToken: plombier.google_refresh_token,
      calendarId: plombier.google_calendar_id ?? "primary",
      debut,
      fin,
      titre: `${typeProbleme} — ${(a.nom_client as string) ?? "client"}`,
      description: [
        (a.description_client as string) ?? "",
        "",
        `Tel : ${(a.telephone_client as string) ?? "non précisé"}`,
        `Urgence : ${normaliserUrgence(a.urgence as string)}`,
        "",
        "Pris par l'assistant ChantierPilot.",
      ].join("\n"),
      adresse,
    });

    const { error: errRdv } = await db.from("rendez_vous").insert({
      demande_id: demande.id,
      plombier_id: plombier.id,
      debut,
      fin,
      google_event_id: eventId,
      statut: "confirme",
      confirme_par_client: true,
    });

    if (errRdv) throw new Error(errRdv.message);

    await db.from("demandes").update({ statut: "rdv_pris" }).eq("id", demande.id);

    return NextResponse.json({
      reserve: true,
      debut,
      fin,
      libelle: creneauEnFrancais(debut),
    });
  } catch (e) {
    // L'agenda a refusé. La demande existe, le plombier la verra.
    await db.from("demandes").update({ statut: "a_rappeler" }).eq("id", demande.id);
    await journaliser({
      plombier_id: plombier.id,
      niveau: "erreur",
      action: "echec_creation_rdv",
      detail: { message: String(e), debut },
    });
    return NextResponse.json({ reserve: false, raison: "agenda_indisponible" });
  }
}
