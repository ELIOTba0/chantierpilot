import { NextRequest, NextResponse } from "next/server";
import { db, journaliser } from "@/lib/db";
import { signatureValide } from "@/lib/retell";

export const runtime = "nodejs";

/**
 * Webhook Retell : réception des événements d'appel.
 *
 * Deux protections qui font la différence entre un prototype et un
 * produit :
 *  1. vérification de signature — l'URL est publique
 *  2. idempotence — Retell peut livrer deux fois le même événement ;
 *     sans ça, on dupliquerait les appels et les fiches
 *
 * On répond 200 même sur erreur de traitement : un 500 déclenche des
 * renvois en boucle chez Retell. L'erreur est tracée dans la table.
 */
export async function POST(req: NextRequest) {
  // Le corps BRUT est indispensable : la signature porte sur les octets
  // exacts, pas sur le JSON re-sérialisé.
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

  // Identifiant d'événement : fourni par Retell, sinon reconstruit.
  const evenementId = payload.event_id ?? (callId ? `${callId}:${type}` : null);
  if (!evenementId) {
    return NextResponse.json({ ok: true, ignore: "pas_d_identifiant" });
  }

  // --- Idempotence -------------------------------------------------
  // La contrainte unique fait le travail : si la ligne existe déjà,
  // l'insertion échoue et on sort sans rien retraiter.
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
    const plombierId =
      ((appel.metadata as Record<string, unknown>)?.plombier_id as string) ?? null;

    if (type === "call_started") {
      await db.from("appels").upsert(
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
    }

    if (type === "call_ended" || type === "call_analyzed") {
      const analyse = (appel.call_analysis as Record<string, unknown>) ?? {};

      await db.from("appels").upsert(
        {
          plombier_id: plombierId,
          retell_call_id: callId!,
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
      );
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
