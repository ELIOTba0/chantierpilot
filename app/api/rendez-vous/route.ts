import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { creerRendezVous } from "@/lib/agenda";

/**
 * Création d'un rendez-vous saisi à la main.
 *
 * Pourquoi une route serveur plutôt qu'une écriture directe depuis
 * le navigateur : le créneau doit aussi être posé dans Google
 * Agenda, et cela demande le jeton d'actualisation du plombier. Ce
 * jeton ne doit jamais atteindre un navigateur — c'est d'ailleurs
 * pour cela qu'il est exclu des colonnes lisibles depuis la
 * migration 003.
 *
 * Sans cette route, un rendez-vous saisi à la main n'existait que
 * dans Supabase. L'assistant, lui, lit les disponibilités dans
 * Google : il pouvait donc proposer au téléphone un créneau que le
 * plombier venait de bloquer.
 */

export const runtime = "nodejs";

type Corps = {
  nom: string;
  telephone?: string;
  adresse: string;
  commune?: string;
  type: string;
  assigneA: string;
  description?: string;
  debut: string;          // ISO
  dureeMin: number;
  urgence: string;
  prevenir?: boolean;
  latitude?: number | null;
  longitude?: number | null;
  score?: number | null;
  adresseNormalisee?: string | null;
};

function service() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function POST(requete: Request) {
  // ---------------------------------------------------------------
  // 1. Qui appelle ?
  // ---------------------------------------------------------------
  // On ne fait confiance ni au corps de la requête ni à un
  // identifiant qu'il contiendrait : seule la session vérifiée par
  // Supabase désigne l'auteur.
  const entete = requete.headers.get("authorization") ?? "";
  const jeton = entete.startsWith("Bearer ") ? entete.slice(7) : null;
  if (!jeton) {
    return NextResponse.json({ erreur: "Session absente." }, { status: 401 });
  }

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

  // Deux natures de compte depuis la migration 009 : un artisan a
  // une fiche dans « plombiers », un membre de l'équipe ChantierPilot
  // a une fiche dans « administrateurs » et consulte l'entreprise de
  // son choix. Les deux doivent pouvoir saisir un rendez-vous.
  let entrepriseId: string | null = null;
  let auteurPlombierId: string | null = null;

  const { data: fiche } = await db
    .from("plombiers")
    .select("id, entreprise_id")
    .eq("auth_user_id", compte.user.id)
    .maybeSingle();

  if (fiche?.entreprise_id) {
    entrepriseId = fiche.entreprise_id;
    auteurPlombierId = fiche.id;
  } else {
    const { data: admin } = await db
      .from("administrateurs")
      .select("entreprise_active, actif")
      .eq("auth_user_id", compte.user.id)
      .maybeSingle();
    if (admin?.actif) entrepriseId = admin.entreprise_active ?? null;
  }

  if (!entrepriseId) {
    return NextResponse.json(
      { erreur: "Ce compte n'est rattaché à aucune entreprise." },
      { status: 403 }
    );
  }

  const auteur = { id: auteurPlombierId, entreprise_id: entrepriseId };

  // ---------------------------------------------------------------
  // 2. Le corps
  // ---------------------------------------------------------------
  let c: Corps;
  try {
    c = (await requete.json()) as Corps;
  } catch {
    return NextResponse.json({ erreur: "Corps illisible." }, { status: 400 });
  }

  if (!c.nom?.trim() || !c.adresse?.trim() || !c.assigneA || !c.debut || !c.dureeMin) {
    return NextResponse.json({ erreur: "Champs obligatoires manquants." }, { status: 400 });
  }

  // Le plombier assigné doit appartenir à la même entreprise, sinon
  // n'importe quel compte pourrait écrire dans l'agenda d'un autre.
  const { data: assigne } = await db
    .from("plombiers")
    .select("id, nom, entreprise_id, google_refresh_token, google_calendar_id")
    .eq("id", c.assigneA)
    .maybeSingle();

  if (!assigne || assigne.entreprise_id !== auteur.entreprise_id) {
    return NextResponse.json({ erreur: "Plombier inconnu." }, { status: 403 });
  }

  // Le titulaire de la ligne porte les demandes de l'entreprise.
  const { data: titulaire } = await db
    .from("plombiers")
    .select("id")
    .eq("entreprise_id", auteur.entreprise_id)
    .eq("role", "gerant")
    .order("cree_le")
    .limit(1)
    .maybeSingle();

  const porteur = titulaire?.id ?? auteur.id;

  const debut = new Date(c.debut);
  if (Number.isNaN(debut.getTime())) {
    return NextResponse.json({ erreur: "Date invalide." }, { status: 400 });
  }
  const fin = new Date(debut.getTime() + c.dureeMin * 60000);

  // ---------------------------------------------------------------
  // 3. Le client
  // ---------------------------------------------------------------
  let clientId: string | null = null;
  const tel = c.telephone?.trim() || null;

  if (tel) {
    const { data: connu } = await db
      .from("clients")
      .select("id")
      .eq("entreprise_id", auteur.entreprise_id)
      .eq("telephone", tel)
      .maybeSingle();
    clientId = connu?.id ?? null;
  }

  if (!clientId) {
    const { data: cree, error } = await db
      .from("clients")
      .insert({
        entreprise_id: auteur.entreprise_id,
        nom: c.nom.trim(),
        telephone: tel,
        adresse: c.adresse.trim(),
        commune: c.commune?.trim() || null,
      })
      .select("id")
      .single();
    if (error) {
      return NextResponse.json({ erreur: `clients : ${error.message}` }, { status: 500 });
    }
    clientId = cree.id;
  }

  // ---------------------------------------------------------------
  // 4. La demande, puis le rendez-vous
  // ---------------------------------------------------------------
  const verifiee = c.latitude != null && c.longitude != null;

  const { data: demande, error: errDem } = await db
    .from("demandes")
    .insert({
      plombier_id: porteur,
      client_id: clientId,
      assigne_a: assigne.id,
      type_probleme: c.type,
      description_client: c.description?.trim() || null,
      adresse: c.adresse.trim(),
      commune: c.commune?.trim() || null,
      dans_zone: true,
      urgence: c.urgence,
      duree_estimee_min: c.dureeMin,
      nom_client: c.nom.trim(),
      telephone_client: tel,
      statut: "rdv_pris",
      origine: "manuel",
      adresse_verifiee: verifiee,
      score_adresse: c.score ?? null,
      adresse_normalisee: c.adresseNormalisee ?? null,
      latitude: c.latitude ?? null,
      longitude: c.longitude ?? null,
    })
    .select("id")
    .single();

  if (errDem) {
    return NextResponse.json({ erreur: `demandes : ${errDem.message}` }, { status: 500 });
  }

  const { data: rdv, error: errRdv } = await db
    .from("rendez_vous")
    .insert({
      demande_id: demande.id,
      plombier_id: porteur,
      assigne_a: assigne.id,
      cree_par: auteur.id,
      debut: debut.toISOString(),
      fin: fin.toISOString(),
      statut: "confirme",
      origine: "manuel",
      confirme_par_client: false,
    })
    .select("id")
    .single();

  if (errRdv) {
    return NextResponse.json({ erreur: `rendez_vous : ${errRdv.message}` }, { status: 500 });
  }

  // ---------------------------------------------------------------
  // 5. Google Agenda
  // ---------------------------------------------------------------
  // Le rendez-vous est déjà en base. Si Google refuse, on ne perd
  // rien et on ne ment pas : la réponse dit que la synchronisation a
  // échoué, et l'interface l'affiche. Un rendez-vous présent dans
  // ChantierPilot mais absent de Google reste visible par le
  // plombier ; l'inverse serait un rendez-vous fantôme.
  let googleOk = false;
  let googleMessage: string | null = null;

  if (!assigne.google_refresh_token) {
    googleMessage = `${assigne.nom} n'a pas connecté son agenda Google : le créneau n'y est pas bloqué.`;
  } else {
    try {
      const lieu = [c.adresse.trim(), c.commune?.trim()].filter(Boolean).join(", ");
      const evenementId = await creerRendezVous({
        refreshToken: assigne.google_refresh_token,
        calendarId: assigne.google_calendar_id ?? "primary",
        debut: debut.toISOString(),
        fin: fin.toISOString(),
        titre: `${c.nom.trim()} — ${c.type}`,
        description: [c.description?.trim(), tel ? `Téléphone : ${tel}` : null,
                      "Saisi à la main dans ChantierPilot."]
          .filter(Boolean).join("\n"),
        adresse: lieu,
      });
      await db.from("rendez_vous")
        .update({ google_event_id: evenementId })
        .eq("id", rdv.id);
      googleOk = true;
    } catch (e) {
      googleMessage = `Google Agenda a refusé : ${
        e instanceof Error ? e.message : "erreur inconnue"
      }. Le rendez-vous est enregistré, mais l'assistant peut encore proposer ce créneau.`;
      await db.from("journal").insert({
        plombier_id: porteur,
        niveau: "avertissement",
        action: "google_creation_echec",
        detail: { rendez_vous: rdv.id, message: String(e) },
      });
    }
  }

  // ---------------------------------------------------------------
  // 6. La trace du message au client
  // ---------------------------------------------------------------
  if (c.prevenir && tel) {
    const { data: ent } = await db
      .from("entreprises")
      .select("nom, canal_notification")
      .eq("id", auteur.entreprise_id)
      .maybeSingle();

    const quand = debut.toLocaleString("fr-FR", {
      weekday: "long", day: "numeric", month: "long",
      hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris",
    });

    await db.from("notifications").insert({
      entreprise_id: auteur.entreprise_id,
      demande_id: demande.id,
      rendez_vous_id: rdv.id,
      destinataire: "client",
      adresse_dest: tel,
      canal: ent?.canal_notification ?? "interface",
      modele: "confirmation",
      contenu: `Bonjour, ${ent?.nom ?? "votre plombier"} confirme votre rendez-vous `
             + `${quand}, ${c.adresse.trim()}`
             + (c.commune?.trim() ? ` à ${c.commune.trim()}` : "") + ".",
      statut: "a_envoyer",
    });
  }

  return NextResponse.json({
    ok: true,
    demandeId: demande.id,
    rendezVousId: rdv.id,
    googleOk,
    googleMessage,
  });
}
