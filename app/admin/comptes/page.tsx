"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  definirAdministrateur, listerAdministrateurs, listerPlombiers, messageErreur, optionsEntreprises,
  type Administrateur, type Plombier,
} from "@/lib/donnees";
import { ROLE_PLOMBIER } from "@/lib/affichage";
import { dateCourte } from "@/lib/dates";
import Entete from "../../composants/Entete";
import Garde, { useSession } from "../../composants/Garde";
import { FormulairePlombier } from "../../composants/Formulaires";
import { Champ, Chargement, Dialogue, EtatVide, Message, TetePage, type Retour } from "../../composants/Ui";

export default function Comptes() {
  return <Garde espace="admin"><Entete /><Contenu /></Garde>;
}

function Contenu() {
  const session = useSession();
  const [admins, setAdmins] = useState<Administrateur[] | null>(null);
  const [plombiers, setPlombiers] = useState<Plombier[] | null>(null);
  const [entreprises, setEntreprises] = useState<{ id: string; nom: string }[]>([]);
  const [retour, setRetour] = useState<Retour>(null);
  const [version, setVersion] = useState(0);
  const [nouvelAdmin, setNouvelAdmin] = useState(false);
  const [adminSaisi, setAdminSaisi] = useState({ email: "", nom: "" });
  const [plombierEdite, setPlombierEdite] = useState<Plombier | null | "nouveau">(null);
  const [recherche, setRecherche] = useState("");
  const [envoi, setEnvoi] = useState(false);

  useEffect(() => {
    Promise.all([listerAdministrateurs(), listerPlombiers(), optionsEntreprises()])
      .then(([a, p, e]) => { setAdmins(a); setPlombiers(p); setEntreprises(e); })
      .catch((e) => setRetour({ type: "erreur", texte: messageErreur(e) }));
  }, [version]);

  const fermerMessage = useCallback(() => setRetour(null), []);
  const nomEntreprise = useMemo(
    () => Object.fromEntries(entreprises.map((e) => [e.id, e.nom])), [entreprises]);

  async function basculerAdmin(a: Administrateur) {
    const verbe = a.actif ? "Retirer les droits d'administration à" : "Rendre les droits d'administration à";
    if (!confirm(`${verbe} ${a.nom} (${a.email}) ?`)) return;
    setEnvoi(true);
    try {
      await definirAdministrateur(a.email, a.nom, !a.actif);
      setRetour({ type: "ok", texte: a.actif ? "Droits retirés." : "Droits rétablis." });
      setVersion((v) => v + 1);
    } catch (e) {
      setRetour({ type: "erreur", texte: messageErreur(e) });
    } finally {
      setEnvoi(false);
    }
  }

  async function ajouterAdmin(e: React.FormEvent) {
    e.preventDefault();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(adminSaisi.email.trim())) {
      setRetour({ type: "erreur", texte: "Adresse e-mail invalide." });
      return;
    }
    setEnvoi(true);
    try {
      await definirAdministrateur(adminSaisi.email.trim(), adminSaisi.nom.trim(), true);
      setRetour({ type: "ok", texte: `${adminSaisi.email} est administrateur. Il se connecte avec cette adresse.` });
      setNouvelAdmin(false);
      setAdminSaisi({ email: "", nom: "" });
      setVersion((v) => v + 1);
    } catch (err) {
      setRetour({ type: "erreur", texte: messageErreur(err) });
    } finally {
      setEnvoi(false);
    }
  }

  const t = recherche.trim().toLowerCase();
  const plombiersFiltres = (plombiers ?? []).filter((p) => !t ||
    [p.nom, p.email, nomEntreprise[p.entreprise_id ?? ""] ?? ""].some((x) => x.toLowerCase().includes(t)));

  return (
    <main className="page">
      <TetePage titre="Comptes et accès"
                sousTitre="Deux rôles : les administrateurs ChantierPilot voient toute la plateforme ; chaque plombier ne voit que son entreprise. Aucun mot de passe : chacun se connecte avec un code reçu par e-mail." />
      <Message retour={retour} fermer={fermerMessage} />

      <div className="resume-liste" style={{ marginTop: "1rem" }}>
        <h2 style={{ margin: 0 }}>Administrateurs</h2>
        <button className="bouton" data-taille="petit" onClick={() => setNouvelAdmin(true)}>
          Ajouter un administrateur
        </button>
      </div>
      {!admins ? <Chargement lignes={3} /> : (
        <div className="tableau-cadre">
          <table className="tableau">
            <thead>
              <tr><th scope="col">Nom</th><th scope="col">E-mail</th><th scope="col">Depuis</th>
                  <th scope="col">Accès</th><th scope="col"><span className="visuellement-cache">Actions</span></th></tr>
            </thead>
            <tbody>
              {admins.map((a) => {
                const moi = a.email.toLowerCase() === session.email?.toLowerCase();
                return (
                  <tr key={a.id}>
                    <td data-libelle="Nom"><strong>{a.nom}</strong>{moi && <span className="sous-ligne">Vous</span>}</td>
                    <td data-libelle="E-mail">{a.email}</td>
                    <td data-libelle="Depuis" className="tabulaire">{dateCourte(a.cree_le)}</td>
                    <td data-libelle="Accès">
                      {!a.actif ? <span className="puce" data-ton="attenue">Retiré</span>
                        : a.auth_user_id ? <span className="puce" data-ton="accent">Actif</span>
                        : <span className="puce" data-ton="neutre">Jamais connecté</span>}
                    </td>
                    <td data-libelle="Actions" className="cellule-actions">
                      {!moi && (
                        <button className="bouton" data-style="nu" data-taille="petit" disabled={envoi}
                                onClick={() => basculerAdmin(a)}>
                          {a.actif ? "Retirer les droits" : "Rétablir"}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="resume-liste" style={{ marginTop: "2.5rem" }}>
        <h2 style={{ margin: 0 }}>Comptes plombiers</h2>
        <button className="bouton" data-taille="petit" onClick={() => setPlombierEdite("nouveau")}
                disabled={entreprises.length === 0}>
          Ajouter un compte
        </button>
      </div>
      <div className="filtres">
        <div className="filtre filtre-large">
          <label htmlFor="recherche-comptes">Rechercher</label>
          <input id="recherche-comptes" type="search" placeholder="Nom, e-mail ou entreprise"
                 value={recherche} onChange={(e) => setRecherche(e.target.value)} />
        </div>
      </div>
      {!plombiers ? <Chargement /> : plombiersFiltres.length === 0 ? (
        <EtatVide titre="Aucun compte ne correspond." />
      ) : (
        <div className="tableau-cadre">
          <table className="tableau">
            <thead>
              <tr><th scope="col">Nom</th><th scope="col">Entreprise</th><th scope="col">E-mail</th>
                  <th scope="col">Rôle</th><th scope="col">Accès</th>
                  <th scope="col"><span className="visuellement-cache">Actions</span></th></tr>
            </thead>
            <tbody>
              {plombiersFiltres.map((p) => (
                <tr key={p.id}>
                  <td data-libelle="Nom"><strong>{p.nom}</strong></td>
                  <td data-libelle="Entreprise">
                    {p.entreprise_id
                      ? <Link href={`/admin/entreprises/${p.entreprise_id}`}>{nomEntreprise[p.entreprise_id] ?? "—"}</Link>
                      : "—"}
                  </td>
                  <td data-libelle="E-mail">{p.email}</td>
                  <td data-libelle="Rôle">{ROLE_PLOMBIER[p.role] ?? p.role}</td>
                  <td data-libelle="Accès">
                    {!p.actif ? <span className="puce" data-ton="attenue">Désactivé</span>
                      : p.auth_user_id ? <span className="puce" data-ton="accent">Actif</span>
                      : <span className="puce" data-ton="neutre">Jamais connecté</span>}
                  </td>
                  <td data-libelle="Actions" className="cellule-actions">
                    <button className="bouton" data-taille="petit" onClick={() => setPlombierEdite(p)}>Modifier</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialogue ouvert={nouvelAdmin} fermer={() => setNouvelAdmin(false)} titre="Nouvel administrateur">
        <form onSubmit={ajouterAdmin}>
          <p className="discret" style={{ marginTop: 0 }}>
            La personne aura accès aux données de toutes les entreprises. Elle se connecte avec cette
            adresse et un code reçu par e-mail.
          </p>
          <Champ id="a-nom" libelle="Nom">
            <input id="a-nom" type="text" maxLength={200} value={adminSaisi.nom}
                   onChange={(e) => setAdminSaisi({ ...adminSaisi, nom: e.target.value })} />
          </Champ>
          <Champ id="a-email" libelle="Adresse e-mail">
            <input id="a-email" type="email" required maxLength={254} value={adminSaisi.email}
                   onChange={(e) => setAdminSaisi({ ...adminSaisi, email: e.target.value })} />
          </Champ>
          <div className="actions" style={{ marginBottom: 0 }}>
            <button className="bouton" data-style="plein" disabled={envoi}>Ajouter</button>
            <button type="button" className="bouton" data-style="nu" onClick={() => setNouvelAdmin(false)}>Annuler</button>
          </div>
        </form>
      </Dialogue>

      <Dialogue ouvert={plombierEdite !== null} fermer={() => setPlombierEdite(null)}
                titre={plombierEdite === "nouveau" ? "Nouveau compte plombier" : "Modifier le compte"}>
        {plombierEdite !== null && (
          <FormulairePlombier plombier={plombierEdite === "nouveau" ? null : plombierEdite}
                              entreprises={entreprises}
                              surAnnule={() => setPlombierEdite(null)}
                              surEnregistre={() => {
                                setPlombierEdite(null);
                                setRetour({ type: "ok", texte: "Compte enregistré." });
                                setVersion((v) => v + 1);
                              }} />
        )}
      </Dialogue>
    </main>
  );
}
