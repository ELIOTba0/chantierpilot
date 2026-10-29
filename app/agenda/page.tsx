"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { sb } from "@/lib/supabase-browser";
import type { RendezVous } from "@/lib/donnees";
import Entete from "../composants/Entete";
import Garde from "../composants/Garde";
import CalendrierSemaine from "../composants/CalendrierSemaine";
import { Erreur, type ErreurPostgrest } from "../composants/Etat";
import { TetePage } from "../composants/Ui";

type Membre = { id: string; nom: string; couleur: string };

/** « #0F6B62 » → « 15, 107, 98 ». Permet de teinter sans connaître
 *  le fond : rgba se compose avec le thème clair comme sombre. */
function rgb(hex: string): string {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
}

export default function Planning() {
  return <Garde><Entete /><Contenu /></Garde>;
}

function Contenu() {
  const [membres, setMembres] = useState<Membre[]>([]);
  const [actifs, setActifs] = useState<Record<string, boolean>>({});
  const [erreur, setErreur] = useState<ErreurPostgrest>(null);
  const [semaine, setSemaine] = useState<RendezVous[]>([]);

  useEffect(() => {
    (async () => {
      const { data, error } = await sb
        .from("plombiers")
        .select("id, nom, couleur")
        .order("role");
      if (error) { setErreur(error); return; }
      const m = (data as Membre[]) ?? [];
      setMembres(m);
      setActifs(Object.fromEntries(m.map((x) => [x.id, true])));
    })();
  }, []);

  const filtre = useCallback(
    (r: RendezVous) => !r.assigne_a || actifs[r.assigne_a] !== false, [actifs]);
  const couleurDe = useCallback(
    (r: RendezVous) => membres.length > 1
      ? membres.find((m) => m.id === (r.assigne_a ?? r.plombier_id))?.couleur ?? null
      : null, [membres]);
  const surChargement = useCallback((r: RendezVous[]) => setSemaine(r), []);

  const visibles = semaine.filter(filtre);
  const mains = visibles.filter((r) => !r.par_ia).length;

  return (
    <main className="page">
      <TetePage titre="Planning"
                sousTitre={`${visibles.length} intervention${visibles.length > 1 ? "s" : ""} cette semaine${
                  mains > 0 ? `, dont ${mains} saisie${mains > 1 ? "s" : ""} à la main` : ""}.`}>
        <Link className="bouton" href="/rendez-vous">Vue liste</Link>
        <Link className="bouton" data-style="plein" href="/rendez-vous/nouveau">Ajouter un rendez-vous</Link>
      </TetePage>

      <Erreur e={erreur} />

      {membres.length > 1 && (
        <div className="filtres" style={{ alignItems: "center" }}>
          <span className="champ-nom" style={{ marginBottom: 0 }}>Plombiers</span>
          {membres.map((m) => {
            const on = actifs[m.id] !== false;
            return (
              <button key={m.id} type="button" aria-pressed={on}
                      onClick={() => setActifs({ ...actifs, [m.id]: !on })}
                      className="pastille-membre"
                      style={{
                        borderColor: on ? `rgba(${rgb(m.couleur)}, .45)` : undefined,
                        background: on ? `rgba(${rgb(m.couleur)}, .12)` : undefined,
                        fontWeight: on ? 600 : 500,
                        color: on ? "var(--ink)" : "var(--ink-3)",
                      }}>
                <span style={{ background: on ? m.couleur : "var(--bord-fort)" }} />
                {m.nom.split(" ")[0]}
              </button>
            );
          })}
          <span className="discret" style={{ marginLeft: "auto" }}>
            Bordure en tirets : saisi à la main
          </span>
        </div>
      )}

      <CalendrierSemaine
        lien={(r) => (r.demande_id ? `/demandes/${r.demande_id}` : "/rendez-vous")}
        filtre={filtre} couleurDe={couleurDe} surChargement={surChargement} />

      <p className="discret" style={{ marginTop: "1.25rem", maxWidth: "70ch", lineHeight: 1.6 }}>
        Un créneau ajouté ici devient immédiatement indisponible pour l&apos;assistant téléphonique.
      </p>
    </main>
  );
}
