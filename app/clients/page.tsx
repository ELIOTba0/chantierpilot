"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { listerClients, messageErreur, type Client, type Page } from "@/lib/donnees";
import { dateCourte, dateHeure } from "@/lib/dates";
import Entete from "../composants/Entete";
import Garde from "../composants/Garde";
import { Chargement, EtatVide, Pagination, TetePage } from "../composants/Ui";

/**
 * Les particuliers qui ont appelé l'entreprise. La fiche client se
 * construit à partir des appels : on ne saisit rien ici.
 */
export default function Clients() {
  return <Garde><Entete /><Contenu /></Garde>;
}

function Contenu() {
  const router = useRouter();
  const [recherche, setRecherche] = useState("");
  const [rechercheActive, setRechercheActive] = useState("");
  const [ordre, setOrdre] = useState<"recent" | "nom">("recent");
  const [page, setPage] = useState(0);
  const [donnees, setDonnees] = useState<Page<Client> | null>(null);
  const [erreur, setErreur] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setRechercheActive(recherche), 300);
    return () => clearTimeout(t);
  }, [recherche]);
  useEffect(() => { setPage(0); }, [rechercheActive, ordre]);

  useEffect(() => {
    let vivant = true;
    setDonnees(null);
    listerClients({ recherche: rechercheActive, ordre, page })
      .then((d) => { if (vivant) { setDonnees(d); setErreur(""); } })
      .catch((e) => { if (vivant) { setErreur(messageErreur(e)); setDonnees({ lignes: [], total: 0 }); } });
    return () => { vivant = false; };
  }, [rechercheActive, ordre, page]);

  return (
    <main className="page">
      <TetePage titre="Clients"
                sousTitre="Les personnes qui ont appelé, avec leur historique d'appels et de rendez-vous." />

      <div className="filtres" role="search">
        <div className="filtre filtre-large">
          <label htmlFor="recherche-clients">Rechercher</label>
          <input id="recherche-clients" type="search" placeholder="Nom, numéro, adresse ou commune"
                 value={recherche} onChange={(e) => setRecherche(e.target.value)} />
        </div>
        <div className="filtre">
          <label htmlFor="ordre-clients">Tri</label>
          <select id="ordre-clients" value={ordre} onChange={(e) => setOrdre(e.target.value as "recent" | "nom")}>
            <option value="recent">Dernier appel</option>
            <option value="nom">Nom</option>
          </select>
        </div>
      </div>

      <div className="resume-liste">
        <span className="discret" aria-live="polite">
          {donnees ? `${donnees.total} client${donnees.total > 1 ? "s" : ""}` : "Chargement…"}
        </span>
      </div>

      {erreur && <p className="encart-erreur" role="alert">{erreur}</p>}

      {!donnees ? <Chargement /> : donnees.lignes.length === 0 ? (
        <EtatVide titre={rechercheActive ? "Aucun client ne correspond." : "Aucun client pour l'instant."}>
          {rechercheActive
            ? "Essayez avec une partie du nom ou les derniers chiffres du numéro."
            : "Chaque appelant identifié par l'assistant apparaîtra ici."}
        </EtatVide>
      ) : (
        <div className="tableau-cadre">
          <table className="tableau">
            <thead>
              <tr>
                <th scope="col">Client</th>
                <th scope="col">Adresse</th>
                <th scope="col">Dernier appel</th>
                <th scope="col">Prochain rendez-vous</th>
                <th scope="col" className="nombre">Appels</th>
                <th scope="col" className="nombre">Rappels</th>
              </tr>
            </thead>
            <tbody>
              {donnees.lignes.map((c) => (
                <tr key={c.id} className="ligne-cliquable"
                    onClick={(ev) => {
                      if ((ev.target as HTMLElement).closest("a")) return;
                      router.push(`/clients/${c.id}`);
                    }}>
                  <td data-libelle="Client">
                    <Link href={`/clients/${c.id}`} className="lien-ligne">{c.nom ?? "Nom non renseigné"}</Link>
                    <span className="sous-ligne tabulaire">{c.telephone ?? "Numéro inconnu"}</span>
                  </td>
                  <td data-libelle="Adresse">
                    {[c.adresse, c.commune].filter(Boolean).join(", ") || "—"}
                  </td>
                  <td data-libelle="Dernier appel" className="tabulaire sans-retour">
                    {c.dernier_appel ? dateHeure(c.dernier_appel) : "—"}
                  </td>
                  <td data-libelle="Prochain RDV" className="tabulaire sans-retour">
                    {c.prochain_rdv ? dateHeure(c.prochain_rdv) : "Aucun"}
                  </td>
                  <td data-libelle="Appels" className="nombre tabulaire">
                    {c.nb_appels}
                    <span className="sous-ligne">depuis le {dateCourte(c.premier_appel ?? c.cree_le)}</span>
                  </td>
                  <td data-libelle="Rappels" className="nombre tabulaire">
                    {c.rappels_ouverts > 0
                      ? <span className="puce" data-ton="urgent">{c.rappels_ouverts}</span>
                      : "0"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {donnees && <Pagination page={page} total={donnees.total} surPage={setPage} />}
    </main>
  );
}
