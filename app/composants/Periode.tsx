"use client";

import { aujourdhuiSaisie, debutFenetre, depuisSaisie } from "@/lib/dates";

/**
 * Choix d'une période, en jours calendaires de Paris. Renvoie des
 * bornes ISO : du (inclus) et au (exclu).
 */

export type ChoixPeriode =
  | "aujourdhui" | "7j" | "30j" | "90j" | "tout" | "perso"
  | "a_venir" | "passes";

export const LIBELLES_PERIODE: Record<ChoixPeriode, string> = {
  aujourdhui: "Aujourd'hui",
  "7j": "7 derniers jours",
  "30j": "30 derniers jours",
  "90j": "90 derniers jours",
  tout: "Tout l'historique",
  perso: "Dates choisies…",
  a_venir: "À venir",
  passes: "Passés",
};

export type ValeurPeriode = { choix: ChoixPeriode; du: string; au: string };

export function bornes(v: ValeurPeriode): { du: string | null; au: string | null } {
  const maintenant = new Date().toISOString();
  switch (v.choix) {
    case "aujourdhui": {
      return { du: debutFenetre(1).toISOString(),
               au: depuisSaisie(aujourdhuiSaisie(1))!.toISOString() };
    }
    case "7j": return { du: debutFenetre(7).toISOString(), au: null };
    case "30j": return { du: debutFenetre(30).toISOString(), au: null };
    case "90j": return { du: debutFenetre(90).toISOString(), au: null };
    case "a_venir": return { du: maintenant, au: null };
    case "passes": return { du: null, au: maintenant };
    case "perso": {
      const du = depuisSaisie(v.du);
      const fin = depuisSaisie(v.au);
      // « au » inclus pour l'utilisateur : on s'arrête à minuit le lendemain.
      const au = fin ? new Date(fin.getTime() + 86400000) : null;
      return { du: du?.toISOString() ?? null, au: au ? au.toISOString() : null };
    }
    default: return { du: null, au: null };
  }
}

export default function Periode({
  valeur, surChange, choix, id = "periode",
}: {
  valeur: ValeurPeriode;
  surChange: (v: ValeurPeriode) => void;
  choix: ChoixPeriode[];
  id?: string;
}) {
  return (
    <>
      <div className="filtre">
        <label htmlFor={id}>Période</label>
        <select id={id} value={valeur.choix}
                onChange={(e) => surChange({ ...valeur, choix: e.target.value as ChoixPeriode })}>
          {choix.map((c) => <option key={c} value={c}>{LIBELLES_PERIODE[c]}</option>)}
        </select>
      </div>
      {valeur.choix === "perso" && (
        <>
          <div className="filtre">
            <label htmlFor={`${id}-du`}>Du</label>
            <input id={`${id}-du`} type="date" value={valeur.du}
                   onChange={(e) => surChange({ ...valeur, du: e.target.value })} />
          </div>
          <div className="filtre">
            <label htmlFor={`${id}-au`}>Au</label>
            <input id={`${id}-au`} type="date" value={valeur.au} min={valeur.du || undefined}
                   onChange={(e) => surChange({ ...valeur, au: e.target.value })} />
          </div>
        </>
      )}
    </>
  );
}

export function periodeInitiale(choix: ChoixPeriode): ValeurPeriode {
  return { choix, du: aujourdhuiSaisie(-6), au: aujourdhuiSaisie() };
}
