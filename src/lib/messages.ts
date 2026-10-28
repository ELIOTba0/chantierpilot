import type { Settings } from "./types";
import { formatLongDay, formatPhone, formatTime } from "./format";

/**
 * Modèles des SMS qu'Astio enverrait au client après une décision du
 * professionnel. Dans ce prototype, aucun message n'est réellement envoyé.
 */

type Profile = Settings["profile"];

function greeting(name: string) {
  const short = name.replace(/^(M\.|Mme)\s+/, "");
  return `Bonjour ${short}`;
}

function signature(profile: Profile) {
  return `${profile.company} (${formatPhone(profile.phone)})`;
}

export function confirmationSms(name: string, start: string, end: string, profile: Profile) {
  return `${greeting(name)}, votre intervention est confirmée le ${formatLongDay(start).toLowerCase()} entre ${formatTime(start)} et ${formatTime(end)}. ${signature(profile)}`;
}

export function rescheduleSms(name: string, start: string, end: string, profile: Profile) {
  return `${greeting(name)}, votre rendez-vous est déplacé au ${formatLongDay(start).toLowerCase()} entre ${formatTime(start)} et ${formatTime(end)}. ${signature(profile)}`;
}

export function cancellationSms(name: string, start: string, profile: Profile) {
  return `${greeting(name)}, votre rendez-vous du ${formatLongDay(start).toLowerCase()} à ${formatTime(start)} est annulé. Nous revenons vers vous rapidement. ${signature(profile)}`;
}

export function declineSms(name: string, profile: Profile) {
  return `${greeting(name)}, nous ne pourrons malheureusement pas donner suite à votre demande. Merci de votre confiance. ${signature(profile)}`;
}
