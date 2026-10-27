import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import crypto from "crypto";

export const runtime = "nodejs";

/**
 * Démarre l'autorisation Google Calendar pour UN plombier.
 *
 * Usage : /api/auth/google?plombier_id=<uuid>
 * Redirige vers l'écran de consentement Google.
 */
export async function GET(req: NextRequest) {
  const plombierId = req.nextUrl.searchParams.get("plombier_id");
  if (!plombierId) {
    return NextResponse.json(
      { erreur: "plombier_id manquant" },
      { status: 400 }
    );
  }

  const oauth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

  // Le paramètre `state` fait deux choses : il transporte le plombier_id
  // jusqu'au retour, et il est signé pour qu'on ne puisse pas rattacher
  // un agenda au compte de quelqu'un d'autre en forgeant l'URL.
  const nonce = crypto.randomBytes(16).toString("hex");
  const charge = `${plombierId}.${nonce}`;
  const signature = crypto
    .createHmac("sha256", process.env.RETELL_FUNCTION_SECRET!)
    .update(charge)
    .digest("hex");
  const state = Buffer.from(`${charge}.${signature}`).toString("base64url");

  const url = oauth.generateAuthUrl({
    // offline : indispensable pour obtenir un refresh_token.
    access_type: "offline",
    // consent : force l'écran même si l'utilisateur a déjà autorisé,
    // sinon Google ne renvoie pas de refresh_token la deuxième fois.
    prompt: "consent",
    scope: ["https://www.googleapis.com/auth/calendar.events"],
    state,
  });

  return NextResponse.redirect(url);
}
