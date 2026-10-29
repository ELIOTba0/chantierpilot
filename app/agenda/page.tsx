"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { sb } from "@/lib/supabase-browser";
import { LIBELLES_PROBLEME } from "@/lib/affichage";
import Entete from "../composants/Entete";
import Garde from "../composants/Garde";
import { Erreur, type ErreurPostgrest } from "../composants/Etat";

type Membre = { id: string; nom: string; couleur: string };

type Rdv = {
  id: string;
  debut: string;
  fin: string;
  statut: string;
  origine: string | null;
  assigne_a: string | null;
  demandes: {
    id: string;
    nom_client: string | null;
    type_probleme: string | null;
    commune: string | null;
  } | null;
};

const DEBUT_H = 7;      // première ligne de la grille
const FIN_H = 19;
const PAS = 54;         // hauteur d'une heure, en pixels

const NOMS_JOURS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet",
              "août", "septembre", "octobre", "novembre", "décembre"];

/** Lundi de la semaine contenant d. */
function lundiDe(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const jour = (x.getDay() + 6) % 7;      // 0 = lundi
  x.setDate(x.getDate() - jour);
  return x;
}

/** « #0F6B62 » → « 15, 107, 98 ». Permet de teinter sans connaître
 *  le fond : rgba se compose avec le thème clair comme sombre. */
function rgb(hex: string): string {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
}

function deuxCh(n: number): string { return (n < 10 ? "0" : "") + n; }

export default function Planning() {
  return <Garde><Entete /><Contenu /></Garde>;
}

function Contenu() {
  const [decalage, setDecalage] = useState(0);          // en semaines
  const [membres, setMembres] = useState<Membre[]>([]);
  const [actifs, setActifs] = useState<Record<string, boolean>>({});
  const [rdvs, setRdvs] = useState<Rdv[]>([]);
  const [erreur, setErreur] = useState<ErreurPostgrest>(null);
  const [chargement, setChargement] = useState(true);

  const lundi = useMemo(() => {
    const d = lundiDe(new Date());
    d.setDate(d.getDate() + decalage * 7);
    return d;
  }, [decalage]);

  useEffect(() => {
    (async () => {
      const { data, error } = await sb
        .from("plombiers")
        .select("id, nom, couleur")
        .order("role");
      if (error) { setErreur(error); return; }
      const m = (data as Membre[]) ?? [];
      setMembres(m);
      setActifs(Object.fromEntries(m.map((x) => [x.id, true])));
    })();
  }, []);

  useEffect(() => {
    (async () => {
      setChargement(true);
      const fin = new Date(lundi);
      fin.setDate(fin.getDate() + 7);

      const { data, error } = await sb
        .from("rendez_vous")
        .select("id, debut, fin, statut, origine, assigne_a, demandes(id, nom_client, type_probleme, commune)")
        .gte("debut", lundi.toISOString())
        .lt("debut", fin.toISOString())
        .neq("statut", "annule")
        .order("debut");

      if (error) { setErreur(error); setChargement(false); return; }
      setErreur(null);
      setRdvs((data as unknown as Rdv[]) ?? []);
      setChargement(false);
    })();
  }, [lundi]);

  const couleurDe = (id: string | null) =>
    membres.find((m) => m.id === id)?.couleur ?? "#5A6967";

  const visibles = rdvs.filter(
    (r) => !r.assigne_a || actifs[r.assigne_a] !== false
  );

  const mains = visibles.filter((r) => r.origine === "manuel").length;

  const fin = new Date(lundi);
  fin.setDate(fin.getDate() + 5);

  const auj = new Date().toDateString();

  const heures: number[] = [];
  for (let h = DEBUT_H; h < FIN_H; h++) heures.push(h);

  return (
    <main className="page">

      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end",
                    gap: "1.25rem", marginBottom: "1.25rem" }}>
        <div style={{ flex: "1 1 320px", minWidth: 0 }}>
          <h1 style={{ marginBottom: ".25rem" }}>
            Semaine du {lundi.getDate()} au {fin.getDate()} {MOIS[fin.getMonth()]}
          </h1>
          <p className="sous-titre" style={{ margin: 0 }}>
            {visibles.length} intervention{visibles.length > 1 ? "s" : ""} cette semaine
            {mains > 0 && `, dont ${mains} saisie${mains > 1 ? "s" : ""} à la main`}.
          </p>
        </div>

        <div style={{ display: "flex", gap: ".625rem", flexWrap: "wrap" }}>
          <button className="bouton" style={{ minHeight: 48 }}
                  onClick={() => setDecalage(decalage - 1)}>
            Semaine précédente
          </button>
          {decalage !== 0 && (
            <button className="bouton" style={{ minHeight: 48 }}
                    onClick={() => setDecalage(0)}>
              Cette semaine
            </button>
          )}
          <button className="bouton" style={{ minHeight: 48 }}
                  onClick={() => setDecalage(decalage + 1)}>
            Semaine suivante
          </button>
          <Link className="bouton" style={{ minHeight: 48 }} href="/rendez-vous">
            Vue liste
          </Link>
          <Link className="bouton" data-style="plein" href="/rendez-vous/nouveau"
                style={{ minHeight: 48 }}>
            <svg width="17" height="17" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path d="M10 4.5v11M4.5 10h11" stroke="currentColor" strokeWidth="2"
                    strokeLinecap="round" />
            </svg>
            Ajouter un rendez-vous
          </Link>
        </div>
      </div>

      <Erreur e={erreur} />

      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: ".625rem",
                    padding: "1rem 0 1.125rem", borderTop: "1px solid var(--line)",
                    borderBottom: "1px solid var(--line)", marginBottom: "1.5rem" }}>
        <span className="champ-nom" style={{ marginBottom: 0, marginRight: ".25rem" }}>
          Plombiers
        </span>
        {membres.map((m) => {
          const on = actifs[m.id] !== false;
          return (
            <button key={m.id} type="button"
                    onClick={() => setActifs({ ...actifs, [m.id]: !on })}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: ".5rem",
                      minHeight: 44, padding: "0 .9375rem", borderRadius: 999,
                      fontFamily: "inherit", fontSize: ".875rem", cursor: "pointer",
                      fontWeight: on ? 600 : 500,
                      border: `1px solid ${on ? `rgba(${rgb(m.couleur)}, .45)` : "var(--neutre-bord)"}`,
                      background: on ? `rgba(${rgb(m.couleur)}, .12)` : "var(--surface)",
                      color: on ? "var(--ink)" : "var(--ink-3)",
                    }}>
              <span style={{ width: 9, height: 9, borderRadius: "50%",
                             background: on ? m.couleur : "var(--bord-fort)" }} />
              {m.nom.split(" ")[0]}
            </button>
          );
        })}
        <span className="discret" style={{ marginLeft: "auto", display: "inline-flex",
                                           alignItems: "center", gap: ".5rem" }}>
          <span style={{ display: "inline-block", width: 14, height: 10,
                         borderLeft: "3px dashed var(--ink-2)",
                         borderTop: "1px solid var(--bord-fort)",
                         borderBottom: "1px solid var(--bord-fort)" }} />
          Saisi à la main
        </span>
      </div>

      <div style={{ overflowX: "auto" }}>
        <div style={{ minWidth: 920 }}>

          <div style={{ display: "flex", gap: 8, paddingLeft: 56, marginBottom: 8 }}>
            {NOMS_JOURS.map((nom, i) => {
              const d = new Date(lundi);
              d.setDate(d.getDate() + i);
              const cejour = d.toDateString() === auj;
              return (
                <div key={nom} style={{ flex: "1 1 0", minWidth: 0 }}>
                  <div style={{ fontSize: ".75rem", fontWeight: 600, letterSpacing: ".06em",
                                textTransform: "uppercase",
                                color: cejour ? "var(--accent)" : "var(--ink-2)" }}>
                    {nom}
                  </div>
                  <div style={{ fontSize: "1.375rem", fontWeight: 600, letterSpacing: "-0.02em",
                                fontVariantNumeric: "tabular-nums",
                                color: cejour ? "var(--accent)" : "var(--ink)" }}>
                    {d.getDate()}
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ display: "flex", gap: 8 }}>

            <div style={{ flex: "none", width: 48, position: "relative",
                          height: (FIN_H - DEBUT_H) * PAS }}>
              {heures.map((h) => (
                <div key={h} style={{ position: "absolute", right: 0,
                                      top: (h - DEBUT_H) * PAS - 7,
                                      fontSize: ".75rem", color: "var(--ink-3)",
                                      fontVariantNumeric: "tabular-nums" }}>
                  {deuxCh(h)}:00
                </div>
              ))}
            </div>

            {NOMS_JOURS.map((nom, i) => {
              const d = new Date(lundi);
              d.setDate(d.getDate() + i);
              const cejour = d.toDateString() === auj;
              const duJour = visibles.filter(
                (r) => new Date(r.debut).toDateString() === d.toDateString()
              );

              return (
                <div key={nom} style={{ flex: "1 1 0", minWidth: 0, position: "relative",
                                        height: (FIN_H - DEBUT_H) * PAS, borderRadius: 8,
                                        background: cejour ? "var(--surface)" : "transparent" }}>
                  {heures.concat([FIN_H]).map((h, k) => (
                    <div key={h} style={{ position: "absolute", left: 0, right: 0,
                                          top: k * PAS, height: 1,
                                          background: k % 2 === 0 ? "var(--line)" : "var(--line-2)" }} />
                  ))}

                  {duJour.map((r) => {
                    const deb = new Date(r.debut);
                    const f = new Date(r.fin);
                    const hDeb = deb.getHours() + deb.getMinutes() / 60;
                    const duree = Math.max(0.5, (f.getTime() - deb.getTime()) / 3600000);
                    const c = couleurDe(r.assigne_a);
                    const manuel = r.origine === "manuel";
                    const dem = r.demandes;

                    return (
                      <Link key={r.id}
                            href={dem ? `/demandes/${dem.id}` : "/agenda"}
                            style={{
                              position: "absolute", left: 2, right: 2,
                              top: (hDeb - DEBUT_H) * PAS + 2,
                              height: duree * PAS - 6,
                              boxSizing: "border-box", overflow: "hidden",
                              background: `rgba(${rgb(c)}, .12)`,
                              border: `1px solid rgba(${rgb(c)}, .4)`,
                              borderLeft: `3px ${manuel ? "dashed" : "solid"} ${c}`,
                              borderRadius: 7, padding: "7px 9px",
                              textDecoration: "none", color: "var(--ink)",
                              opacity: r.statut === "propose" ? .75 : 1,
                            }}>
                        <div style={{ fontSize: ".6875rem", fontWeight: 600, color: c,
                                      fontVariantNumeric: "tabular-nums", marginBottom: 3 }}>
                          {deuxCh(deb.getHours())}:{deuxCh(deb.getMinutes())} – {deuxCh(f.getHours())}:{deuxCh(f.getMinutes())}
                          {r.statut === "propose" && " · à confirmer"}
                        </div>
                        <div style={{ fontSize: ".8125rem", fontWeight: 600, lineHeight: 1.3,
                                      marginBottom: 2 }}>
                          {dem?.nom_client ?? LIBELLES_PROBLEME[dem?.type_probleme ?? "autre"]}
                        </div>
                        <div style={{ fontSize: ".75rem", lineHeight: 1.35, color: "var(--ink-2)" }}>
                          {LIBELLES_PROBLEME[dem?.type_probleme ?? "autre"]}
                          {dem?.commune && ` · ${dem.commune}`}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <p className="discret" style={{ marginTop: "1.5rem", maxWidth: "70ch", lineHeight: 1.6 }}>
        {chargement
          ? "Chargement…"
          : "Un créneau ajouté ici devient immédiatement indisponible pour l'assistant téléphonique."}
      </p>
    </main>
  );
}
