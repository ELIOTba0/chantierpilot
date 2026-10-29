"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { chercher, suggestions, type EspaceGuide, type Fiche } from "@/lib/guide";

/**
 * Bulle d'aide en bas à droite. Elle répond à partir des fiches de
 * lib/guide.ts : pas d'IA, pas d'appel réseau, et elle l'annonce.
 */

type Bulle =
  | { de: "vous"; texte: string }
  | { de: "guide"; fiche: Fiche; autres: Fiche[] }
  | { de: "guide"; inconnu: true; propositions: Fiche[] };

export default function Guide({ espace }: { espace: EspaceGuide }) {
  const chemin = usePathname() ?? "";
  const [ouvert, setOuvert] = useState(false);
  const [fil, setFil] = useState<Bulle[]>([]);
  const [saisie, setSaisie] = useState("");
  const bas = useRef<HTMLDivElement>(null);
  const champ = useRef<HTMLInputElement>(null);

  useEffect(() => { bas.current?.scrollIntoView({ block: "end" }); }, [fil, ouvert]);
  useEffect(() => { if (ouvert) champ.current?.focus(); }, [ouvert]);
  useEffect(() => {
    if (!ouvert) return;
    const echap = (e: KeyboardEvent) => { if (e.key === "Escape") setOuvert(false); };
    window.addEventListener("keydown", echap);
    return () => window.removeEventListener("keydown", echap);
  }, [ouvert]);

  function repondre(fiche: Fiche, question = fiche.question) {
    const autres = chercher(question, espace, 3).filter((f) => f.id !== fiche.id).slice(0, 2);
    setFil((f) => [...f, { de: "vous", texte: question }, { de: "guide", fiche, autres }]);
  }

  function poser(e: React.FormEvent) {
    e.preventDefault();
    const q = saisie.trim();
    if (!q) return;
    setSaisie("");
    const [meilleure] = chercher(q, espace);
    if (meilleure) repondre(meilleure, q);
    else setFil((f) => [...f, { de: "vous", texte: q },
      { de: "guide", inconnu: true, propositions: suggestions(chemin, espace, 4) }]);
  }

  const proposees = suggestions(chemin, espace, 4);

  return (
    <>
      <button type="button" className="guide-bouton" aria-expanded={ouvert} aria-controls="guide-panneau"
              onClick={() => setOuvert(!ouvert)}>
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true"
             stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          {ouvert
            ? <path d="M5 5l10 10M15 5 5 15" />
            : <><path d="M4 15.5V5.5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H7Z" /><path d="M8.2 7.6a1.9 1.9 0 1 1 2.6 1.8c-.5.2-.8.6-.8 1.1M10 12h0" /></>}
        </svg>
        <span>{ouvert ? "Fermer" : "Aide"}</span>
      </button>

      {ouvert && (
        <section id="guide-panneau" className="guide" role="dialog" aria-label="Guide ChantierPilot">
          <header className="guide-tete">
            <div>
              <strong>Guide ChantierPilot</strong>
              <span>Réponses préparées sur l&apos;application, pas une IA</span>
            </div>
            <button type="button" className="guide-fermer" onClick={() => setOuvert(false)} aria-label="Fermer le guide">×</button>
          </header>

          <div className="guide-fil" aria-live="polite">
            <div className="guide-bulle" data-de="guide">
              <p>Bonjour ! Posez une question sur l&apos;application, ou choisissez un sujet :</p>
              <Choix fiches={proposees} surChoix={repondre} />
            </div>

            {fil.map((b, i) => b.de === "vous" ? (
              <div key={i} className="guide-bulle" data-de="vous"><p>{b.texte}</p></div>
            ) : "inconnu" in b ? (
              <div key={i} className="guide-bulle" data-de="guide">
                <p>Je n&apos;ai pas de réponse préparée pour cette question. Essayez avec d&apos;autres mots, ou un de ces sujets :</p>
                <Choix fiches={b.propositions} surChoix={repondre} />
                <p className="guide-discret">Pour tout le reste, contactez l&apos;équipe ChantierPilot.</p>
              </div>
            ) : (
              <div key={i} className="guide-bulle" data-de="guide">
                <p className="guide-titre">{b.fiche.question}</p>
                {b.fiche.reponse.map((p, k) => <p key={k}>{p}</p>)}
                {b.fiche.liens && (
                  <div className="guide-liens">
                    {b.fiche.liens.map((l) => (
                      <Link key={l.href} href={l.href} onClick={() => setOuvert(false)}>{l.libelle} →</Link>
                    ))}
                  </div>
                )}
                {b.autres.length > 0 && (
                  <>
                    <p className="guide-discret">Voir aussi :</p>
                    <Choix fiches={b.autres} surChoix={repondre} />
                  </>
                )}
              </div>
            ))}
            <div ref={bas} />
          </div>

          <form className="guide-saisie" onSubmit={poser}>
            <label htmlFor="guide-question" className="visuellement-cache">Votre question</label>
            <input id="guide-question" ref={champ} value={saisie} onChange={(e) => setSaisie(e.target.value)}
                   placeholder="Ex. : comment reporter un rappel ?" autoComplete="off" />
            <button type="submit" className="bouton" data-style="plein" data-taille="petit" disabled={!saisie.trim()}>
              Envoyer
            </button>
          </form>
        </section>
      )}
    </>
  );
}

function Choix({ fiches, surChoix }: { fiches: Fiche[]; surChoix: (f: Fiche) => void }) {
  return (
    <div className="guide-choix">
      {fiches.map((f) => (
        <button key={f.id} type="button" onClick={() => surChoix(f)}>{f.question}</button>
      ))}
    </div>
  );
}
