import { NextRequest, NextResponse } from "next/server";
import { db, journaliser } from "@/lib/db";
import { signatureValide } from "@/lib/retell";

export const runtime = "nodejs";

/**
 * Retrouve le plombier concerné par un appel.
 *
 * Chaque plombier a son propre agent Retell : c'est l'agent_id qui
 * fait le lien. Les métadonnées de l'appel servent de secours, par
 * exemple si un jour plusieurs numéros partagent un agent.
 */
async function trouverPlombier(appel: Record<string, unknown>): Promise<string | null> {
  const metaId = (appel.metadata as Record<string, unknown> | undefined)
    ?.plombier_id as string | undefined;
  if (metaId) return metaId;

  const agentId = appel.agent_id as string | undefined;
  if (!agentId) return null;

  const { data } = await db
    .from("plombiers")
    .select("id")
    .eq("retell_agent_id", agentId)
    .maybeSingle();

  return data?.id ?? null;
}

/**
 * Webhook Retell : réception des événements d'appel.
 *
 * Deux protections qui font la différence entre un prototype et un
 * produit :
 *  1. vérification de signature — l'URL est publique
 *  2. idempotence — Retell peut livrer deux fois le même événement ;
 *     la contrainte unique en base rejette le doublon
 *
 * On répond 200 même sur erreur de traitement : un 500 déclenche des
 * renvois en boucle chez Retell. L'erreur est tracée dans la table
 * evenements_webhook, colonne erreur.
 */
export async function POST(req: NextRequest) {
  // Le corps BRUT est indispensable : la signature porte sur les
  // octets exacts, pas sur du JSON re-sérialisé.
  const brut = await req.text();

  if (!signatureValide(brut, req.headers.get("x-retell-signature"))) {
    return NextResponse.json({ erreur: "signature invalide" }, { status: 401 });
  }

  let payload: {
    event?: string;
    call?: Record<string, unknown>;
    event_id?: string;
  };

  try {
    payload = JSON.parse(brut);
  } catch {
    return NextResponse.json({ erreur: "json invalide" }, { status: 400 });
  }

  const appel = payload.call ?? {};
  const callId = appel.call_id as string | undefined;
  const type = payload.event ?? "inconnu";

  const evenementId = payload.event_id ?? (callId ? `${callId}:${type}` : null);
  if (!evenementId) {
    return NextResponse.json({ ok: true, ignore: "pas_d_identifiant" });
  }

  // --- Idempotence -------------------------------------------------
  const { error: errDoublon } = await db.from("evenements_webhook").insert({
    source: "retell",
    evenement_id: evenementId,
    type,
    payload,
  });

  if (errDoublon) {
    if (errDoublon.code === "23505") {
      return NextResponse.json({ ok: true, deja_traite: true });
    }
    return NextResponse.json({ ok: true, erreur: "journalisation" });
  }

  try {
    const plombierId = await trouverPlombier(appel);

    // Sans plombier identifié, on ne peut rien enregistrer : la
    // colonne est not null, et un appel orphelin n'aurait aucun sens.
    // On le dit franchement plutôt que d'échouer en silence.
    if (!plombierId) {
      const message =
        `Aucun plombier pour l'agent ${appel.agent_id ?? "(inconnu)"}. ` +
        `Renseigner retell_agent_id dans la table plombiers.`;
      await db
        .from("evenements_webhook")
        .update({ erreur: message })
        .eq("source", "retell")
        .eq("evenement_id", evenementId);
      await journaliser({
        niveau: "erreur",
        action: "webhook_plombier_introuvable",
        detail: { agent_id: appel.agent_id, call_id: callId },
      });
      return NextResponse.json({ ok: true, erreur: "plombier_introuvable" });
    }

    if (type === "call_started") {
      // Le client Supabase ne lève pas d'exception : il renvoie
      // l'erreur. Sans ce contrôle, une insertion refusée passerait
      // inaperçue et l'événement serait marqué comme traité.
      const { error: errDebut } = await db.from("appels").upsert(
        {
          plombier_id: plombierId,
          retell_call_id: callId!,
          numero_appelant: (appel.from_number as string) ?? null,
          debut: appel.start_timestamp
            ? new Date(Number(appel.start_timestamp)).toISOString()
            : new Date().toISOString(),
          statut: "en_cours",
          brut: appel,
        },
        { onConflict: "retell_call_id" }
      );
      if (errDebut) throw new Error(`appels (call_started) : ${errDebut.message}`);
    }

    if (type === "call_ended" || type === "call_analyzed") {
      const analyse = (appel.call_analysis as Record<string, unknown>) ?? {};

      const { data: ligne, error: errFin } = await db
        .from("appels")
        .upsert(
          {
            plombier_id: plombierId,
            retell_call_id: callId!,
            numero_appelant: (appel.from_number as string) ?? null,
            debut: appel.start_timestamp
              ? new Date(Number(appel.start_timestamp)).toISOString()
              : null,
            fin: appel.end_timestamp
              ? new Date(Number(appel.end_timestamp)).toISOString()
              : new Date().toISOString(),
            duree_s: appel.duration_ms
              ? Math.round(Number(appel.duration_ms) / 1000)
              : null,
            statut: "termine",
            transcript: (appel.transcript as string) ?? null,
            enregistrement_url: (appel.recording_url as string) ?? null,
            resume: (analyse.call_summary as string) ?? null,
            brut: appel,
          },
          { onConflict: "retell_call_id" }
        )
        .select("id")
        .single();

      if (errFin) throw new Error(`appels (${type}) : ${errFin.message}`);

      // Rattacher les fiches créées pendant l'appel.
      if (ligne?.id && callId) {
        await db
          .from("demandes")
          .update({ appel_id: ligne.id })
          .eq("retell_call_id", callId)
          .is("appel_id", null);
      }
    }

    await db
      .from("evenements_webhook")
      .update({ traite: true })
      .eq("source", "retell")
      .eq("evenement_id", evenementId);

    return NextResponse.json({ ok: true });
  } catch (e) {
    await db
      .from("evenements_webhook")
      .update({ erreur: String(e) })
      .eq("source", "retell")
      .eq("evenement_id", evenementId);

    await journaliser({
      niveau: "erreur",
      action: "echec_traitement_webhook",
      detail: { evenementId, message: String(e) },
    });

    // 200 volontaire : on ne veut pas de tempête de renvois.
    return NextResponse.json({ ok: true, erreur: "traitement" });
  }
}
