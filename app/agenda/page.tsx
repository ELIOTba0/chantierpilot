"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { sb } from "@/lib/supabase-browser";
import { heure, jour, LIBELLES_PROBLEME } from "@/lib/affichage";
import Entete from "../composants/Entete";
import Garde from "../composants/Garde";
import { Erreur, Vide, type ErreurPostgrest } from "../composants/Etat";

type Rdv = {
  id: string;
  debut: string;
  fin: string;
  statut: string;
  demandes: {
    id: string;
    nom_client: string | null;
    type_probleme: string | null;
    adresse: string | null;
    commune: string | null;
    urgence: string | null;
  } | null;
};

export default function Planning() {
  return <Garde><Entete /><Contenu /></Garde>;
}

function Contenu() {
  const [rdvs, setRdvs] = useState<Rdv[]>([]);
  const [erreur, setErreur] = useState<ErreurPostgrest>(null);
  const [indices, setIndices] = useState<string[]>([]);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    (async () => {
      const depuis = new Date();
      depuis.setHours(0, 0, 0, 0);

      const { data, error } = await sb
        .from("rendez_vous")
        .select("id, debut, fin, statut, demandes(id, nom_client, type_probleme, adresse, commune, urgence)")
        .gte("debut", depuis.toISOString())
        .order("debut");

      if (error) {
        setErreur(error);
        setChargement(false);
        return;
      }

      setErreur(null);
      const lignes = (data as unknown as Rdv[]) ?? [];
      setRdvs(lignes);

      // Rien ne remonte : on cherche lequel des filtres mord, plutôt
      // que d'afficher un écran blanc muet.
      if (lignes.length === 0 && process.env.NODE_ENV !== "production") {
        const tout = await sb.from("rendez_vous").select("statut, debut");
        const l = [`filtre : debut >= ${depuis.toISOString()}`];
        if (tout.error) {
          l.push(`sans filtre : ${tout.error.message} (${tout.error.code ?? "?"})`);
        } else {
          const n = tout.data?.length ?? 0;
          const statuts = [...new Set((tout.data ?? []).map((r) => r.statut))];
          l.push(`sans aucun filtre : ${n} ligne(s) visibles`);
          l.push(`statuts présents : ${statuts.join(", ") || "aucun"}`);
          l.push(n === 0
            ? "→ 0 même sans filtre : la RLS refuse la lecture"
            : "→ tous les rendez-vous sont dans le passé");
        }
        setIndices(l);
      }

      setChargement(false);
    })();
  }, []);

  if (chargement) return <main className="page" />;

  // Regroupés par jour : c'est ainsi qu'on lit une semaine.
  const parJour = new Map<string, Rdv[]>();
  for (const r of rdvs) {
    const cle = new Date(r.debut).toDateString();
    if (!parJour.has(cle)) parJour.set(cle, []);
    parJour.get(cle)!.push(r);
  }

  const maintenant = Date.now();

  return (
    <main className="page">
      <h1>Planning</h1>
      <p className="sous-titre">
        Les rendez-vous pris par l&apos;assistant. Ceux que vous ajoutez
        vous-même dans Google Agenda sont pris en compte : l&apos;assistant
        ne propose jamais un créneau déjà occupé.
      </p>

      <Erreur e={erreur} />

      {parJour.size === 0 ? (
        <>
          <div className="vide"><p>Aucun rendez-vous à venir.</p></div>
          <Vide indices={indices} />
        </>
      ) : (
        [...parJour.entries()].map(([cle, liste]) => (
          <div key={cle}>
            <h2>{jour(liste[0].debut)}</h2>
            <div className="liste">
              {liste.map((r) => {
                const d = r.demandes;
                const lieu = [d?.adresse, d?.commune].filter(Boolean).join(", ");
                return (
                  <Link key={r.id}
                        href={d ? `/demandes/${d.id}` : "/agenda"}
                        className="rdv"
                        data-passe={new Date(r.fin).getTime() < maintenant}>
                    <div className="rdv-heure">{heure(r.debut)}</div>
                    <div className="rdv-corps">
                      <div className="carte-titre">
                        {d?.nom_client ?? LIBELLES_PROBLEME[d?.type_probleme ?? "autre"]}
                      </div>
                      <div className="carte-desc">
                        {LIBELLES_PROBLEME[d?.type_probleme ?? "autre"]}
                        {lieu && ` · ${lieu}`}
                      </div>
                    </div>
                    {d?.urgence === "haute" && (
                      <span className="puce" data-ton="haute">Urgent</span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))
      )}
    </main>
  );
}
