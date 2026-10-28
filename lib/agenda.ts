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
type Plage = { debut: number; fin: number };

/**
 * Lit les plages occupées de l'agenda.
 *
 * On passe par events.list et non par freebusy.query : freebusy exige
 * une habilitation plus large (calendar.readonly ou calendar.freebusy)
 * alors que events.list se contente de calendar.events, la seule que
 * le plombier nous a accordée. Moins de permissions demandées, c'est
 * aussi plus facile à défendre face à un artisan.
 */
async function plagesOccupees(
  cal: calendar_v3.Calendar,
  calendarId: string,
  debut: Date,
  fin: Date
): Promise<Plage[]> {
  const r = await cal.events.list({
    calendarId,
    timeMin: debut.toISOString(),
    timeMax: fin.toISOString(),
    singleEvents: true,          // développe les événements récurrents
    orderBy: "startTime",
    maxResults: 250,
    timeZone: FUSEAU,
  });

  const plages: Plage[] = [];

  for (const e of r.data.items ?? []) {
    // Événement marqué « disponible » : ne bloque pas le plombier.
    if (e.transparency === "transparent") continue;
    // Invitation refusée : il n'y va pas.
    const moi = e.attendees?.find((a) => a.self);
    if (moi?.responseStatus === "declined") continue;

    if (e.start?.dateTime && e.end?.dateTime) {
      plages.push({
        debut: new Date(e.start.dateTime).getTime(),
        fin: new Date(e.end.dateTime).getTime(),
      });
    } else if (e.start?.date && e.end?.date) {
      // Journée entière : bloque toute la période.
      plages.push({
        debut: new Date(`${e.start.date}T00:00:00`).getTime(),
        fin: new Date(`${e.end.date}T00:00:00`).getTime(),
      });
    }
  }

  return plages;
}

/**
 * Arrondit un horaire au prochain quart d'heure rond : :00 ou :30.
 *
 * Sans ça, les créneaux tombent à 14h16 ou 15h46 — personne ne
 * propose un rendez-vous à ces heures-là, et ça s'entend tout de
 * suite au téléphone.
 */
function arrondirAuDemiHeure(ts: number): number {
  const d = new Date(ts);
  const m = d.getMinutes();
  if (m === 0 && d.getSeconds() === 0 && d.getMilliseconds() === 0) return d.getTime();
  if (m < 30) d.setMinutes(30, 0, 0);
  else {
    d.setHours(d.getHours() + 1);
    d.setMinutes(0, 0, 0);
  }
  return d.getTime();
}

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

  const plages = await plagesOccupees(cal, calendarId, maintenant, fin);

  const dureeMs = dureeMin * 60000;
  const margeMs = margeTrajetMin * 60000;
  const resultats: Creneau[] = [];

  // On avance par pas de 30 minutes sur les jours travaillés.
  for (let j = 0; j < joursAChercher && resultats.length < maxResultats; j++) {
    const jour = new Date(maintenant.getTime() + j * 86400000);
    const numeroJour = String(jour.getDay()); // 0 = dimanche
    const plage = horaires[numeroJour];
    if (!plage) continue; // jour non travaillé

    // Plusieurs tranches par jour, séparées par des virgules :
    // « 08:00-12:00, 13:30-18:00 ». Un plombier déjeune, et un
    // rendez-vous à midi trente ne se propose pas.
    for (const tranche of plage.split(",")) {
      if (resultats.length >= maxResultats) break;

      const [debutJour, finJour] = tranche.trim().split("-");
      if (!debutJour || !finJour) continue;

      const [hDeb, mDeb] = debutJour.split(":").map(Number);
      const [hFin, mFin] = finJour.split(":").map(Number);
      if ([hDeb, mDeb, hFin, mFin].some(Number.isNaN)) continue;

      const ouverture = new Date(jour);
      ouverture.setHours(hDeb, mDeb, 0, 0);
      const fermeture = new Date(jour);
      fermeture.setHours(hFin, mFin, 0, 0);

      // Jamais de créneau dans les deux heures qui viennent : le
      // plombier est en intervention et doit finir son chantier.
      const plusTot = arrondirAuDemiHeure(
        Math.max(ouverture.getTime(), maintenant.getTime() + 2 * 3600000)
      );

      for (
        let t = plusTot;
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
          t += dureeMs; // pas deux créneaux qui se chevauchent
        }
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
