"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  chargerIndicateursPlateforme, listerAppels, listerEntreprises, messageErreur,
  type Appel, type Entreprise, type IndicateursPlateforme,
} from "@/lib/donnees";
import {
  RESULTAT_APPEL, RESULTAT_INCONNU, STATUT_ENTREPRISE, libelleProbleme,
} from "@/lib/affichage";
import { dateHeure } from "@/lib/dates";
import Entete from "../composants/Entete";
import Garde, { useSession } from "../composants/Garde";
import { Chargement, Indicateur, Indicateurs, Puce, TetePage } from "../composants/Ui";

export default function AccueilAdmin() {
  return <Garde espace="admin"><Entete /><Contenu /></Garde>;
}

function Contenu() {
  const session = useSession();
  const [c, setC] = useState<IndicateursPlateforme | null>(null);
  const [recents, setRecents] = useState<Appel[] | null>(null);
  const [actives, setActives] = useState<Entreprise[] | null>(null);
  const [erreur, setErreur] = useState("");

  useEffect(() => {
    Promise.all([
      chargerIndicateursPlateforme(),
      listerAppels({ ordre: "recent" }),
      listerEntreprises({ ordre: "activite" }),
    ]).then(([i, a, e]) => {
      setC(i);
      setRecents(a.lignes.slice(0, 8));
      setActives(e.lignes.filter((x) => x.statut !== "resilie").slice(0, 6));
    }).catch((e) => setErreur(messageErreur(e)));
  }, []);

  // Ce qui mérite qu'on s'y arrête, du plus grave au moins grave.
  const attention = c ? [
    c.webhooks_en_erreur_7j > 0 && {
      texte: `${c.webhooks_en_erreur_7j} événement${c.webhooks_en_erreur_7j > 1 ? "s" : ""} Retell en erreur cette semaine`,
      detail: "Appels reçus mais mal enregistrés : voir la table evenements_webhook.",
      ton: "urgent" as const,
    },
    c.rappels_en_retard > 0 && {
      texte: `${c.rappels_en_retard} rappel${c.rappels_en_retard > 1 ? "s" : ""} en retard`,
      detail: "Des clients attendent un rappel dont l'échéance est passée.",
      href: "/admin/rappels", ton: "urgent" as const,
    },
    c.entreprises_sans_appel_7j > 0 && {
      texte: `${c.entreprises_sans_appel_7j} entreprise${c.entreprises_sans_appel_7j > 1 ? "s" : ""} active${c.entreprises_sans_appel_7j > 1 ? "s" : ""} sans appel depuis 7 jours`,
      detail: "Ligne mal configurée, ou assistant non utilisé ?",
      href: "/admin/entreprises",
    },
    c.entreprises_suspendues > 0 && {
      texte: `${c.entreprises_suspendues} entreprise${c.entreprises_suspendues > 1 ? "s" : ""} suspendue${c.entreprises_suspendues > 1 ? "s" : ""}`,
      href: "/admin/entreprises",
    },
    c.plombiers_sans_compte > 0 && {
      texte: `${c.plombiers_sans_compte} plombier${c.plombiers_sans_compte > 1 ? "s" : ""} ne s'${c.plombiers_sans_compte > 1 ? "sont" : "est"} jamais connecté${c.plombiers_sans_compte > 1 ? "s" : ""}`,
      href: "/admin/comptes",
    },
  ].filter(Boolean) as { texte: string; detail?: string; href?: string; ton?: "urgent" }[] : [];

  return (
    <main className="page">
      <TetePage titre="Vue d'ensemble"
                sousTitre={`Bonjour ${session.admin?.nom ?? ""}. L'activité de toutes les entreprises clientes.`} />

      {erreur && <p className="encart-erreur" role="alert">{erreur}</p>}

      <Indicateurs>
        <Indicateur titre="Entreprises clientes" valeur={c?.entreprises_total ?? null}
                    detail={c ? `${c.entreprises_actives} actives · ${c.plombiers_actifs} plombiers` : undefined}
                    href="/admin/entreprises" />
        <Indicateur titre="Appels" valeur={c?.appels_7j ?? null} detail="7 derniers jours" href="/admin/appels" />
        <Indicateur titre="RDV pris par l'IA" valeur={c?.rdv_ia_7j ?? null}
                    detail={c ? `7 derniers jours · ${c.rdv_a_venir} à venir` : undefined} href="/admin/rendez-vous" />
        <Indicateur titre="Rappels en attente" valeur={c?.rappels_en_attente ?? null}
                    detail={c ? (c.rappels_en_retard > 0 ? `dont ${c.rappels_en_retard} en retard` : "aucun en retard") : undefined}
                    href="/admin/rappels" ton={c && c.rappels_en_retard > 0 ? "urgent" : undefined} />
      </Indicateurs>

      <div className="colonnes">
        <div className="colonne-large">
          <h2 style={{ marginTop: 0 }}>Activité récente</h2>
          {!recents ? <Chargement /> : recents.length === 0 ? (
            <div className="vide"><p>Aucun appel ces 7 derniers jours.</p></div>
          ) : (
            <div className="liste">
              {recents.map((a) => (
                <Link key={a.id} href={`/admin/appels/${a.id}`} className="carte" style={{ display: "block" }}>
                  <div className="carte-haut">
                    <span className="carte-titre">{a.entreprise_nom}</span>
                    <span className="carte-quand">{dateHeure(a.date_appel)}</span>
                  </div>
                  <div className="carte-desc">
                    {a.nom_appelant ?? "Appelant inconnu"} · {libelleProbleme(a.motif)}
                  </div>
                  <div className="carte-bas">
                    <Puce l={a.resultat ? RESULTAT_APPEL[a.resultat] ?? RESULTAT_INCONNU : RESULTAT_INCONNU} />
                  </div>
                </Link>
              ))}
            </div>
          )}
          <p><Link href="/admin/appels">Tous les appels →</Link></p>
        </div>

        <aside className="colonne-cote">
          <h2 style={{ marginTop: 0 }}>Points d&apos;attention</h2>
          {!c ? <Chargement lignes={3} /> : attention.length === 0 ? (
            <div className="encadre">Rien à signaler.</div>
          ) : (
            <ul className="liste-attention">
              {attention.map((x) => (
                <li key={x.texte} data-ton={x.ton}>
                  {x.href ? <Link href={x.href}>{x.texte}</Link> : <strong>{x.texte}</strong>}
                  {x.detail && <span className="discret">{x.detail}</span>}
                </li>
              ))}
            </ul>
          )}

          <h2>Entreprises les plus actives</h2>
          {!actives ? <Chargement lignes={3} /> : (
            <ul className="liste-simple">
              {actives.map((e) => (
                <li key={e.id} className="ligne-entreprise">
                  <Link href={`/admin/entreprises/${e.id}`}>{e.nom}</Link>
                  <span className="discret tabulaire">{e.nb_appels_7j} appels</span>
                  <Puce l={STATUT_ENTREPRISE[e.statut]} />
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    </main>
  );
}
