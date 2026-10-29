"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { messageErreur, rendezVousDeLaSemaine, type RendezVous } from "@/lib/donnees";
import { STATUT_RDV, libelleProbleme } from "@/lib/affichage";
import { FUSEAU, jourParis, minuitParis } from "@/lib/dates";

/**
 * Semaine de rendez-vous, en heure de Paris. Sert à l'accueil et au
 * Planning. Le style dit le statut sans lire le texte : plein pour
 * confirmé, pointillés pour en attente, grisé pour terminé.
 */

const PAS = 52;                      // hauteur d'une heure, en pixels
const JOURS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const MOIS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.",
              "août", "sept.", "oct.", "nov.", "déc."];

const PARTIES = new Intl.DateTimeFormat("en-CA", {
  timeZone: FUSEAU, year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});

/** Jour (AAAA-MM-JJ) et heure décimale à Paris. */
function aParis(iso: string | Date): { jour: string; h: number } {
  const p = Object.fromEntries(PARTIES.formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return { jour: `${p.year}-${p.month}-${p.day}`, h: Number(p.hour) + Number(p.minute) / 60 };
}

function hhmm(h: number): string {
  const H = Math.floor(h);
  const M = Math.round((h - H) * 60);
  return `${String(H).padStart(2, "0")}:${String(M).padStart(2, "0")}`;
}

/** Lundi de la semaine courante (+ décalage), minuit à Paris. */
export function lundiParis(decalageSemaines = 0): Date {
  const { a, m, j } = jourParis();
  const jourSemaine = (new Date(Date.UTC(a, m - 1, j)).getUTCDay() + 6) % 7;   // 0 = lundi
  return minuitParis(a, m, j - jourSemaine + 7 * decalageSemaines);
}

/**
 * Rendez-vous qui se chevauchent : côte à côte plutôt que superposés.
 * Chaque groupe de créneaux qui se touchent partage sa largeur.
 */
function enColonnes<T extends { debut: number; fin: number }>(liste: T[]) {
  const tries = [...liste].sort((a, b) => a.debut - b.debut || b.fin - a.fin);
  const sortie: (T & { col: number; nbCols: number })[] = [];
  let groupe: (T & { col: number; nbCols: number })[] = [];
  let finGroupe = -1;
  const clore = () => {
    const n = Math.max(1, ...groupe.map((g) => g.col + 1));
    groupe.forEach((g) => { g.nbCols = n; });
    sortie.push(...groupe);
    groupe = [];
  };
  for (const p of tries) {
    if (p.debut >= finGroupe && groupe.length) clore();
    const occupees = new Set(groupe.filter((g) => g.fin > p.debut).map((g) => g.col));
    let col = 0;
    while (occupees.has(col)) col++;
    groupe.push({ ...p, col, nbCols: 1 });
    finGroupe = Math.max(finGroupe, p.fin);
  }
  if (groupe.length) clore();
  return sortie;
}

export default function CalendrierSemaine({
  lien, filtre, couleurDe, actions, surChargement, version = 0,
}: {
  lien: (r: RendezVous) => string;
  filtre?: (r: RendezVous) => boolean;
  couleurDe?: (r: RendezVous) => string | null;
  actions?: React.ReactNode;
  surChargement?: (rdvs: RendezVous[], lundi: Date) => void;
  version?: number;
}) {
  const [decalage, setDecalage] = useState(0);
  const [rdvs, setRdvs] = useState<RendezVous[] | null>(null);
  const [erreur, setErreur] = useState("");
  const [maintenant, setMaintenant] = useState(() => new Date());

  const lundi = useMemo(() => lundiParis(decalage), [decalage]);
  const jours = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const { a, m, j } = jourParis(new Date(lundi.getTime() + i * 86400000 + 12 * 3600000));
    return { cle: `${a}-${String(m).padStart(2, "0")}-${String(j).padStart(2, "0")}`, j, m };
  }), [lundi]);

  useEffect(() => {
    let vivant = true;
    setRdvs(null);
    const fin = lundiParis(decalage + 1);
    rendezVousDeLaSemaine(lundi.toISOString(), fin.toISOString())
      .then((r) => { if (vivant) { setRdvs(r); setErreur(""); surChargement?.(r, lundi); } })
      .catch((e) => { if (vivant) { setErreur(messageErreur(e)); setRdvs([]); } });
    return () => { vivant = false; };
    // surChargement est un rappel du parent : il ne doit pas relancer la requête.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lundi, decalage, version]);

  // La ligne « maintenant » avance toute seule.
  useEffect(() => {
    const t = setInterval(() => setMaintenant(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  const visibles = (rdvs ?? []).filter((r) => !filtre || filtre(r));
  const places = visibles.map((r) => {
    const d = aParis(r.debut);
    const f = aParis(r.fin);
    return { r, jour: d.jour, debut: d.h, fin: f.jour === d.jour ? f.h : 24 };
  });

  // Plage horaire : 7 h – 19 h, élargie si un rendez-vous déborde.
  const debutH = Math.min(7, ...places.map((p) => Math.floor(p.debut)));
  const finH = Math.max(19, ...places.map((p) => Math.ceil(p.fin)));
  const heures = Array.from({ length: finH - debutH }, (_, i) => debutH + i);

  const ici = aParis(maintenant);
  const dernier = jours[6];
  const titre = `${jours[0].j} ${jours[0].m !== dernier.m ? MOIS[jours[0].m - 1] + " " : ""}– ${dernier.j} ${MOIS[dernier.m - 1]}`;

  return (
    <section className="calendrier" aria-label="Rendez-vous de la semaine">
      <div className="calendrier-barre">
        <button type="button" className="bouton" data-taille="petit" onClick={() => setDecalage(0)}
                disabled={decalage === 0}>
          Aujourd&apos;hui
        </button>
        <div className="calendrier-fleches">
          <button type="button" onClick={() => setDecalage(decalage - 1)} aria-label="Semaine précédente">‹</button>
          <button type="button" onClick={() => setDecalage(decalage + 1)} aria-label="Semaine suivante">›</button>
        </div>
        <span className="calendrier-titre">{titre}</span>
        <span className="calendrier-legende" aria-hidden="true">
          <span data-statut="confirme">Confirmé</span>
          <span data-statut="en_attente">À confirmer</span>
          <span data-statut="termine">Réalisé</span>
        </span>
        {actions && <div className="calendrier-actions">{actions}</div>}
      </div>

      {erreur && <p className="encart-erreur" role="alert">{erreur}</p>}

      <div className="calendrier-defile">
        <div className="calendrier-grille" aria-busy={rdvs === null}>
          <div className="calendrier-entete">
            <span />
            {jours.map((d, i) => (
              <span key={d.cle} data-aujourdhui={d.cle === ici.jour}>
                {JOURS[i]} <strong>{d.j}</strong>
              </span>
            ))}
          </div>

          <div className="calendrier-corps" style={{ height: heures.length * PAS }}>
            <div className="calendrier-heures">
              {heures.map((h, k) => (
                <span key={h} style={{ top: k * PAS - 7 }}>{String(h).padStart(2, "0")}:00</span>
              ))}
            </div>

            {jours.map((d) => {
              const duJour = enColonnes(places.filter((p) => p.jour === d.cle));
              const aujourdhui = d.cle === ici.jour;
              return (
                <div key={d.cle} className="calendrier-jour" data-aujourdhui={aujourdhui}>
                  {heures.map((h, k) => (
                    <div key={h} className="calendrier-ligne" style={{ top: k * PAS }} />
                  ))}
                  {aujourdhui && ici.h >= debutH && ici.h <= finH && (
                    <div className="calendrier-maintenant" style={{ top: (ici.h - debutH) * PAS }}
                         aria-label={`Il est ${hhmm(ici.h)}`} />
                  )}
                  {duJour.map(({ r, debut, fin, col, nbCols }) => {
                    const couleur = couleurDe?.(r);
                    const libelle = STATUT_RDV[r.statut_affiche];
                    return (
                      <Link key={r.id} href={lien(r)} className="calendrier-rdv"
                            data-statut={r.statut_affiche} data-manuel={!r.par_ia}
                            style={{
                              top: (debut - debutH) * PAS + 2,
                              height: Math.max(0.5, fin - debut) * PAS - 4,
                              left: `calc(${(100 * col) / nbCols}% + 3px)`,
                              width: `calc(${100 / nbCols}% - 6px)`,
                              ...(couleur ? { borderLeftColor: couleur } : {}),
                            }}
                            title={`${r.nom_client ?? "Client"} · ${hhmm(debut)} – ${hhmm(fin)} · ${libelle.libelle}`}>
                        <span className="calendrier-rdv-nom">{r.nom_client ?? libelleProbleme(r.type_probleme)}</span>
                        <span className="calendrier-rdv-heure">
                          {hhmm(debut)} – {hhmm(fin)}
                          {r.statut_affiche !== "confirme" && ` · ${libelle.libelle}`}
                        </span>
                        {fin - debut >= 1.5 && nbCols === 1 &&
                          <span className="calendrier-rdv-motif">{libelleProbleme(r.type_probleme)}</span>}
                      </Link>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {rdvs !== null && visibles.length === 0 && (
        <p className="discret" style={{ margin: ".75rem 0 0" }}>Aucun rendez-vous cette semaine.</p>
      )}
    </section>
  );
}
