import type { AppointmentState } from "@/lib/types";

/** Style des rendez-vous dans le calendrier. */
export const EVENT_STYLE: Record<AppointmentState, { block: string; dot: string; dashed: boolean }> = {
  confirme: { block: "bg-emerald-50 border-emerald-500 text-emerald-950", dot: "bg-emerald-500", dashed: false },
  realise: { block: "bg-stone-100 border-stone-400 text-stone-600", dot: "bg-stone-400", dashed: false },
  annule: { block: "bg-stone-50 border-stone-300 text-stone-400 line-through", dot: "bg-stone-300", dashed: true },
};

/**
 * Créneau suggéré par Astio, en attente du « oui » du professionnel :
 * pointillés et libellé, pour ne pas dépendre uniquement de la couleur.
 */
export const SUGGESTION_STYLE = {
  block: "bg-sky-50/80 border-sky-500 text-sky-950 border-y border-r border-dashed",
  dot: "bg-sky-500",
};
