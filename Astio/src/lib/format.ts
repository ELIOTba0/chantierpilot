const LOCALE = "fr-FR";

const timeFmt = new Intl.DateTimeFormat(LOCALE, { hour: "2-digit", minute: "2-digit" });
const dayFmt = new Intl.DateTimeFormat(LOCALE, { weekday: "long", day: "numeric", month: "long" });
const shortDayFmt = new Intl.DateTimeFormat(LOCALE, { weekday: "short", day: "numeric", month: "short" });
const dateFmt = new Intl.DateTimeFormat(LOCALE, { day: "numeric", month: "short", year: "numeric" });

const MINUTE = 60_000;
const DAY = 86_400_000;

export function startOfDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export function isSameDay(a: Date | string, b: Date | string): boolean {
  return startOfDay(new Date(a)).getTime() === startOfDay(new Date(b)).getTime();
}

/** Clé AAAA-MM-JJ en heure locale. */
export function dayKey(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function formatTime(iso: string): string {
  return timeFmt.format(new Date(iso));
}

export function formatTimeRange(start: string, end: string): string {
  return `${formatTime(start)} – ${formatTime(end)}`;
}

export function formatLongDay(d: Date | string): string {
  return capitalize(dayFmt.format(new Date(d)));
}

export function formatShortDay(d: Date | string): string {
  return capitalize(shortDayFmt.format(new Date(d)));
}

export function formatDate(d: Date | string): string {
  return dateFmt.format(new Date(d));
}

/** « Aujourd'hui », « Hier », « Demain » ou la date courte. */
export function formatRelativeDay(iso: string, now: number): string {
  const diff = Math.round(
    (startOfDay(new Date(iso)).getTime() - startOfDay(new Date(now)).getTime()) / DAY,
  );
  if (diff === 0) return "Aujourd'hui";
  if (diff === -1) return "Hier";
  if (diff === 1) return "Demain";
  return formatShortDay(iso);
}

/** « Aujourd'hui, 09:42 » / « Hier, 17:05 » / « Lun. 26 oct., 10:00 ». */
export function formatDayTime(iso: string, now: number): string {
  return `${formatRelativeDay(iso, now)}, ${formatTime(iso)}`;
}

export function formatAgo(iso: string, now: number): string {
  const minutes = Math.round((now - new Date(iso).getTime()) / MINUTE);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24 && isSameDay(iso, new Date(now))) return `il y a ${hours} h`;
  return formatDayTime(iso, now);
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, "0")}`;
}

export function formatCallDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m} min ${String(s).padStart(2, "0")} s`;
}

export function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.replace(/(\d{2})(?=\d)/g, "$1 ").trim();
}

export function initials(name: string): string {
  return name
    .replace(/^(M\.|Mme|Mlle)\s+/i, "")
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join("");
}
