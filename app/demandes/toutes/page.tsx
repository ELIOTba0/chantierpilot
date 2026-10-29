"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { sb } from "@/lib/supabase-browser";
import { LIBELLES_PROBLEME, ilYA, heure, jour } from "@/lib/affichage";
import Entete from "../../composants/Entete";
import Garde from "../../composants/Garde";
import { Erreur, type ErreurPostgrest } from "../../composants/Etat";
import Squelette from "../../composants/Squelette";

type Ligne = {
  id: string;
  nom_client: string | null;
  type_probleme: string | null;
  description_client: string | null;
  commune: string | null;
  adresse: string | null;
  telephone_client: string | null;
  urgence: string | null;
  statut: string;
  origine: string | null;
  cree_le: string;
  repondre_avant: string | null;
  rendez_vous?: { id: string; debut: string; fin: string; statut: string }[];
};

type Filtre = "a_confirmer" | "a_traiter" | "rdv" | "toutes";

const LIBELLES: Record<string, string> = {
  nouvelle: "Nouvelle",
  a_confirmer: "À confirmer",
  a_rappeler: "À rappeler",
  rdv_pris: "Rendez-vous pris",
  refusee: "Refusée",
  hors_perimetre: "Hors zone",
  traitee: "Traitée",
};

function ton(statut: string): string | undefined {
  if (statut === "a_confirmer") return "a_confirmer";
  if (statut === "rdv_pris") return "rdv_pris";
  return undefined;
}

export default function ToutesDemandes() {
  return <Garde><Entete /><Contenu /></Garde>;
}

function Contenu() {
  const [lignes, setLignes] = useState<Ligne[]>([]);
  const [modeValidation, setMode] = useState<string>("manuelle");
  const [filtre, setFiltre] = useState<Filtre>("a_confirmer");
  const [erreur, setErreur] = useState<ErreurPostgrest>(null);
  const [chargement, setChargement] = useState(true);
  const [occupe, setOccupe] = useState<string | null>(null);

  async function charger() {
    const { data, error } = await sb
      .from("demandes")
      .select("id, nom_client, type_probleme, description_client, commune, adresse, telephone_client, urgence, statut, origine, cree_le, repondre_avant, rendez_vous(id, debut, fin, statut)")
      .order("cree_le", { ascending: false })
      .limit(200);
    if (error) { setErreur(error); setChargement(false); return; }
    setErreur(null);
    setLignes((data as unknown as Ligne[]) ?? []);
    setChargement(false);
  }

  useEffect(() => {
    (async () => {
      const { data: ent } = await sb
        .from("entreprises").select("validation_mode").maybeSingle();
      if (ent?.validation_mode) setMode(ent.validation_mode);
      if (ent?.validation_mode === "auto") setFiltre("a_traiter");
      await charger();
    })();
  }, []);

  /** Accepter : le rendez-vous proposé devient ferme. */
  async function accepter(l: Ligne) {
    setOccupe(l.id);
    const rdv = l.rendez_vous?.[0];
    if (rdv) {
      const { error } = await sb.from("rendez_vous")
        .update({ statut: "confirme" }).eq("id", rdv.id);
      if (error) { setErreur(error); setOccupe(null); return; }
    }
    const { error } = await sb.from("demandes").update({
      statut: "rdv_pris",
      decision: "acceptee",
      decide_le: new Date().toISOString(),
    }).eq("id", l.id);
    if (error) { setErreur(error); setOccupe(null); return; }

    await trace(l, rdv?.id ?? null, "confirmation",
      `Bonjour, votre rendez-vous est confirmé${rdv ? ` le ${jour(rdv.debut)} à ${heure(rdv.debut)}` : ""}` +
      `${l.adresse ? `, ${l.adresse}` : ""}${l.commune ? ` à ${l.commune}` : ""}.`);

    setOccupe(null);
    charger();
  }

  /** Refuser : aucun créneau n'est bloqué, et le client le sait. */
  async function refuser(l: Ligne) {
    const motif = prompt("Motif communiqué au client ?", "Agenda complet cette semaine");
    if (motif === null) return;
    setOccupe(l.id);
    const rdv = l.rendez_vous?.[0];
    if (rdv) {
      const { error } = await sb.from("rendez_vous").update({
        statut: "annule",
        annule_le: new Date().toISOString(),
        motif_annulation: motif || null,
      }).eq("id", rdv.id);
      if (error) { setErreur(error); setOccupe(null); return; }
    }
    const { error } = await sb.from("demandes").update({
      statut: "refusee",
      decision: "refusee",
      decide_le: new Date().toISOString(),
      motif_refus: motif || null,
    }).eq("id", l.id);
    if (error) { setErreur(error); setOccupe(null); return; }

    await trace(l, rdv?.id ?? null, "refus",
      `Bonjour, nous ne pouvons malheureusement pas prendre votre demande en charge` +
      `${motif ? ` (${motif.toLowerCase()})` : ""}. Nous vous invitons à contacter un autre artisan.`);

    setOccupe(null);
    charger();
  }

  /**
   * Le message part en base avec son texte exact, quel que soit le
   * canal. En cas de litige sur un rendez-vous, c'est la seule preuve
   * de ce qui a été annoncé au client.
   */
  async function trace(l: Ligne, rdvId: string | null, modele: string, contenu: string) {
    const { data: ent } = await sb
      .from("entreprises").select("id, canal_notification").maybeSingle();
    if (!ent) return;
    await sb.from("notifications").insert({
      entreprise_id: ent.id,
      demande_id: l.id,
      rendez_vous_id: rdvId,
      destinataire: "client",
      adresse_dest: l.telephone_client,
      canal: ent.canal_notification ?? "interface",
      modele,
      contenu,
      statut: "a_envoyer",
    });
  }

  if (chargement) return <Squelette />;

  const groupes: Record<Filtre, Ligne[]> = {
    a_confirmer: lignes.filter((l) => l.statut === "a_confirmer"),
    a_traiter: lignes.filter((l) => l.statut === "a_rappeler" || l.statut === "nouvelle"),
    rdv: lignes.filter((l) => l.statut === "rdv_pris"),
    toutes: lignes,
  };

  const onglets: [Filtre, string][] = [
    ["a_confirmer", "À confirmer"],
    ["a_traiter", "À rappeler"],
    ["rdv", "Rendez-vous pris"],
    ["toutes", "Toutes"],
  ];

  const visibles = groupes[filtre];

  return (
    <main className="page">
      <h1>Demandes</h1>
      <p className="sous-titre">
        Tout ce que l&apos;assistant a recueilli pendant que vous travailliez.
      </p>

      <Erreur e={erreur} />

      {modeValidation === "auto" && groupes.a_confirmer.length === 0 && (
        <div className="encart-info">
          L&apos;assistant confirme seul les créneaux libres. Pour décider
          vous-même de chaque rendez-vous, passez la prise de rendez-vous en
          validation manuelle dans <Link href="/reglages">Réglages → L&apos;assistant</Link>.
        </div>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: ".375rem", marginBottom: ".25rem" }}>
        {onglets.map(([cle, nom]) => {
          const on = filtre === cle;
          return (
            <button key={cle} type="button" onClick={() => setFiltre(cle)}
                    style={{
                      minHeight: 44, padding: "0 1rem", borderRadius: 9,
                      fontFamily: "inherit", fontSize: ".875rem", cursor: "pointer",
                      fontWeight: on ? 600 : 500,
                      border: `1px solid ${on ? "var(--accent)" : "var(--bord-champ)"}`,
                      background: on ? "var(--accent)" : "var(--surface)",
                      color: on ? "#FFFFFF" : "var(--ink-2)",
                    }}>
              {nom} ({groupes[cle].length})
            </button>
          );
        })}
      </div>

      <div className="liste" style={{ marginTop: ".75rem" }}>
        {visibles.length === 0 && (
          <div className="vide"><p>Rien dans cette catégorie.</p></div>
        )}

        {visibles.map((l) => {
          const rdv = l.rendez_vous?.[0];
          const aDecider = l.statut === "a_confirmer";
          return (
            <div key={l.id} className="carte" style={{ flexWrap: "wrap" }}>
              <div style={{ flex: "none", width: 112, fontSize: ".875rem",
                            color: "var(--ink-2)", fontVariantNumeric: "tabular-nums",
                            paddingTop: 2 }}>
                {ilYA(l.cree_le)}
              </div>

              <div className="carte-corps">
                <div className="carte-haut">
                  <Link href={`/demandes/${l.id}`} className="carte-titre"
                        style={{ textDecoration: "none", color: "var(--ink)" }}>
                    {l.nom_client ?? LIBELLES_PROBLEME[l.type_probleme ?? "autre"]}
                  </Link>
                  {l.urgence === "haute" && (
                    <span className="puce" data-ton="haute">Urgent</span>
                  )}
                </div>
                <div className="carte-desc">
                  {l.description_client ?? LIBELLES_PROBLEME[l.type_probleme ?? "autre"]}
                  {rdv && ` · créneau proposé ${jour(rdv.debut)} à ${heure(rdv.debut)}`}
                </div>

                {aDecider && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: ".5rem",
                                marginTop: ".75rem", alignItems: "center" }}>
                    <button className="bouton" data-style="plein"
                            style={{ minHeight: 44, padding: "0 1.125rem" }}
                            disabled={occupe === l.id}
                            onClick={() => accepter(l)}>
                      Accepter
                    </button>
                    <button className="bouton" style={{ minHeight: 44, padding: "0 1.125rem" }}
                            disabled={occupe === l.id}
                            onClick={() => refuser(l)}>
                      Refuser
                    </button>
                    <Link className="bouton" data-style="nu" href={`/demandes/${l.id}`}
                          style={{ minHeight: 44, padding: "0 .75rem" }}>
                      Voir la fiche
                    </Link>
                    {l.repondre_avant && (
                      <span className="discret">
                        Réponse attendue avant {heure(l.repondre_avant)}
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div style={{ flex: "none", width: 140, fontSize: ".875rem",
                            color: "var(--ink)", paddingTop: 2 }}>
                {l.commune ?? "—"}
              </div>

              <div style={{ flex: "none", width: 170, paddingTop: 1,
                            display: "flex", flexDirection: "column", gap: ".375rem" }}>
                <span className="puce" data-ton={ton(l.statut)}>
                  {LIBELLES[l.statut] ?? l.statut}
                </span>
                {l.origine === "manuel" && (
                  <span className="discret" style={{ fontSize: ".75rem" }}>Saisi à la main</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="discret" style={{ padding: "1.125rem .5rem" }}>
        {visibles.length} demande{visibles.length > 1 ? "s" : ""} sur {lignes.length}.
      </p>
    </main>
  );
}
