import { google } from "googleapis";
import type { calendar_v3 } from "googleapis";

const FUSEAU = "Europe/Paris";

/**
 * Construit un client Google Calendar pour UN plombier.
 * Chaque plombier autorise son propre agenda : on stocke son refresh
 * token et on s'en sert pour obtenir un access token à la volée.
 */
function clientPour(refreshToken: string): calendar_v3.Calendar {
  const oauth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
  oauth.setCredentials({ refresh_token: refreshToken });
  return google.calendar({ version: "v3", auth: oauth });
}

export type Creneau = { debut: string; fin: string };

/**
 * Renvoie les créneaux réellement libres, en respectant :
 *  - les occupations déjà présentes dans l'agenda
 *  - les horaires de travail du plombier
 *  - une marge de trajet entre deux interventions
 *
 * Ne devine jamais : si l'agenda est injoignable, on remonte l'erreur
 * plutôt que de proposer un créneau inventé.
 */
export async function creneauxLibres(opts: {
  refreshToken: string;
  calendarId: string;
  dureeMin: number;
  horaires: Record<string, string>;
  joursAChercher?: number;
  margeTrajetMin?: number;
  maxResultats?: number;
}): Promise<Creneau[]> {
  const {
    refreshToken,
    calendarId,
    dureeMin,
    horaires,
    joursAChercher = 7,
    margeTrajetMin = 30,
    maxResultats = 6,
  } = opts;

  const cal = clientPour(refreshToken);

  const maintenant = new Date();
  const fin = new Date(maintenant.getTime() + joursAChercher * 86400000);

  const occupe = await cal.freebusy.query({
    requestBody: {
      timeMin: maintenant.toISOString(),
      timeMax: fin.toISOString(),
      timeZone: FUSEAU,
      items: [{ id: calendarId }],
    },
  });

  const plages = (occupe.data.calendars?.[calendarId]?.busy ?? []).map((p) => ({
    debut: new Date(p.start!).getTime(),
    fin: new Date(p.end!).getTime(),
  }));

  const dureeMs = dureeMin * 60000;
  const margeMs = margeTrajetMin * 60000;
  const resultats: Creneau[] = [];

  // On avance par pas de 30 minutes sur les jours ouvrés.
  for (let j = 0; j < joursAChercher && resultats.length < maxResultats; j++) {
    const jour = new Date(maintenant.getTime() + j * 86400000);
    const numeroJour = String(jour.getDay()); // 0 = dimanche
    const plage = horaires[numeroJour];
    if (!plage) continue; // jour non travaillé

    const [debutJour, finJour] = plage.split("-");
    const [hDeb, mDeb] = debutJour.split(":").map(Number);
    const [hFin, mFin] = finJour.split(":").map(Number);

    const ouverture = new Date(jour);
    ouverture.setHours(hDeb, mDeb, 0, 0);
    const fermeture = new Date(jour);
    fermeture.setHours(hFin, mFin, 0, 0);

    for (
      let t = Math.max(ouverture.getTime(), maintenant.getTime() + 3600000);
      t + dureeMs <= fermeture.getTime() && resultats.length < maxResultats;
      t += 30 * 60000
    ) {
      const finCreneau = t + dureeMs;
      const chevauche = plages.some(
        (p) => t < p.fin + margeMs && finCreneau + margeMs > p.debut
      );
      if (!chevauche) {
        resultats.push({
          debut: new Date(t).toISOString(),
          fin: new Date(finCreneau).toISOString(),
        });
        t += dureeMs; // on ne propose pas deux créneaux qui se chevauchent
      }
    }
  }

  return resultats;
}

/** Crée l'événement. Renvoie l'id Google, ou lève si la création échoue. */
export async function creerRendezVous(opts: {
  refreshToken: string;
  calendarId: string;
  debut: string;
  fin: string;
  titre: string;
  description: string;
  adresse: string;
}): Promise<string> {
  const cal = clientPour(opts.refreshToken);

  const evenement = await cal.events.insert({
    calendarId: opts.calendarId,
    requestBody: {
      summary: opts.titre,
      description: opts.description,
      location: opts.adresse,
      start: { dateTime: opts.debut, timeZone: FUSEAU },
      end: { dateTime: opts.fin, timeZone: FUSEAU },
    },
  });

  const id = evenement.data.id;
  if (!id) throw new Error("Google Calendar n'a pas renvoyé d'identifiant");
  return id;
}
