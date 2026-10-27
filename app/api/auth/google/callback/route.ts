import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import crypto from "crypto";
import { db, journaliser } from "@/lib/db";

export const runtime = "nodejs";

/** Vérifie la signature du state et en extrait le plombier_id. */
function plombierDepuisState(state: string | null): string | null {
  if (!state) return null;
  try {
    const decode = Buffer.from(state, "base64url").toString("utf8");
    const morceaux = decode.split(".");
    if (morceaux.length !== 3) return null;

    const [plombierId, nonce, signature] = morceaux;
    const attendue = crypto
      .createHmac("sha256", process.env.RETELL_FUNCTION_SECRET!)
      .update(`${plombierId}.${nonce}`)
      .digest("hex");

    const a = Buffer.from(attendue);
    const b = Buffer.from(signature);
    if (a.length !== b.length) return null;
    if (!crypto.timingSafeEqual(a, b)) return null;

    return plombierId;
  } catch {
    return null;
  }
}

function page(titre: string, message: string, ok: boolean) {
  return new NextResponse(
    `<!doctype html><html lang="fr"><head><meta charset="utf-8">
     <meta name="viewport" content="width=device-width,initial-scale=1">
     <title>${titre}</title>
     <style>
       body{font-family:system-ui,sans-serif;max-width:32rem;margin:4rem auto;
            padding:0 1.5rem;line-height:1.6;color:#1a1a1a}
       h1{font-size:1.5rem;margin-bottom:.5rem}
       .etat{color:${ok ? "#0a7d3f" : "#b42318"};font-weight:600}
     </style></head>
     <body><h1>${titre}</h1><p class="etat">${message}</p>
     <p>Vous pouvez fermer cette page.</p></body></html>`,
    { headers: { "content-type": "text/html; charset=utf-8" } }
  );
}

/**
 * Retour de Google après le consentement du plombier.
 * Échange le code contre un refresh_token et le stocke.
 */
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;

  // L'utilisateur a refusé, ou Google a renvoyé une erreur.
  const erreur = params.get("error");
  if (erreur) {
    return page("Autorisation refusée", `Google a répondu : ${erreur}`, false);
  }

  const code = params.get("code");
  const plombierId = plombierDepuisState(params.get("state"));

  if (!code || !plombierId) {
    return page("Lien invalide", "La demande n'a pas pu être vérifiée.", false);
  }

  const oauth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

  try {
    const { tokens } = await oauth.getToken(code);

    // Sans refresh_token, l'accès expire en une heure et ne se renouvelle
    // pas. C'est inutilisable : on le dit plutôt que de faire semblant.
    if (!tokens.refresh_token) {
      await journaliser({
        plombier_id: plombierId,
        niveau: "erreur",
        action: "oauth_sans_refresh_token",
      });
      return page(
        "Autorisation incomplète",
        "Google n'a pas fourni d'accès durable. Révoquez l'accès dans votre compte Google, puis recommencez.",
        false
      );
    }

    const { error } = await db
      .from("plombiers")
      .update({
        google_refresh_token: tokens.refresh_token,
        google_calendar_id: "primary",
      })
      .eq("id", plombierId);

    if (error) throw new Error(error.message);

    await journaliser({
      plombier_id: plombierId,
      action: "agenda_connecte",
    });

    return page(
      "Agenda connecté",
      "Votre agenda Google est maintenant relié à ChantierPilot.",
      true
    );
  } catch (e) {
    await journaliser({
      plombier_id: plombierId,
      niveau: "erreur",
      action: "echec_oauth",
      detail: { message: String(e) },
    });
    return page(
      "Connexion impossible",
      "L'agenda n'a pas pu être relié. Réessayez dans un instant.",
      false
    );
  }
}
