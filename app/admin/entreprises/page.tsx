"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { listerEntreprises, messageErreur, type Entreprise, type Page } from "@/lib/donnees";
import { STATUT_ENTREPRISE } from "@/lib/affichage";
import { dateCourte } from "@/lib/dates";
import Entete from "../../composants/Entete";
import Garde from "../../composants/Garde";
import { FormulaireEntreprise } from "../../composants/Formulaires";
import { Chargement, Dialogue, EtatVide, Pagination, Puce, TetePage } from "../../composants/Ui";

export default function Entreprises() {
  return <Garde espace="admin"><Entete /><Contenu /></Garde>;
}

function Contenu() {
  const router = useRouter();
  const [recherche, setRecherche] = useState("");
  const [rechercheActive, setRechercheActive] = useState("");
  const [statut, setStatut] = useState("");
  const [page, setPage] = useState(0);
  const [donnees, setDonnees] = useState<Page<Entreprise> | null>(null);
  const [erreur, setErreur] = useState("");
  const [creation, setCreation] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setRechercheActive(recherche), 300);
    return () => clearTimeout(t);
  }, [recherche]);
  useEffect(() => { setPage(0); }, [rechercheActive, statut]);

  useEffect(() => {
    let vivant = true;
    listerEntreprises({ recherche: rechercheActive, statut, page })
      .then((d) => { if (vivant) { setDonnees(d); setErreur(""); } })
      .catch((e) => { if (vivant) { setErreur(messageErreur(e)); setDonnees({ lignes: [], total: 0 }); } });
    return () => { vivant = false; };
  }, [rechercheActive, statut, page]);

  return (
    <main className="page">
      <TetePage titre="Entreprises clientes"
                sousTitre="Toutes les entreprises de plomberie inscrites. Cliquez sur une entreprise pour ouvrir sa fiche.">
        <button className="bouton" data-style="plein" onClick={() => setCreation(true)}>
          Nouvelle entreprise
        </button>
      </TetePage>

      <div className="filtres" role="search">
        <div className="filtre filtre-large">
          <label htmlFor="recherche-entreprises">Rechercher</label>
          <input id="recherche-entreprises" type="search" placeholder="Nom, contact, e-mail ou ville"
                 value={recherche} onChange={(e) => setRecherche(e.target.value)} />
        </div>
        <div className="filtre">
          <label htmlFor="statut-entreprise">Statut</label>
          <select id="statut-entreprise" value={statut} onChange={(e) => setStatut(e.target.value)}>
            <option value="">Tous</option>
            {Object.entries(STATUT_ENTREPRISE).map(([k, l]) => <option key={k} value={k}>{l.libelle}</option>)}
          </select>
        </div>
      </div>

      <div className="resume-liste">
        <span className="discret" aria-live="polite">
          {donnees ? `${donnees.total} entreprise${donnees.total > 1 ? "s" : ""}` : "Chargement…"}
        </span>
      </div>

      {erreur && <p className="encart-erreur" role="alert">{erreur}</p>}

      {!donnees ? <Chargement /> : donnees.lignes.length === 0 ? (
        <EtatVide titre="Aucune entreprise ne correspond.">Modifiez la recherche ou le filtre de statut.</EtatVide>
      ) : (
        <div className="tableau-cadre">
          <table className="tableau">
            <thead>
              <tr>
                <th scope="col">Entreprise</th>
                <th scope="col">Contact principal</th>
                <th scope="col">Coordonnées</th>
                <th scope="col">Client depuis</th>
                <th scope="col">Statut</th>
                <th scope="col" className="nombre">Appels</th>
                <th scope="col" className="nombre">Rendez-vous</th>
                <th scope="col" className="nombre">Rappels</th>
              </tr>
            </thead>
            <tbody>
              {donnees.lignes.map((e) => (
                <tr key={e.id} className="ligne-cliquable"
                    onClick={(ev) => {
                      if ((ev.target as HTMLElement).closest("a")) return;
                      router.push(`/admin/entreprises/${e.id}`);
                    }}>
                  <td data-libelle="Entreprise">
                    <Link href={`/admin/entreprises/${e.id}`} className="lien-ligne">{e.nom}</Link>
                    <span className="sous-ligne">
                      {e.ville ?? "Ville non renseignée"}
                      {e.demo && <span className="puce" data-ton="attenue" data-sans-point="true">Démo</span>}
                    </span>
                  </td>
                  <td data-libelle="Contact">{e.contact_nom ?? e.titulaire_nom ?? "—"}</td>
                  <td data-libelle="Coordonnées">
                    {e.email ?? "—"}
                    <span className="sous-ligne tabulaire">{e.telephone ?? ""}</span>
                  </td>
                  <td data-libelle="Client depuis" className="tabulaire">{dateCourte(e.cree_le)}</td>
                  <td data-libelle="Statut"><Puce l={STATUT_ENTREPRISE[e.statut]} /></td>
                  <td data-libelle="Appels" className="nombre tabulaire">
                    {e.nb_appels}<span className="sous-ligne">{e.nb_appels_7j} sur 7 j</span>
                  </td>
                  <td data-libelle="Rendez-vous" className="nombre tabulaire">{e.nb_rdv}</td>
                  <td data-libelle="Rappels" className="nombre tabulaire">
                    {e.nb_rappels_ouverts > 0
                      ? <span className="puce" data-ton="urgent">{e.nb_rappels_ouverts}</span>
                      : "0"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {donnees && <Pagination page={page} total={donnees.total} surPage={setPage} />}

      <Dialogue ouvert={creation} fermer={() => setCreation(false)} titre="Nouvelle entreprise">
        <FormulaireEntreprise entreprise={null} surAnnule={() => setCreation(false)}
                              surEnregistre={(id) => router.push(`/admin/entreprises/${id}`)} />
      </Dialogue>
    </main>
  );
}
