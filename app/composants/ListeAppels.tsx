"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  listerAppels, messageErreur, optionsEntreprises,
  type Appel, type FiltresAppels, type Page,
} from "@/lib/donnees";
import {
  RESULTAT_APPEL, RESULTAT_INCONNU, TRAITEMENT_APPEL, dureeAppel, libelleProbleme,
} from "@/lib/affichage";
import { dateHeure } from "@/lib/dates";
import Periode, { bornes, periodeInitiale, type ValeurPeriode } from "./Periode";
import { Chargement, EtatVide, Pagination, Puce } from "./Ui";

/**
 * Historique des appels, avec recherche et filtres. Le même composant
 * sert au plombier (son entreprise, par le RLS) et à l'administrateur
 * (toutes les entreprises, avec un filtre de plus).
 */
export default function ListeAppels({
  base, admin = false, entrepriseFixe,
}: {
  base: string;            // préfixe des liens vers le détail : /appels ou /admin/appels
  admin?: boolean;
  entrepriseFixe?: string; // fiche entreprise : filtre imposé
}) {
  const [periode, setPeriode] = useState<ValeurPeriode>(periodeInitiale("7j"));
  const [recherche, setRecherche] = useState("");
  const [rechercheActive, setRechercheActive] = useState("");
  const [resultat, setResultat] = useState("");
  const [traitement, setTraitement] = useState("");
  const [entreprise, setEntreprise] = useState("");
  const [ordre, setOrdre] = useState<"recent" | "ancien">("recent");
  const [page, setPage] = useState(0);

  const [donnees, setDonnees] = useState<Page<Appel> | null>(null);
  const [erreur, setErreur] = useState("");
  const [entreprises, setEntreprises] = useState<{ id: string; nom: string }[]>([]);

  // La recherche part après une courte pause de frappe.
  useEffect(() => {
    const t = setTimeout(() => setRechercheActive(recherche), 300);
    return () => clearTimeout(t);
  }, [recherche]);

  useEffect(() => { setPage(0); },
    [periode, rechercheActive, resultat, traitement, entreprise, ordre]);

  useEffect(() => {
    if (admin && !entrepriseFixe) optionsEntreprises().then(setEntreprises).catch(() => {});
  }, [admin, entrepriseFixe]);

  useEffect(() => {
    let vivant = true;
    setDonnees(null);
    const f: FiltresAppels = {
      ...bornes(periode), recherche: rechercheActive, resultat, traitement,
      entreprise: entrepriseFixe ?? entreprise, ordre, page,
    };
    listerAppels(f)
      .then((d) => { if (vivant) { setDonnees(d); setErreur(""); } })
      .catch((e) => { if (vivant) { setErreur(messageErreur(e)); setDonnees({ lignes: [], total: 0 }); } });
    return () => { vivant = false; };
  }, [periode, rechercheActive, resultat, traitement, entreprise, entrepriseFixe, ordre, page]);

  const filtresActifs = Boolean(rechercheActive || resultat || traitement || entreprise
    || periode.choix !== "7j");

  function reinitialiser() {
    setPeriode(periodeInitiale("7j"));
    setRecherche(""); setResultat(""); setTraitement(""); setEntreprise("");
  }

  return (
    <>
      <div className="filtres" role="search">
        <div className="filtre filtre-large">
          <label htmlFor="recherche-appels">Rechercher</label>
          <input id="recherche-appels" type="search" placeholder="Nom ou numéro de téléphone"
                 value={recherche} onChange={(e) => setRecherche(e.target.value)} />
        </div>
        <Periode valeur={periode} surChange={setPeriode} id="periode-appels"
                 choix={["aujourdhui", "7j", "30j", "90j", "tout", "perso"]} />
        <div className="filtre">
          <label htmlFor="traitement">Statut</label>
          <select id="traitement" value={traitement} onChange={(e) => setTraitement(e.target.value)}>
            <option value="">Tous</option>
            {Object.entries(TRAITEMENT_APPEL).map(([v, l]) =>
              <option key={v} value={v}>{l.libelle}</option>)}
          </select>
        </div>
        <div className="filtre">
          <label htmlFor="resultat">Résultat</label>
          <select id="resultat" value={resultat} onChange={(e) => setResultat(e.target.value)}>
            <option value="">Tous</option>
            {Object.entries(RESULTAT_APPEL).map(([v, l]) =>
              <option key={v} value={v}>{l.libelle}</option>)}
            <option value="inconnu">{RESULTAT_INCONNU.libelle}</option>
          </select>
        </div>
        {admin && !entrepriseFixe && (
          <div className="filtre">
            <label htmlFor="entreprise-appels">Entreprise</label>
            <select id="entreprise-appels" value={entreprise} onChange={(e) => setEntreprise(e.target.value)}>
              <option value="">Toutes</option>
              {entreprises.map((x) => <option key={x.id} value={x.id}>{x.nom}</option>)}
            </select>
          </div>
        )}
        <div className="filtre">
          <label htmlFor="ordre-appels">Tri</label>
          <select id="ordre-appels" value={ordre}
                  onChange={(e) => setOrdre(e.target.value as "recent" | "ancien")}>
            <option value="recent">Récents d&apos;abord</option>
            <option value="ancien">Anciens d&apos;abord</option>
          </select>
        </div>
      </div>

      <div className="resume-liste">
        <span className="discret" aria-live="polite">
          {donnees ? `${donnees.total} appel${donnees.total > 1 ? "s" : ""}` : "Chargement…"}
        </span>
        {filtresActifs && (
          <button type="button" className="lien-bouton" onClick={reinitialiser}>
            Réinitialiser les filtres
          </button>
        )}
      </div>

      {erreur && <p className="encart-erreur" role="alert">{erreur}</p>}

      {!donnees ? <Chargement /> : donnees.lignes.length === 0 ? (
        <EtatVide titre="Aucun appel ne correspond à ces critères.">
          {filtresActifs
            ? "Élargissez la période ou retirez un filtre."
            : "Les appels pris par l'assistant apparaîtront ici."}
        </EtatVide>
      ) : (
        <div className="tableau-cadre">
          <table className="tableau">
            <thead>
              <tr>
                <th scope="col">Appelant</th>
                <th scope="col">Date</th>
                {admin && !entrepriseFixe && <th scope="col">Entreprise</th>}
                <th scope="col">Motif</th>
                <th scope="col">Résumé</th>
                <th scope="col">Statut</th>
                <th scope="col">Résultat</th>
              </tr>
            </thead>
            <tbody>
              {donnees.lignes.map((a) => (
                <tr key={a.id}>
                  <td data-libelle="Appelant">
                    <Link href={`${base}/${a.id}`} className="lien-ligne">
                      {a.nom_appelant ?? "Appelant inconnu"}
                    </Link>
                    <span className="sous-ligne tabulaire">{a.numero_appelant ?? "Numéro masqué"}</span>
                  </td>
                  <td data-libelle="Date" className="tabulaire sans-retour">
                    {dateHeure(a.date_appel)}
                    <span className="sous-ligne">{dureeAppel(a.duree_s)}</span>
                  </td>
                  {admin && !entrepriseFixe && (
                    <td data-libelle="Entreprise">
                      {a.entreprise_nom}
                      {a.demo && <span className="puce" data-ton="attenue" data-sans-point="true">Démo</span>}
                    </td>
                  )}
                  <td data-libelle="Motif">{libelleProbleme(a.motif)}</td>
                  <td data-libelle="Résumé" className="cellule-resume">
                    <span>{a.resume ?? "Pas de résumé"}</span>
                  </td>
                  <td data-libelle="Statut"><Puce l={TRAITEMENT_APPEL[a.traitement]} /></td>
                  <td data-libelle="Résultat">
                    <Puce l={a.resultat ? RESULTAT_APPEL[a.resultat] ?? RESULTAT_INCONNU : RESULTAT_INCONNU} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {donnees && <Pagination page={page} total={donnees.total} surPage={setPage} />}
    </>
  );
}
