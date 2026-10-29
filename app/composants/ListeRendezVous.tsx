"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  changerStatutRdv, listerRendezVous, messageErreur, optionsEntreprises,
  type Page, type RendezVous,
} from "@/lib/donnees";
import { STATUT_RDV, libelleProbleme } from "@/lib/affichage";
import { dateCourte, dateHeure, heureParis } from "@/lib/dates";
import Periode, { bornes, periodeInitiale, type ValeurPeriode } from "./Periode";
import { Champ, Chargement, Dialogue, EtatVide, Message, Pagination, Puce, type Retour } from "./Ui";

/**
 * Rendez-vous, en liste. Le statut affiché vient de la base
 * (v_rendez_vous.statut_affiche) : un rendez-vous n'apparaît
 * « confirmé » que si la base l'enregistre comme tel.
 */
export default function ListeRendezVous({
  baseAppels, baseDemandes, admin = false, entrepriseFixe, surModification,
}: {
  baseAppels: string;
  baseDemandes?: string;   // espace plombier : lien vers la fiche demande
  admin?: boolean;
  entrepriseFixe?: string;
  surModification?: () => void;
}) {
  const [periode, setPeriode] = useState<ValeurPeriode>(periodeInitiale("a_venir"));
  const [statut, setStatut] = useState("");
  const [origine, setOrigine] = useState<"" | "ia" | "manuel">("");
  const [recherche, setRecherche] = useState("");
  const [rechercheActive, setRechercheActive] = useState("");
  const [entreprise, setEntreprise] = useState("");
  const [page, setPage] = useState(0);
  const [entreprises, setEntreprises] = useState<{ id: string; nom: string }[]>([]);

  const [donnees, setDonnees] = useState<Page<RendezVous> | null>(null);
  const [erreur, setErreur] = useState("");
  const [retour, setRetour] = useState<Retour>(null);
  const [version, setVersion] = useState(0);
  const [envoi, setEnvoi] = useState(false);
  const [annulation, setAnnulation] = useState<RendezVous | null>(null);
  const [motif, setMotif] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setRechercheActive(recherche), 300);
    return () => clearTimeout(t);
  }, [recherche]);

  useEffect(() => { setPage(0); }, [periode, statut, origine, rechercheActive, entreprise]);

  useEffect(() => {
    if (admin && !entrepriseFixe) optionsEntreprises().then(setEntreprises).catch(() => {});
  }, [admin, entrepriseFixe]);

  useEffect(() => {
    let vivant = true;
    listerRendezVous({
      ...bornes(periode), statut, origine, recherche: rechercheActive,
      entreprise: entrepriseFixe ?? entreprise,
      ordre: periode.choix === "a_venir" ? "chrono" : "inverse", page,
    })
      .then((d) => { if (vivant) { setDonnees(d); setErreur(""); } })
      .catch((e) => { if (vivant) { setErreur(messageErreur(e)); setDonnees({ lignes: [], total: 0 }); } });
    return () => { vivant = false; };
  }, [periode, statut, origine, rechercheActive, entreprise, entrepriseFixe, page, version]);

  const fermerMessage = useCallback(() => setRetour(null), []);

  async function agir(r: RendezVous, action: "confirmer" | "terminer" | "annuler", texte: string, m?: string) {
    setEnvoi(true);
    try {
      await changerStatutRdv(r.id, action, m);
      setRetour({ type: "ok", texte });
      setAnnulation(null);
      setVersion((v) => v + 1);
      surModification?.();
    } catch (e) {
      setRetour({ type: "erreur", texte: messageErreur(e) });
    } finally {
      setEnvoi(false);
    }
  }

  const maintenant = Date.now();

  return (
    <>
      <Message retour={retour} fermer={fermerMessage} />

      <div className="filtres" role="search">
        <div className="filtre filtre-large">
          <label htmlFor="recherche-rdv">Rechercher</label>
          <input id="recherche-rdv" type="search" placeholder="Nom ou numéro de téléphone"
                 value={recherche} onChange={(e) => setRecherche(e.target.value)} />
        </div>
        <Periode valeur={periode} surChange={setPeriode} id="periode-rdv"
                 choix={["a_venir", "aujourdhui", "passes", "7j", "30j", "tout", "perso"]} />
        <div className="filtre">
          <label htmlFor="statut-rdv">Statut</label>
          <select id="statut-rdv" value={statut} onChange={(e) => setStatut(e.target.value)}>
            <option value="">Tous</option>
            {Object.entries(STATUT_RDV).map(([v, l]) => <option key={v} value={v}>{l.libelle}</option>)}
          </select>
        </div>
        <div className="filtre">
          <label htmlFor="origine-rdv">Pris par</label>
          <select id="origine-rdv" value={origine}
                  onChange={(e) => setOrigine(e.target.value as "" | "ia" | "manuel")}>
            <option value="">Tous</option>
            <option value="ia">L&apos;assistant IA</option>
            <option value="manuel">Saisis à la main</option>
          </select>
        </div>
        {admin && !entrepriseFixe && (
          <div className="filtre">
            <label htmlFor="entreprise-rdv">Entreprise</label>
            <select id="entreprise-rdv" value={entreprise} onChange={(e) => setEntreprise(e.target.value)}>
              <option value="">Toutes</option>
              {entreprises.map((x) => <option key={x.id} value={x.id}>{x.nom}</option>)}
            </select>
          </div>
        )}
      </div>

      <div className="resume-liste">
        <span className="discret" aria-live="polite">
          {donnees ? `${donnees.total} rendez-vous` : "Chargement…"}
        </span>
      </div>

      {erreur && <p className="encart-erreur" role="alert">{erreur}</p>}

      {!donnees ? <Chargement /> : donnees.lignes.length === 0 ? (
        <EtatVide titre="Aucun rendez-vous pour ces critères.">
          {periode.choix === "a_venir"
            ? "Rien de prévu pour l'instant. Consultez les rendez-vous passés avec le filtre Période."
            : "Élargissez la période ou retirez un filtre."}
        </EtatVide>
      ) : (
        <div className="tableau-cadre">
          <table className="tableau">
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Client</th>
                {admin && !entrepriseFixe && <th scope="col">Entreprise</th>}
                <th scope="col">Intervention</th>
                <th scope="col">Adresse</th>
                <th scope="col">Statut</th>
                <th scope="col"><span className="visuellement-cache">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {donnees.lignes.map((r) => {
                const commence = new Date(r.debut).getTime() <= maintenant;
                const nom = r.nom_client ?? "Client non renseigné";
                return (
                  <tr key={r.id} data-attenue={r.statut_affiche === "annule"}>
                    <td data-libelle="Date" className="tabulaire sans-retour">
                      <strong>{dateCourte(r.debut)}</strong>
                      <span className="sous-ligne">{heureParis(r.debut)} – {heureParis(r.fin)}</span>
                    </td>
                    <td data-libelle="Client">
                      {baseDemandes && r.demande_id
                        ? <Link href={`${baseDemandes}/${r.demande_id}`} className="lien-ligne">{nom}</Link>
                        : <span className="lien-ligne">{nom}</span>}
                      <span className="sous-ligne tabulaire">{r.telephone_client ?? "—"}</span>
                    </td>
                    {admin && !entrepriseFixe && (
                      <td data-libelle="Entreprise">
                        {r.entreprise_nom}
                        <span className="sous-ligne">{r.plombier_nom}</span>
                      </td>
                    )}
                    <td data-libelle="Intervention">
                      {libelleProbleme(r.type_probleme)}
                      <span className="sous-ligne">
                        {r.par_ia ? "Pris par l'assistant IA" : "Saisi à la main"}
                      </span>
                    </td>
                    <td data-libelle="Adresse">
                      {[r.adresse, r.commune].filter(Boolean).join(", ") || <span className="discret">Inconnue</span>}
                    </td>
                    <td data-libelle="Statut">
                      <Puce l={STATUT_RDV[r.statut_affiche]}
                            titre={r.statut_affiche === "annule" && r.motif_annulation ? r.motif_annulation : undefined} />
                      {r.statut_affiche === "confirme" && r.par_ia && r.confirme_par_client && (
                        <span className="sous-ligne">Accepté oralement par le client</span>
                      )}
                    </td>
                    <td data-libelle="Actions" className="cellule-actions">
                      {r.statut_affiche === "en_attente" && (
                        <button className="bouton" data-taille="petit" disabled={envoi}
                                onClick={() => agir(r, "confirmer", `Rendez-vous de ${nom} confirmé.`)}>
                          Confirmer
                        </button>
                      )}
                      {r.statut_affiche === "confirme" && commence && (
                        <button className="bouton" data-taille="petit" disabled={envoi}
                                onClick={() => agir(r, "terminer", `Intervention chez ${nom} marquée terminée.`)}>
                          Terminer
                        </button>
                      )}
                      {(r.statut_affiche === "en_attente" || r.statut_affiche === "confirme") && (
                        <button className="bouton" data-style="nu" data-taille="petit" disabled={envoi}
                                onClick={() => { setMotif(""); setAnnulation(r); }}>
                          Annuler
                        </button>
                      )}
                      {r.appel_id && (
                        <Link href={`${baseAppels}/${r.appel_id}`} className="bouton" data-style="nu" data-taille="petit">
                          Appel d&apos;origine
                        </Link>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {donnees && <Pagination page={page} total={donnees.total} surPage={setPage} />}

      <Dialogue ouvert={annulation !== null} fermer={() => setAnnulation(null)} titre="Annuler le rendez-vous">
        {annulation && (
          <form onSubmit={(e) => {
            e.preventDefault();
            agir(annulation, "annuler", "Rendez-vous annulé.", motif);
          }}>
            <p style={{ marginTop: 0 }}>
              {annulation.nom_client ?? "Client"} · {dateHeure(annulation.debut)}
            </p>
            <p className="encart-info" style={{ marginTop: 0 }}>
              Le client n&apos;est pas prévenu automatiquement
              {annulation.dans_agenda && ", et l'événement reste dans votre agenda Google : pensez à le supprimer"}.
              Le rendez-vous reste consultable avec le statut « Annulé ».
            </p>
            <Champ id="motif-annulation" libelle="Motif (facultatif)">
              <input id="motif-annulation" type="text" maxLength={500} value={motif}
                     onChange={(e) => setMotif(e.target.value)} />
            </Champ>
            <div className="actions" style={{ marginBottom: 0 }}>
              <button className="bouton" data-style="urgent" disabled={envoi}>
                {envoi ? "Annulation…" : "Annuler le rendez-vous"}
              </button>
              <button type="button" className="bouton" data-style="nu" onClick={() => setAnnulation(null)}>
                Garder
              </button>
            </div>
          </form>
        )}
      </Dialogue>
    </>
  );
}
