"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  chargerAppel, listerRappels, mettreAJourRappel, messageErreur, rendezVousDeLAppel,
  type DetailAppel as Detail, type Rappel, type RendezVous,
} from "@/lib/donnees";
import {
  PRIORITE, RESULTAT_APPEL, RESULTAT_INCONNU, STATUT_RAPPEL, STATUT_RDV, TRAITEMENT_APPEL,
  dureeAppel, libelleProbleme, tours,
} from "@/lib/affichage";
import { dateHeure, dateLongue, heureParis } from "@/lib/dates";
import { Chargement, EtatVide, Message, Puce, type Retour } from "./Ui";

const URGENCE: Record<string, string> = { haute: "Urgent", moyenne: "Modérée", basse: "Pas d'urgence" };

/** Détail d'un appel : qui, quand, pourquoi, ce qui en est sorti. */
export default function DetailAppel({
  id, retour, baseRappels, baseDemandes, admin = false,
}: {
  id: string;
  retour: { href: string; libelle: string };
  baseRappels: string;
  baseDemandes?: string;
  admin?: boolean;
}) {
  const [appel, setAppel] = useState<Detail | null | undefined>(undefined);
  const [rappels, setRappels] = useState<Rappel[]>([]);
  const [rdvs, setRdvs] = useState<RendezVous[]>([]);
  const [erreur, setErreur] = useState("");
  const [message, setMessage] = useState<Retour>(null);
  const [tout, setTout] = useState(false);
  const [version, setVersion] = useState(0);
  const [envoi, setEnvoi] = useState(false);

  useEffect(() => {
    let vivant = true;
    (async () => {
      try {
        const a = await chargerAppel(id);
        if (!vivant) return;
        setAppel(a);
        if (!a) return;
        const [r, v] = await Promise.all([
          listerRappels({ appel: id, vue: "tous" }),
          rendezVousDeLAppel(id),
        ]);
        if (!vivant) return;
        setRappels(r.lignes);
        setRdvs(v);
      } catch (e) {
        if (vivant) { setErreur(messageErreur(e)); setAppel(null); }
      }
    })();
    return () => { vivant = false; };
  }, [id, version]);

  const fermer = useCallback(() => setMessage(null), []);

  async function effectue(r: Rappel) {
    setEnvoi(true);
    try {
      await mettreAJourRappel(r.id, "effectue");
      setMessage({ type: "ok", texte: "Rappel marqué comme effectué." });
      setVersion((x) => x + 1);
    } catch (e) {
      setMessage({ type: "erreur", texte: messageErreur(e) });
    } finally {
      setEnvoi(false);
    }
  }

  const lienRetour = (
    <Link href={retour.href} className="retour">
      <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path d="M11.5 5 6.5 10l5 5" stroke="currentColor" strokeWidth="1.8"
              strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {retour.libelle}
    </Link>
  );

  if (appel === undefined) return <main className="page">{lienRetour}<Chargement lignes={8} /></main>;
  if (appel === null) {
    return (
      <main className="page">
        {lienRetour}
        {erreur
          ? <p className="encart-erreur" role="alert">{erreur}</p>
          : <EtatVide titre="Appel introuvable.">Il n&apos;existe pas, ou vous n&apos;avez pas accès à ses données.</EtatVide>}
      </main>
    );
  }

  const echange = appel.transcript ? tours(appel.transcript) : null;
  const visibles = echange ? (tout ? echange : echange.slice(0, 6)) : null;
  const resultat = appel.resultat ? RESULTAT_APPEL[appel.resultat] ?? RESULTAT_INCONNU : RESULTAT_INCONNU;

  return (
    <main className="page">
      {lienRetour}
      <Message retour={message} fermer={fermer} />

      <div className="tete-page" style={{ marginTop: ".75rem" }}>
        <div style={{ flex: "1 1 320px", minWidth: 0 }}>
          <h1>{appel.nom_appelant ?? "Appelant inconnu"}</h1>
          <p className="sous-titre" style={{ marginBottom: 0, textTransform: "capitalize" }}>
            {dateLongue(appel.date_appel)} à {heureParis(appel.date_appel)}
          </p>
        </div>
        <div className="rappel-puces">
          <Puce l={TRAITEMENT_APPEL[appel.traitement]} />
          <Puce l={resultat} />
          {appel.demo && <span className="puce" data-ton="attenue" data-sans-point="true">Démo</span>}
        </div>
      </div>

      <div className="colonnes" style={{ marginTop: "2rem" }}>
        <div className="colonne-large">
          <div className="bloc">
            <dl className="grille-faits">
              <div><dt>Téléphone</dt><dd className="tabulaire">
                {appel.numero_appelant
                  ? <a href={`tel:${appel.numero_appelant.replace(/\s/g, "")}`}>{appel.numero_appelant}</a>
                  : "Numéro masqué"}
              </dd></div>
              <div><dt>Motif</dt><dd>{libelleProbleme(appel.motif)}</dd></div>
              <div><dt>Durée</dt><dd>{dureeAppel(appel.duree_s)}</dd></div>
              {admin && <div><dt>Entreprise</dt><dd>
                {appel.entreprise_id
                  ? <Link href={`/admin/entreprises/${appel.entreprise_id}`}>{appel.entreprise_nom}</Link>
                  : "—"}
              </dd></div>}
              {admin && <div><dt>Plombier</dt><dd>{appel.plombier_nom}</dd></div>}
              {appel.urgence && <div><dt>Urgence</dt><dd>{URGENCE[appel.urgence] ?? appel.urgence}</dd></div>}
            </dl>
          </div>

          <h2>Résumé de la conversation</h2>
          {appel.resume
            ? <p className="citation" style={{ marginTop: 0 }}>{appel.resume}</p>
            : <p className="discret">Aucun résumé disponible pour cet appel.</p>}

          {appel.transcript && (
            <>
              <h2>Transcription</h2>
              {visibles ? (
                <div className="echange">
                  {visibles.map((t, i) => (
                    <div key={i} className="echange-tour" data-qui={t.qui}>
                      <span className="echange-qui">{t.qui === "assistant" ? "Assistant" : "Client"}</span>
                      <span>{t.texte}</span>
                    </div>
                  ))}
                  {echange && echange.length > 6 && (
                    <button type="button" className="lien-bouton" onClick={() => setTout(!tout)}>
                      {tout ? "Réduire l'échange" : `Lire l'échange complet (${echange.length} répliques)`}
                    </button>
                  )}
                </div>
              ) : <div className="transcription">{appel.transcript}</div>}
            </>
          )}
          {appel.enregistrement_url && (
            <p><a href={appel.enregistrement_url} target="_blank" rel="noreferrer">Écouter l&apos;enregistrement</a></p>
          )}
        </div>

        <aside className="colonne-cote">
          <h2 style={{ marginTop: 0 }}>Rendez-vous</h2>
          {rdvs.length === 0 ? (
            <p className="discret">Aucun rendez-vous issu de cet appel.</p>
          ) : (
            <ul className="liste-simple">
              {rdvs.map((r) => (
                <li key={r.id}>
                  <div className="carte-titre">{dateHeure(r.debut)}</div>
                  <div className="carte-bas"><Puce l={STATUT_RDV[r.statut_affiche]} />
                    <span>{[r.adresse, r.commune].filter(Boolean).join(", ")}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <h2>Rappels</h2>
          {rappels.length === 0 ? (
            <p className="discret">Aucun rappel lié à cet appel.</p>
          ) : (
            <ul className="liste-simple">
              {rappels.map((r) => (
                <li key={r.id}>
                  <div className="carte-bas" style={{ marginTop: 0 }}>
                    <Puce l={STATUT_RAPPEL[r.statut]} />
                    {r.priorite && <Puce l={PRIORITE[r.priorite]} />}
                  </div>
                  <p style={{ margin: ".5rem 0" }}>{r.raison}</p>
                  {r.note && <p className="discret" style={{ margin: "0 0 .5rem" }}>{r.note}</p>}
                  {r.ouvert && (
                    <button className="bouton" data-style="plein" data-taille="petit" disabled={envoi}
                            onClick={() => effectue(r)}>
                      Marquer effectué
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          <p><Link href={baseRappels}>Tous les rappels →</Link></p>

          {baseDemandes && appel.demande_id && (
            <p><Link href={`${baseDemandes}/${appel.demande_id}`}>Fiche d&apos;intervention complète →</Link></p>
          )}
        </aside>
      </div>
    </main>
  );
}
