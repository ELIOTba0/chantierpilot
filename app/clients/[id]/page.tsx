"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  chargerClient, listerRendezVous, messageErreur, type Client, type RendezVous,
} from "@/lib/donnees";
import { STATUT_RDV, libelleProbleme } from "@/lib/affichage";
import { dateCourte, dateHeure } from "@/lib/dates";
import Entete from "../../composants/Entete";
import Garde from "../../composants/Garde";
import ListeAppels from "../../composants/ListeAppels";
import { Chargement, EtatVide, Puce } from "../../composants/Ui";

export default function FicheClient() {
  return <Garde><Entete /><Contenu /></Garde>;
}

function Contenu() {
  const { id } = useParams<{ id: string }>();
  const [c, setC] = useState<Client | null | undefined>(undefined);
  const [rdvs, setRdvs] = useState<RendezVous[] | null>(null);
  const [erreur, setErreur] = useState("");

  useEffect(() => {
    let vivant = true;
    // Le RLS limite v_clients à l'entreprise du compte : un identifiant
    // d'une autre entreprise donne « introuvable », pas une erreur.
    Promise.all([chargerClient(id), listerRendezVous({ client: id, ordre: "inverse" })])
      .then(([client, r]) => { if (vivant) { setC(client); setRdvs(r.lignes); } })
      .catch((e) => { if (vivant) { setErreur(messageErreur(e)); setC(null); } });
    return () => { vivant = false; };
  }, [id]);

  const retourListe = (
    <Link href="/clients" className="retour">
      <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path d="M11.5 5 6.5 10l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Tous les clients
    </Link>
  );

  if (c === undefined) return <main className="page">{retourListe}<Chargement lignes={8} /></main>;
  if (c === null) {
    return (
      <main className="page">
        {retourListe}
        {erreur ? <p className="encart-erreur" role="alert">{erreur}</p>
                : <EtatVide titre="Client introuvable." />}
      </main>
    );
  }

  const adresse = [c.adresse, c.commune].filter(Boolean).join(", ");

  return (
    <main className="page">
      {retourListe}

      <div className="tete-page" style={{ marginTop: ".75rem" }}>
        <div style={{ flex: "1 1 320px", minWidth: 0 }}>
          <h1>{c.nom ?? "Nom non renseigné"}</h1>
          <p className="sous-titre" style={{ marginBottom: 0 }}>
            {c.nb_appels} appel{c.nb_appels > 1 ? "s" : ""} · {c.nb_rdv} rendez-vous
            {c.premier_appel && ` · premier appel le ${dateCourte(c.premier_appel)}`}
          </p>
        </div>
        <div className="rappel-puces">
          {c.rappels_ouverts > 0 && (
            <Link href="/rappels" className="puce" data-ton="urgent">
              {c.rappels_ouverts} rappel{c.rappels_ouverts > 1 ? "s" : ""} en attente
            </Link>
          )}
          {c.telephone && <a className="bouton" data-taille="petit" href={`tel:${c.telephone}`}>Appeler</a>}
        </div>
      </div>

      <div className="bloc" style={{ marginTop: "1.5rem" }}>
        <dl className="grille-faits" style={{ marginTop: 0 }}>
          <div><dt>Téléphone</dt><dd className="tabulaire">{c.telephone ?? "—"}</dd></div>
          <div><dt>Adresse</dt><dd>{adresse || "—"}</dd></div>
          <div><dt>Dernier appel</dt><dd>{c.dernier_appel ? dateHeure(c.dernier_appel) : "Aucun"}</dd></div>
          <div><dt>Prochain rendez-vous</dt><dd>{c.prochain_rdv ? dateHeure(c.prochain_rdv) : "Aucun"}</dd></div>
        </dl>
        {c.notes && <p className="rappel-note">{c.notes}</p>}
      </div>

      <h2>Rendez-vous</h2>
      {rdvs === null ? <Chargement lignes={2} /> : rdvs.length === 0 ? (
        <div className="vide"><p>Aucun rendez-vous pour ce client.</p></div>
      ) : (
        <ul className="liste-simple">
          {rdvs.map((r) => (
            <li key={r.id} className="ligne-entreprise">
              <Link href={r.demande_id ? `/demandes/${r.demande_id}` : "/rendez-vous"}>
                {dateHeure(r.debut)} · {libelleProbleme(r.type_probleme)}
              </Link>
              <Puce l={STATUT_RDV[r.statut_affiche]} />
              {!r.par_ia && <span className="discret">Saisi à la main</span>}
            </li>
          ))}
        </ul>
      )}

      <h2>Appels</h2>
      <ListeAppels base="/appels" clientFixe={c.id} />
    </main>
  );
}
