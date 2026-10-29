"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  chargerEntreprise, chargerIndicateurs, listerPlombiers, messageErreur,
  type Entreprise, type Indicateurs as Chiffres, type Plombier,
} from "@/lib/donnees";
import { ROLE_PLOMBIER, STATUT_ENTREPRISE } from "@/lib/affichage";
import { dateCourte, dateHeure } from "@/lib/dates";
import Entete from "../../../composants/Entete";
import Garde from "../../../composants/Garde";
import { FormulaireEntreprise, FormulairePlombier } from "../../../composants/Formulaires";
import ListeAppels from "../../../composants/ListeAppels";
import ListeRappels from "../../../composants/ListeRappels";
import ListeRendezVous from "../../../composants/ListeRendezVous";
import {
  Chargement, Dialogue, EtatVide, Indicateur, Indicateurs, Message, Puce, type Retour,
} from "../../../composants/Ui";

type Onglet = "apercu" | "appels" | "rappels" | "rdv" | "comptes";
const ONGLETS: [Onglet, string][] = [
  ["apercu", "Aperçu"], ["appels", "Appels"], ["rappels", "Rappels"],
  ["rdv", "Rendez-vous"], ["comptes", "Comptes"],
];

export default function FicheEntreprise() {
  return <Garde espace="admin"><Entete /><Contenu /></Garde>;
}

function Contenu() {
  const { id } = useParams<{ id: string }>();
  const [e, setE] = useState<Entreprise | null | undefined>(undefined);
  const [chiffres, setChiffres] = useState<Chiffres | null>(null);
  const [plombiers, setPlombiers] = useState<Plombier[]>([]);
  const [onglet, setOnglet] = useState<Onglet>("apercu");
  const [edition, setEdition] = useState(false);
  const [plombierEdite, setPlombierEdite] = useState<Plombier | null | "nouveau">(null);
  const [retour, setRetour] = useState<Retour>(null);
  const [version, setVersion] = useState(0);
  const [erreur, setErreur] = useState("");

  useEffect(() => {
    let vivant = true;
    Promise.all([chargerEntreprise(id), chargerIndicateurs(id), listerPlombiers(id)])
      .then(([ent, c, p]) => { if (vivant) { setE(ent); setChiffres(c); setPlombiers(p); } })
      .catch((err) => { if (vivant) { setErreur(messageErreur(err)); setE(null); } });
    return () => { vivant = false; };
  }, [id, version]);

  const rafraichir = useCallback(() => setVersion((v) => v + 1), []);
  const fermerMessage = useCallback(() => setRetour(null), []);

  const retourListe = (
    <Link href="/admin/entreprises" className="retour">
      <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path d="M11.5 5 6.5 10l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Toutes les entreprises
    </Link>
  );

  if (e === undefined) return <main className="page">{retourListe}<Chargement lignes={8} /></main>;
  if (e === null) {
    return (
      <main className="page">
        {retourListe}
        {erreur ? <p className="encart-erreur" role="alert">{erreur}</p>
                : <EtatVide titre="Entreprise introuvable." />}
      </main>
    );
  }

  return (
    <main className="page">
      {retourListe}
      <Message retour={retour} fermer={fermerMessage} />

      <div className="tete-page" style={{ marginTop: ".75rem" }}>
        <div style={{ flex: "1 1 320px", minWidth: 0 }}>
          <h1>{e.nom}</h1>
          <p className="sous-titre" style={{ marginBottom: 0 }}>
            {[e.ville, `client depuis le ${dateCourte(e.cree_le)}`].filter(Boolean).join(" · ")}
          </p>
        </div>
        <div className="rappel-puces">
          <Puce l={STATUT_ENTREPRISE[e.statut]} />
          {e.demo && <span className="puce" data-ton="attenue" data-sans-point="true">Démo</span>}
          <button className="bouton" data-taille="petit" onClick={() => setEdition(true)}>Modifier</button>
        </div>
      </div>

      <div className="onglets-vue" role="tablist" aria-label="Sections de la fiche" style={{ marginTop: "1.5rem" }}>
        {ONGLETS.map(([v, l]) => (
          <button key={v} type="button" role="tab" aria-selected={onglet === v} data-actif={onglet === v}
                  onClick={() => setOnglet(v)}>
            {l}
            {v === "rappels" && e.nb_rappels_ouverts > 0 && <span className="compteur">{e.nb_rappels_ouverts}</span>}
          </button>
        ))}
      </div>

      {onglet === "apercu" && (
        <>
          <Indicateurs>
            <Indicateur titre="Appels" valeur={chiffres?.appels_7j ?? null}
                        detail={`7 derniers jours · ${e.nb_appels} au total`} />
            <Indicateur titre="RDV pris par l'IA" valeur={chiffres?.rdv_ia_7j ?? null}
                        detail={`7 derniers jours · ${chiffres?.rdv_a_venir ?? 0} à venir`} />
            <Indicateur titre="Rappels en attente" valeur={chiffres?.rappels_en_attente ?? null}
                        detail={chiffres && chiffres.rappels_en_retard > 0 ? `dont ${chiffres.rappels_en_retard} en retard` : "aucun en retard"}
                        ton={chiffres && chiffres.rappels_en_retard > 0 ? "urgent" : undefined} />
            <Indicateur titre="Appels traités" valeur={chiffres?.appels_traites_7j ?? null} detail="7 derniers jours" />
          </Indicateurs>

          <div className="colonnes">
            <div className="colonne-large">
              <h2 style={{ marginTop: 0 }}>Informations</h2>
              <div className="bloc">
                <dl className="grille-faits">
                  <div><dt>Contact principal</dt><dd>{e.contact_nom ?? e.titulaire_nom ?? "—"}</dd></div>
                  <div><dt>Adresse e-mail</dt><dd>{e.email ? <a href={`mailto:${e.email}`}>{e.email}</a> : "—"}</dd></div>
                  <div><dt>Téléphone</dt><dd className="tabulaire">{e.telephone ?? "—"}</dd></div>
                  <div><dt>Ville</dt><dd>{e.ville ?? "—"}</dd></div>
                  <div><dt>Dernier appel</dt><dd>{e.dernier_appel ? dateHeure(e.dernier_appel) : "Aucun"}</dd></div>
                  <div><dt>Modifiée le</dt><dd>{dateCourte(e.modifie_le)}</dd></div>
                </dl>
              </div>
            </div>
            <aside className="colonne-cote">
              <h2 style={{ marginTop: 0 }}>Comptes ({plombiers.length})</h2>
              <ul className="liste-simple">
                {plombiers.map((p) => (
                  <li key={p.id}>
                    <div className="carte-titre">{p.nom}</div>
                    <div className="carte-bas">
                      <span>{ROLE_PLOMBIER[p.role] ?? p.role}</span>
                      {!p.actif && <span className="puce" data-ton="attenue">Désactivé</span>}
                      {p.actif && !p.auth_user_id && <span className="puce" data-ton="neutre">Jamais connecté</span>}
                    </div>
                  </li>
                ))}
              </ul>
              <button type="button" className="lien-bouton" onClick={() => setOnglet("comptes")}>Gérer les comptes →</button>
            </aside>
          </div>
        </>
      )}

      {onglet === "appels" && <ListeAppels base="/admin/appels" admin entrepriseFixe={e.id} />}
      {onglet === "rappels" && (
        <ListeRappels baseAppels="/admin/appels" admin entrepriseFixe={e.id} surModification={rafraichir} />
      )}
      {onglet === "rdv" && (
        <ListeRendezVous baseAppels="/admin/appels" admin entrepriseFixe={e.id} surModification={rafraichir} />
      )}

      {onglet === "comptes" && (
        <>
          <div className="resume-liste">
            <span className="discret">
              Un compte se connecte avec son adresse e-mail et un code à usage unique. Désactiver un
              compte coupe son accès sans rien effacer.
            </span>
            <button className="bouton" data-style="plein" data-taille="petit"
                    onClick={() => setPlombierEdite("nouveau")}>
              Ajouter un compte
            </button>
          </div>
          {plombiers.length === 0 ? <EtatVide titre="Aucun compte pour cette entreprise." /> : (
            <div className="tableau-cadre">
              <table className="tableau">
                <thead>
                  <tr>
                    <th scope="col">Nom</th><th scope="col">E-mail</th><th scope="col">Téléphone</th>
                    <th scope="col">Rôle</th><th scope="col">Accès</th>
                    <th scope="col"><span className="visuellement-cache">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {plombiers.map((p) => (
                    <tr key={p.id}>
                      <td data-libelle="Nom"><strong>{p.nom}</strong></td>
                      <td data-libelle="E-mail">{p.email}</td>
                      <td data-libelle="Téléphone" className="tabulaire">{p.telephone}</td>
                      <td data-libelle="Rôle">{ROLE_PLOMBIER[p.role] ?? p.role}</td>
                      <td data-libelle="Accès">
                        {!p.actif ? <span className="puce" data-ton="attenue">Désactivé</span>
                          : p.auth_user_id ? <span className="puce" data-ton="accent">Actif</span>
                          : <span className="puce" data-ton="neutre">Jamais connecté</span>}
                      </td>
                      <td data-libelle="Actions" className="cellule-actions">
                        <button className="bouton" data-taille="petit" onClick={() => setPlombierEdite(p)}>
                          Modifier
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      <Dialogue ouvert={edition} fermer={() => setEdition(false)} titre="Modifier l'entreprise">
        <FormulaireEntreprise entreprise={e} surAnnule={() => setEdition(false)}
                              surEnregistre={() => {
                                setEdition(false);
                                setRetour({ type: "ok", texte: "Entreprise enregistrée." });
                                rafraichir();
                              }} />
      </Dialogue>

      <Dialogue ouvert={plombierEdite !== null} fermer={() => setPlombierEdite(null)}
                titre={plombierEdite === "nouveau" ? "Nouveau compte plombier" : "Modifier le compte"}>
        {plombierEdite !== null && (
          <FormulairePlombier plombier={plombierEdite === "nouveau" ? null : plombierEdite}
                              entreprises={[{ id: e.id, nom: e.nom }]} entrepriseParDefaut={e.id}
                              surAnnule={() => setPlombierEdite(null)}
                              surEnregistre={() => {
                                setPlombierEdite(null);
                                setRetour({ type: "ok", texte: "Compte enregistré." });
                                rafraichir();
                              }} />
        )}
      </Dialogue>
    </main>
  );
}
