"use client";

import { useState } from "react";
import {
  enregistrerEntreprise, enregistrerPlombier, messageErreur,
  type Entreprise, type Plombier, type SaisieEntreprise, type SaisiePlombier,
} from "@/lib/donnees";
import { ROLE_PLOMBIER, STATUT_ENTREPRISE } from "@/lib/affichage";
import { Champ } from "./Ui";

/**
 * Formulaires d'administration. Les contrôles faits ici évitent un
 * aller-retour ; les vrais contrôles sont refaits en base par
 * admin_enregistrer_entreprise / admin_enregistrer_plombier.
 */

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function FormulaireEntreprise({
  entreprise, surEnregistre, surAnnule,
}: {
  entreprise: Entreprise | null;
  surEnregistre: (id: string) => void;
  surAnnule: () => void;
}) {
  const [v, setV] = useState<SaisieEntreprise>({
    nom: entreprise?.nom ?? "",
    contact_nom: entreprise?.contact_nom ?? "",
    email: entreprise?.email ?? "",
    telephone: entreprise?.telephone ?? "",
    ville: entreprise?.ville ?? "",
    statut: entreprise?.statut ?? "essai",
  });
  const [erreur, setErreur] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const maj = (c: keyof SaisieEntreprise) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setV({ ...v, [c]: e.target.value });

  async function envoyer(e: React.FormEvent) {
    e.preventDefault();
    setErreur("");
    if (!v.nom.trim()) return setErreur("Le nom de l'entreprise est obligatoire.");
    if (v.email.trim() && !EMAIL.test(v.email.trim())) return setErreur("Adresse e-mail invalide.");
    if (entreprise && v.statut === "resilie" && entreprise.statut !== "resilie" &&
        !confirm(`Résilier « ${entreprise.nom} » ? Ses données restent conservées et consultables ; seuls ses comptes devront être désactivés à part.`)) {
      return;
    }
    setEnvoi(true);
    try {
      surEnregistre(await enregistrerEntreprise(entreprise?.id ?? null, v));
    } catch (err) {
      setErreur(messageErreur(err));
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <form onSubmit={envoyer} noValidate>
      <Champ id="e-nom" libelle="Nom de l'entreprise">
        <input id="e-nom" type="text" required maxLength={200} value={v.nom} onChange={maj("nom")} />
      </Champ>
      <div className="grille-champs">
        <Champ id="e-contact" libelle="Contact principal">
          <input id="e-contact" type="text" maxLength={200} value={v.contact_nom} onChange={maj("contact_nom")} />
        </Champ>
        <Champ id="e-ville" libelle="Ville">
          <input id="e-ville" type="text" maxLength={120} value={v.ville} onChange={maj("ville")} />
        </Champ>
        <Champ id="e-email" libelle="Adresse e-mail">
          <input id="e-email" type="email" maxLength={254} value={v.email} onChange={maj("email")} />
        </Champ>
        <Champ id="e-tel" libelle="Téléphone">
          <input id="e-tel" type="text" inputMode="tel" maxLength={30} value={v.telephone} onChange={maj("telephone")} />
        </Champ>
      </div>
      <Champ id="e-statut" libelle="Statut du compte"
             aide="« Résilié » remplace la suppression : rien n'est effacé.">
        <select id="e-statut" value={v.statut} onChange={maj("statut")}>
          {Object.entries(STATUT_ENTREPRISE).map(([k, l]) => <option key={k} value={k}>{l.libelle}</option>)}
        </select>
      </Champ>
      {erreur && <p className="erreur" role="alert">{erreur}</p>}
      <div className="actions" style={{ marginBottom: 0 }}>
        <button className="bouton" data-style="plein" disabled={envoi}>
          {envoi ? "Enregistrement…" : entreprise ? "Enregistrer" : "Créer l'entreprise"}
        </button>
        <button type="button" className="bouton" data-style="nu" onClick={surAnnule}>Annuler</button>
      </div>
    </form>
  );
}

export function FormulairePlombier({
  plombier, entreprises, entrepriseParDefaut, surEnregistre, surAnnule,
}: {
  plombier: Plombier | null;
  entreprises: { id: string; nom: string }[];
  entrepriseParDefaut?: string;
  surEnregistre: () => void;
  surAnnule: () => void;
}) {
  const [v, setV] = useState<SaisiePlombier>({
    entreprise_id: plombier?.entreprise_id ?? entrepriseParDefaut ?? entreprises[0]?.id ?? "",
    nom: plombier?.nom ?? "",
    email: plombier?.email ?? "",
    telephone: plombier?.telephone ?? "",
    role: plombier?.role ?? "titulaire",
    actif: plombier?.actif ?? true,
  });
  const [erreur, setErreur] = useState("");
  const [envoi, setEnvoi] = useState(false);

  async function envoyer(e: React.FormEvent) {
    e.preventDefault();
    setErreur("");
    if (!v.nom.trim()) return setErreur("Le nom est obligatoire.");
    if (!EMAIL.test(v.email.trim())) return setErreur("Adresse e-mail invalide.");
    if (!v.telephone.trim()) return setErreur("Le téléphone est obligatoire.");
    if (!v.entreprise_id) return setErreur("Choisissez une entreprise.");
    setEnvoi(true);
    try {
      await enregistrerPlombier(plombier?.id ?? null, v);
      surEnregistre();
    } catch (err) {
      setErreur(messageErreur(err));
    } finally {
      setEnvoi(false);
    }
  }

  const emailChange = plombier && plombier.email.toLowerCase() !== v.email.trim().toLowerCase();

  return (
    <form onSubmit={envoyer} noValidate>
      <Champ id="p-entreprise" libelle="Entreprise">
        <select id="p-entreprise" value={v.entreprise_id}
                onChange={(e) => setV({ ...v, entreprise_id: e.target.value })}>
          {entreprises.map((x) => <option key={x.id} value={x.id}>{x.nom}</option>)}
        </select>
      </Champ>
      <div className="grille-champs">
        <Champ id="p-nom" libelle="Nom">
          <input id="p-nom" type="text" maxLength={200} value={v.nom}
                 onChange={(e) => setV({ ...v, nom: e.target.value })} />
        </Champ>
        <Champ id="p-role" libelle="Rôle dans l'entreprise">
          <select id="p-role" value={v.role} onChange={(e) => setV({ ...v, role: e.target.value })}>
            {Object.entries(ROLE_PLOMBIER).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </Champ>
        <Champ id="p-email" libelle="Adresse e-mail de connexion"
               aide={emailChange ? "Nouvelle adresse : la personne devra se reconnecter avec celle-ci." : undefined}>
          <input id="p-email" type="email" maxLength={254} value={v.email}
                 onChange={(e) => setV({ ...v, email: e.target.value })} />
        </Champ>
        <Champ id="p-tel" libelle="Téléphone">
          <input id="p-tel" type="text" inputMode="tel" maxLength={30} value={v.telephone}
                 onChange={(e) => setV({ ...v, telephone: e.target.value })} />
        </Champ>
      </div>
      <label className="bascule" style={{ margin: ".5rem 0 1rem" }}>
        <input type="checkbox" checked={v.actif} onChange={(e) => setV({ ...v, actif: e.target.checked })} />
        <span className="bascule-piste"><span className="bascule-pion" /></span>
        <span>Accès au tableau de bord autorisé</span>
      </label>
      {erreur && <p className="erreur" role="alert">{erreur}</p>}
      <div className="actions" style={{ marginBottom: 0 }}>
        <button className="bouton" data-style="plein" disabled={envoi}>
          {envoi ? "Enregistrement…" : plombier ? "Enregistrer" : "Créer le compte"}
        </button>
        <button type="button" className="bouton" data-style="nu" onClick={surAnnule}>Annuler</button>
      </div>
    </form>
  );
}
