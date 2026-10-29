import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supprimerRendezVous, renommerRendezVous } from "@/lib/agenda";

/**
 * La décision du plombier sur une demande en attente.
 *
 * Pourquoi une route serveur alors que l'interface sait écrire dans
 * Supabase : parce qu'accepter ou refuser ne se limite pas à changer
 * un statut. Le créneau a été bloqué dans Google Agenda pendant
 * l'attente — avec la mention « [À confirmer] ». Accepter doit
 * retirer cette mention ; refuser doit libérer le créneau, sinon
 * l'agenda garde un rendez-vous fantôme et l'assistant continue
 * d'éviter une heure pourtant libre.
 *
 * Et cela demande le jeton Google du plombier, qui ne doit jamais
 * atteindre un navigateur.
 */

export const runtime = "nodejs";

function service() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function POST(requete: Request) {
  const entete = requete.headers.get("authorization") ?? "";
  const jeton = entete.startsWith("Bearer ") ? entete.slice(7) : null;
  if (!jeton) return NextResponse.json({ erreur: "Session absente." }, { status: 401 });

  const lecteur = createClient(
    process.env.SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );
  const { data: compte, error: errJeton } = await lecteur.auth.getUser(jeton);
  if (errJeton || !compte.user) {
    return NextResponse.json({ erreur: "Session invalide." }, { status: 401 });
  }

  const db = service();

  // Artisan ou membre de l'équipe ChantierPilot.
  let entrepriseId: string | null = null;
  let decideurId: string | null = null;

  const { data: fiche } = await db
    .from("plombiers").select("id, entreprise_id")
    .eq("auth_user_id", compte.user.id).maybeSingle();

  if (fiche?.entreprise_id) {
    entrepriseId = fiche.entreprise_id;
    decideurId = fiche.id;
  } else {
    const { data: admin } = await db
      .from("administrateurs").select("entreprise_active, actif")
      .eq("auth_user_id", compte.user.id).maybeSingle();
    if (admin?.actif) entrepriseId = admin.entreprise_active ?? null;
  }

  if (!entrepriseId) {
    return NextResponse.json({ erreur: "Compte sans entreprise." }, { status: 403 });
  }

  let corps: { demandeId?: string; decision?: string; motif?: string };
  try {
    corps = await requete.json();
  } catch {
    return NextResponse.json({ erreur: "Corps illisible." }, { status: 400 });
  }

  const { demandeId, decision } = corps;
  if (!demandeId || (decision !== "acceptee" && decision !== "refusee")) {
    return NextResponse.json({ erreur: "Décision inconnue." }, { status: 400 });
  }

  // La demande doit appartenir à l'entreprise du décideur.
  const { data: demande } = await db
    .from("demandes")
    .select("id, statut, nom_client, adresse, commune, telephone_client, plombier_id, assigne_a, rendez_vous(id, debut, fin, statut, google_event_id, assigne_a)")
    .eq("id", demandeId)
    .maybeSingle();

  if (!demande) {
    return NextResponse.json({ erreur: "Demande introuvable." }, { status: 404 });
  }

  const { data: porteur } = await db
    .from("plombiers").select("entreprise_id").eq("id", demande.plombier_id).maybeSingle();

  if (porteur?.entreprise_id !== entrepriseId) {
    return NextResponse.json({ erreur: "Demande hors de votre périmètre." }, { status: 403 });
  }

  if (demande.statut !== "a_confirmer") {
    // Deux plombiers peuvent cliquer en même temps. Le second doit
    // comprendre, pas écraser la décision du premier.
    return NextResponse.json(
      { erreur: "Cette demande a déjà été tranchée.", statut: demande.statut },
      { status: 409 }
    );
  }

  const rdv = (demande.rendez_vous as unknown as {
    id: string; debut: string; fin: string; statut: string;
    google_event_id: string | null; assigne_a: string | null;
  }[] | null)?.[0] ?? null;

  // Le jeton de celui qui doit intervenir, pas de celui qui décide.
  let jetonGoogle: string | null = null;
  let calendrier = "primary";
  const cible = rdv?.assigne_a ?? demande.assigne_a ?? demande.plombier_id;
  if (cible) {
    const { data: p } = await db
      .from("plombiers")
      .select("google_refresh_token, google_calendar_id")
      .eq("id", cible).maybeSingle();
    jetonGoogle = p?.google_refresh_token ?? null;
    calendrier = p?.google_calendar_id ?? "primary";
  }

  let googleMessage: string | null = null;
  const maintenant = new Date().toISOString();

  if (decision === "acceptee") {
    if (rdv) {
      await db.from("rendez_vous").update({ statut: "confirme" }).eq("id", rdv.id);

      if (jetonGoogle && rdv.google_event_id) {
        try {
          await renommerRendezVous({
            refreshToken: jetonGoogle,
            calendarId: calendrier,
            evenementId: rdv.google_event_id,
            titre: `${demande.nom_client ?? "Client"} — intervention confirmée`,
          });
        } catch (e) {
          googleMessage = "Le rendez-vous est confirmé, mais son titre n'a pas pu "
                        + "être mis à jour dans Google Agenda.";
          await db.from("journal").insert({
            plombier_id: demande.plombier_id, niveau: "avertissement",
            action: "google_renommage_echec", detail: { rdv: rdv.id, message: String(e) },
          });
        }
      }
    }

    await db.from("demandes").update({
      statut: "rdv_pris", decision: "acceptee",
      decide_le: maintenant, decide_par: decideurId,
    }).eq("id", demandeId);

  } else {
    if (rdv) {
      await db.from("rendez_vous").update({
        statut: "annule", annule_le: maintenant,
        motif_annulation: corps.motif ?? "Refusé par le plombier",
      }).eq("id", rdv.id);

      // Libérer le créneau est la partie qui compte : sans elle,
      // l'assistant éviterait une heure désormais disponible.
      if (jetonGoogle && rdv.google_event_id) {
        try {
          await supprimerRendezVous({
            refreshToken: jetonGoogle,
            calendarId: calendrier,
            evenementId: rdv.google_event_id,
          });
        } catch (e) {
          googleMessage = "La demande est refusée, mais le créneau n'a pas pu être "
                        + "libéré dans Google Agenda. À retirer à la main.";
          await db.from("journal").insert({
            plombier_id: demande.plombier_id, niveau: "erreur",
            action: "google_suppression_echec", detail: { rdv: rdv.id, message: String(e) },
          });
        }
      }
    }

    await db.from("demandes").update({
      statut: "refusee", decision: "refusee",
      decide_le: maintenant, decide_par: decideurId,
      motif_refus: corps.motif ?? null,
    }).eq("id", demandeId);
  }

  // Le message destiné au client, avec son texte exact.
  const { data: ent } = await db
    .from("entreprises").select("nom, canal_notification")
    .eq("id", entrepriseId).maybeSingle();

  const lieu = [demande.adresse, demande.commune].filter(Boolean).join(", ");
  const quand = rdv
    ? new Date(rdv.debut).toLocaleString("fr-FR", {
        weekday: "long", day: "numeric", month: "long",
        hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris",
      })
    : null;

  const contenu = decision === "acceptee"
    ? `Bonjour, ${ent?.nom ?? "votre plombier"} confirme votre rendez-vous`
      + (quand ? ` ${quand}` : "") + (lieu ? `, ${lieu}` : "") + "."
    : `Bonjour, ${ent?.nom ?? "votre plombier"} ne peut malheureusement pas prendre `
      + "votre demande en charge"
      + (corps.motif ? ` (${corps.motif.toLowerCase()})` : "")
      + ". Nous vous invitons à contacter un autre artisan.";

  await db.from("notifications").insert({
    entreprise_id: entrepriseId,
    demande_id: demandeId,
    rendez_vous_id: rdv?.id ?? null,
    destinataire: "client",
    adresse_dest: demande.telephone_client,
    canal: ent?.canal_notification ?? "interface",
    modele: decision === "acceptee" ? "confirmation" : "refus",
    contenu,
    statut: "a_envoyer",
  });

  return NextResponse.json({ ok: true, googleMessage, message: contenu });
}
