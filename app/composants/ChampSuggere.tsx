"use client";

import { useEffect, useId, useRef, useState } from "react";

/**
 * Un champ de saisie qui propose au lieu de laisser taper.
 *
 * Trois règles ont guidé l'écriture :
 *
 * On n'interroge pas à chaque touche. Un délai de 250 ms laisse le
 * temps de finir un mot ; sans lui, taper « Angers » déclenche six
 * requêtes dont cinq inutiles.
 *
 * Une réponse en retard ne doit jamais écraser une réponse plus
 * récente. Chaque requête porte un numéro, et seule la dernière a le
 * droit d'écrire. Sans ça, taper vite fait apparaître les
 * propositions de « An » par-dessus celles de « Angers ».
 *
 * Tout se fait au clavier. Flèches, Entrée, Échap. Un plombier qui
 * saisit dix rendez-vous le soir ne doit pas lâcher les touches pour
 * attraper la souris.
 */

export type Proposition<T> = {
  cle: string;
  titre: string;
  detail?: string;
  valeur: T;
};

export default function ChampSuggere<T>({
  id,
  libelle,
  texte,
  surTexte,
  chercher,
  surChoix,
  surFin,
  placeholder,
  aide,
  minimum = 3,
  libelleExterne = false,
}: {
  id: string;
  libelle: string;
  texte: string;
  surTexte: (v: string) => void;
  chercher: (requete: string) => Promise<Proposition<T>[]>;
  surChoix: (p: Proposition<T>) => void;
  // Appelé quand on quitte le champ sans rien choisir : une
  // saisie libre doit s'enregistrer comme les autres.
  surFin?: (v: string) => void;
  placeholder?: string;
  aide?: React.ReactNode;
  minimum?: number;
  // Dans un tableau de réglages, le libellé vit dans la colonne de
  // gauche : le champ ne doit pas en dessiner un second.
  libelleExterne?: boolean;
}) {
  const [propositions, setPropositions] = useState<Proposition<T>[]>([]);
  const [ouvert, setOuvert] = useState(false);
  const [survol, setSurvol] = useState(-1);
  const [occupe, setOccupe] = useState(false);

  const dernierAppel = useRef(0);
  const minuteur = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listeId = useId();

  useEffect(() => () => {
    if (minuteur.current) clearTimeout(minuteur.current);
  }, []);

  function saisir(v: string) {
    surTexte(v);
    setSurvol(-1);

    if (minuteur.current) clearTimeout(minuteur.current);

    if (v.trim().length < minimum) {
      setPropositions([]);
      setOuvert(false);
      return;
    }

    minuteur.current = setTimeout(async () => {
      const numero = ++dernierAppel.current;
      setOccupe(true);
      let resultat: Proposition<T>[] = [];
      try {
        resultat = await chercher(v.trim());
      } catch {
        resultat = [];
      }
      // Une réponse périmée n'écrit pas.
      if (numero !== dernierAppel.current) return;
      setOccupe(false);
      setPropositions(resultat);
      setOuvert(resultat.length > 0);
    }, 250);
  }

  function choisir(p: Proposition<T>) {
    surChoix(p);
    setOuvert(false);
    setPropositions([]);
    setSurvol(-1);
  }

  function auClavier(e: React.KeyboardEvent) {
    if (!ouvert || propositions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSurvol((i) => (i + 1) % propositions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSurvol((i) => (i <= 0 ? propositions.length - 1 : i - 1));
    } else if (e.key === "Enter" && survol >= 0) {
      e.preventDefault();
      choisir(propositions[survol]);
    } else if (e.key === "Escape") {
      setOuvert(false);
    }
  }

  return (
    <div style={{ position: "relative" }}>
      {!libelleExterne && (
        <label htmlFor={id} style={{ display: "block", fontSize: ".875rem",
                                     fontWeight: 500, marginBottom: ".375rem" }}>
          {libelle}
        </label>
      )}

      <input
        id={id}
        type="text"
        aria-label={libelleExterne ? libelle : undefined}
        value={texte}
        placeholder={placeholder}
        autoComplete="off"
        role="combobox"
        aria-expanded={ouvert}
        aria-controls={listeId}
        aria-autocomplete="list"
        aria-activedescendant={survol >= 0 ? `${listeId}-${survol}` : undefined}
        onChange={(e) => saisir(e.target.value)}
        onKeyDown={auClavier}
        onFocus={() => propositions.length > 0 && setOuvert(true)}
        // Un clic sur une proposition déclenche d'abord le flou du
        // champ : sans ce délai, la liste disparaît avant le clic.
        onBlur={() => {
          setTimeout(() => setOuvert(false), 150);
          surFin?.(texte);
        }}
      />

      {ouvert && (
        <ul id={listeId} role="listbox" className="suggestions">
          {propositions.map((p, i) => (
            <li
              key={p.cle}
              id={`${listeId}-${i}`}
              role="option"
              aria-selected={i === survol}
              data-survol={i === survol}
              onMouseEnter={() => setSurvol(i)}
              onMouseDown={(e) => { e.preventDefault(); choisir(p); }}
            >
              <span className="suggestion-titre">{p.titre}</span>
              {p.detail && <span className="suggestion-detail">{p.detail}</span>}
            </li>
          ))}
        </ul>
      )}

      {aide && (
        <div className="discret" style={{ marginTop: ".4375rem", lineHeight: 1.5 }}>
          {occupe ? "Recherche…" : aide}
        </div>
      )}
    </div>
  );
}
