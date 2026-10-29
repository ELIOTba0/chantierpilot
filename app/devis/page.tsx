"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { sb } from "@/lib/supabase-browser";
import { creerDevis, EUROS } from "@/lib/devis";
import Entete from "../composants/Entete";
import Garde from "../composants/Garde";
import Squelette from "../composants/Squelette";
import { Erreur, type ErreurPostgrest } from "../composants/Etat";

type Devis = {
  id: string; numero: string; client_nom: string; statut: string;
  date_emission: string; total_ttc: number; total_ht: number;
};

const LIBELLES: Record<string, string> = {
  brouillon: "Brouillon", envoye: "Envoyé", accepte: "Accepté",
  refuse: "Refusé", expire: "Expiré",
};

export default function ListeDevis() {
  return <Garde><Entete /><Contenu /></Garde>;
}

function Contenu() {
  const router = useRouter();
  const [liste, setListe] = useState<Devis[]>([]);
  const [erreur, setErreur] = useState<ErreurPostgrest>(null);
  const [chargement, setChargement] = useState(true);
  const [occupe, setOccupe] = useState(false);

  useEffect(() => {
    (async () => {
      const { data, error } = await sb
        .from("devis")
        .select("id, numero, client_nom, statut, date_emission, total_ttc, total_ht")
        .order("date_emission", { ascending: false })
        .limit(100);
      if (error) { setErreur(error); setChargement(false); return; }
      setListe((data as Devis[]) ?? []);
      setChargement(false);
    })();
  }, []);

  async function nouveau() {
    setOccupe(true);
    try {
      const id = await creerDevis();
      router.push(`/devis/${id}`);
    } catch (e) {
      setErreur({ message: e instanceof Error ? e.message : "Création impossible." });
      setOccupe(false);
    }
  }

  if (chargement) return <Squelette />;

  return (
    <main className="page">
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end",
                    gap: "1.25rem", marginBottom: "1.5rem" }}>
        <div style={{ flex: "1 1 320px" }}>
          <h1 style={{ marginBottom: ".25rem" }}>Devis</h1>
          <p className="sous-titre" style={{ margin: 0 }}>
            Établis depuis une intervention, ou de zéro.
          </p>
        </div>
        <button className="bouton" data-style="plein" onClick={nouveau} disabled={occupe}>
          {occupe ? "…" : "Nouveau devis"}
        </button>
      </div>

      <Erreur e={erreur} />

      {liste.length === 0 ? (
        <div className="vide">
          <p>Aucun devis. Le plus simple est de partir d&apos;une intervention :
             ouvrez sa fiche et cliquez sur « Établir un devis ».</p>
        </div>
      ) : (
        <div className="liste">
          {liste.map((d) => (
            <Link key={d.id} href={`/devis/${d.id}`} className="carte">
              <div style={{ flex: "none", width: 132, fontSize: ".9375rem",
                            fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                {d.numero}
              </div>
              <div className="carte-corps">
                <div className="carte-titre">{d.client_nom}</div>
                <div className="carte-desc">
                  {new Date(d.date_emission).toLocaleDateString("fr-FR")}
                </div>
              </div>
              <div style={{ flex: "none", width: 120, textAlign: "right",
                            fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
                {EUROS.format(d.total_ttc ?? 0)}
              </div>
              <div style={{ flex: "none", width: 120 }}>
                <span className="puce" data-ton={d.statut === "accepte" ? "rdv_pris"
                                                 : d.statut === "brouillon" ? undefined
                                                 : "a_confirmer"}>
                  {LIBELLES[d.statut] ?? d.statut}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
