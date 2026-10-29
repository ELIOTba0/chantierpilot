"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import type { Libelle } from "@/lib/affichage";
import { TAILLE_PAGE } from "@/lib/donnees";

/** Petits éléments d'interface partagés par les deux espaces. */

export function Puce({ l, titre }: { l: Libelle; titre?: string }) {
  return <span className="puce" data-ton={l.ton} title={titre}>{l.libelle}</span>;
}

export function Indicateur({
  titre, valeur, detail, href, ton,
}: {
  titre: string;
  valeur: number | string | null;
  detail?: string;
  href?: string;
  ton?: "urgent";
}) {
  const contenu = (
    <>
      <span className="indicateur-titre">{titre}</span>
      <span className="indicateur-valeur">{valeur ?? "—"}</span>
      {detail && <span className="indicateur-detail">{detail}</span>}
    </>
  );
  return href
    ? <Link href={href} className="indicateur" data-ton={ton}>{contenu}</Link>
    : <div className="indicateur" data-ton={ton}>{contenu}</div>;
}

export function Indicateurs({ children }: { children: React.ReactNode }) {
  return <div className="indicateurs">{children}</div>;
}

export function Pagination({
  page, total, surPage,
}: { page: number; total: number; surPage: (p: number) => void }) {
  const pages = Math.ceil(total / TAILLE_PAGE);
  if (pages <= 1) return null;
  return (
    <nav className="pagination" aria-label="Pagination">
      <button className="bouton" data-taille="petit" disabled={page === 0}
              onClick={() => surPage(page - 1)}>
        Précédent
      </button>
      <span className="discret">Page {page + 1} sur {pages}</span>
      <button className="bouton" data-taille="petit" disabled={page >= pages - 1}
              onClick={() => surPage(page + 1)}>
        Suivant
      </button>
    </nav>
  );
}

export type Retour = { type: "ok" | "erreur"; texte: string } | null;

/** Confirmation ou erreur après une action, annoncée aux lecteurs d'écran. */
export function Message({ retour, fermer }: { retour: Retour; fermer: () => void }) {
  useEffect(() => {
    if (retour?.type !== "ok") return;
    const t = setTimeout(fermer, 4000);
    return () => clearTimeout(t);
  }, [retour, fermer]);

  if (!retour) return null;
  return (
    <div className="message" data-type={retour.type}
         role={retour.type === "erreur" ? "alert" : "status"}>
      <span>{retour.texte}</span>
      <button type="button" onClick={fermer} aria-label="Fermer le message">×</button>
    </div>
  );
}

export function EtatVide({ titre, children }: { titre: string; children?: React.ReactNode }) {
  return (
    <div className="etat-vide">
      <p className="etat-vide-titre">{titre}</p>
      {children && <p>{children}</p>}
    </div>
  );
}

export function Chargement({ lignes = 5 }: { lignes?: number }) {
  return (
    <div className="squelette" aria-busy="true" aria-label="Chargement">
      {Array.from({ length: lignes }).map((_, i) => <div key={i} className="squelette-ligne" />)}
    </div>
  );
}

/** Boîte de dialogue native : focus, Échap et fond gérés par le navigateur. */
export function Dialogue({
  ouvert, fermer, titre, children,
}: { ouvert: boolean; fermer: () => void; titre: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (ouvert && !d.open) d.showModal();
    if (!ouvert && d.open) d.close();
  }, [ouvert]);

  return (
    <dialog ref={ref} className="dialogue" onClose={fermer} aria-label={titre}>
      <div className="dialogue-haut">
        <h2>{titre}</h2>
        <button type="button" className="dialogue-fermer" onClick={fermer} aria-label="Fermer">×</button>
      </div>
      {ouvert && children}
    </dialog>
  );
}

export function Champ({
  id, libelle, children, aide,
}: { id: string; libelle: string; children: React.ReactNode; aide?: string }) {
  return (
    <div className="champ-formulaire">
      <label htmlFor={id}>{libelle}</label>
      {children}
      {aide && <p className="discret" style={{ margin: ".375rem 0 0" }}>{aide}</p>}
    </div>
  );
}

/** En-tête de page : titre, phrase d'explication, actions à droite. */
export function TetePage({
  titre, sousTitre, children,
}: { titre: React.ReactNode; sousTitre?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="tete-page">
      <div style={{ flex: "1 1 320px", minWidth: 0 }}>
        <h1>{titre}</h1>
        {sousTitre && <p className="sous-titre" style={{ marginBottom: 0 }}>{sousTitre}</p>}
      </div>
      {children && <div className="tete-page-actions">{children}</div>}
    </div>
  );
}
