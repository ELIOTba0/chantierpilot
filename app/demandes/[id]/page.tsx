"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { sb } from "@/lib/supabase-browser";
import {
  LIBELLES_PROBLEME, heure, dureeTexte,
  lienWaze, lienGoogleMaps, tours,
} from "@/lib/affichage";
import Entete from "../../composants/Entete";
import Garde from "../../composants/Garde";
import { Erreur, type ErreurPostgrest } from "../../composants/Etat";

type Fiche = {
  id: string;
  type_probleme: string | null;
  description_client: string | null;
  adresse: string | null;
  commune: string | null;
  latitude: number | null;
  longitude: number | null;
  adresse_verifiee: boolean | null;
  urgence: "haute" | "moyenne" | "basse" | null;
  duree_estimee_min: number | null;
  nom_client: string | null;
  telephone_client: string | null;
  statut: string;
  questions_en_suspens: string | null;
  cree_le: string;
  appel_id: string | null;
  client_id: string | null;
  rendez_vous?: {
    id: string; debut: string; fin: string; statut: string;
    origine: string | null; trajet_min: number | null; termine_le: string | null;
  }[];
};

type Appel = {
  transcript: string | null;
  resume: string | null;
  duree_s: number | null;
  numero_appelant: string | null;
  debut: string | null;
};

type Client = { nb_demandes: number | null; premier_appel: string | null; notes: string | null };

const DATE_LONGUE = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Paris",
});

const LIBELLES_URGENCE: Record<string, string> = {
  haute: "Urgent",
  moyenne: "Urgence modérée",
  basse: "Pas d'urgence",
};

export default function Detail() {
  return <Garde><Entete /><Contenu /></Garde>;
}

function Contenu() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [d, setD] = useState<Fiche | null>(null);
  const [appel, setAppel] = useState<Appel | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [erreur, setErreur] = useState<ErreurPostgrest>(null);
  const [tout, setTout] = useState(false);
  const [action, setAction] = useState<"" | "en_cours">("");

  useEffect(() => {
    (async () => {
      const { data, error } = await sb
        .from("demandes")
        .select("*, rendez_vous(id, debut, fin, statut, origine, trajet_min, termine_le)")
        .eq("id", id)
        .single();

      if (error) { setErreur(error); return; }
      const fiche = data as Fiche;
      setD(fiche);

      if (fiche.appel_id) {
        const { data: a } = await sb
          .from("appels")
          .select("transcript, resume, duree_s, numero_appelant, debut")
          .eq("id", fiche.appel_id)
          .maybeSingle();
        setAppel(a as Appel);
      }

      if (fiche.client_id) {
        const { data: c } = await sb
          .from("clients")
          .select("nb_demandes, premier_appel, notes")
          .eq("id", fiche.client_id)
          .maybeSingle();
        setClient(c as Client);
      }
    })();
  }, [id]);

  async function terminer() {
    if (!d) return;
    setAction("en_cours");
    const rdv = d.rendez_vous?.[0];
    if (rdv) {
      await sb.from("rendez_vous")
        .update({ termine_le: new Date().toISOString() })
        .eq("id", rdv.id);
    }
    const { error } = await sb.from("demandes").update({ statut: "traitee" }).eq("id", d.id);
    if (error) { setErreur(error); setAction(""); return; }
    router.push("/demandes");
  }

  async function reporter() {
    if (!d) return;
    if (!confirm("Libérer ce créneau et remettre la demande à rappeler ?")) return;
    setAction("en_cours");
    const rdv = d.rendez_vous?.[0];
    if (rdv) {
      await sb.from("rendez_vous")
        .update({ statut: "annule", annule_le: new Date().toISOString(),
                  motif_annulation: "Reporté par le plombier" })
        .eq("id", rdv.id);
    }
    const { error } = await sb.from("demandes").update({ statut: "a_rappeler" }).eq("id", d.id);
    if (error) { setErreur(error); setAction(""); return; }
    router.push("/demandes");
  }

  if (erreur) {
    return <main className="page"><Erreur e={erreur} /></main>;
  }
  if (!d) return <main className="page" />;

  const rdv = d.rendez_vous?.[0];
  const destination = [d.adresse, d.commune].filter(Boolean).join(", ");
  const tel = d.telephone_client ?? appel?.numero_appelant ?? null;
  const echange = appel?.transcript ? tours(appel.transcript) : null;
  const visibles = echange ? (tout ? echange : echange.slice(0, 4)) : null;

  const dejaVenu = client?.nb_demandes && client.nb_demandes > 1
    ? `Oui, ${client.nb_demandes} demandes`
    : "Non, premier appel";

  // OpenStreetMap : libre, sans clé, et le cadrage se règle à la main.
  const carte = d.latitude != null && d.longitude != null
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${
        d.longitude - 0.0045},${d.latitude - 0.0022},${
        d.longitude + 0.0045},${d.latitude + 0.0022
      }&layer=mapnik&marker=${d.latitude},${d.longitude}`
    : null;

  return (
    <main className="page">
      <button className="retour" onClick={() => router.back()}
              style={{ background: "none", border: 0, cursor: "pointer" }}>
        <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path d="M11.5 5 6.5 10l5 5" stroke="currentColor" strokeWidth="1.8"
                strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Retour
      </button>

      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline",
                    gap: ".75rem 1.25rem", margin: ".75rem 0 .25rem" }}>
        <h1 style={{ margin: 0 }}>
          {d.nom_client ?? LIBELLES_PROBLEME[d.type_probleme ?? "autre"]}
        </h1>
        {d.urgence && (
          <span className="puce" data-ton={d.urgence === "haute" ? "haute" : undefined}>
            {LIBELLES_URGENCE[d.urgence] ?? d.urgence}
          </span>
        )}
      </div>

      <p className="sous-titre" style={{ textTransform: "capitalize", marginBottom: "2rem" }}>
        {rdv
          ? `${DATE_LONGUE.format(new Date(rdv.debut))} · ${heure(rdv.debut)} – ${heure(rdv.fin)}`
          : `Reçue le ${DATE_LONGUE.format(new Date(d.cree_le))}`}
      </p>

      <div className="colonnes">
        <div className="colonne-large">

          <h2 style={{ marginTop: 0 }}>Le problème</h2>
          <p style={{ margin: "0 0 .5rem", fontSize: "1.25rem", fontWeight: 600,
                      letterSpacing: "-0.015em" }}>
            {LIBELLES_PROBLEME[d.type_probleme ?? "autre"]}
          </p>
          {d.description_client && <p className="citation">{d.description_client}</p>}

          <div className="filet" />

          <h2 style={{ marginTop: 0 }}>Le client</h2>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "1.75rem 3.5rem" }}>
            {tel && (
              <div style={{ flex: "0 1 220px", minWidth: 0 }}>
                <div className="champ-nom">Téléphone</div>
                <a href={`tel:${tel}`}
                   style={{ fontSize: "1.125rem", fontWeight: 600,
                            fontVariantNumeric: "tabular-nums", textDecoration: "none" }}>
                  {tel}
                </a>
              </div>
            )}
            {appel?.debut && (
              <div style={{ flex: "0 1 220px", minWidth: 0 }}>
                <div className="champ-nom">Appel reçu</div>
                <div className="champ-valeur">
                  {heure(appel.debut)}
                  {appel.duree_s ? ` · ${Math.floor(appel.duree_s / 60)} min ${appel.duree_s % 60}` : ""}
                </div>
              </div>
            )}
            <div style={{ flex: "0 1 200px", minWidth: 0 }}>
              <div className="champ-nom">Déjà venu</div>
              <div className="champ-valeur">{dejaVenu}</div>
            </div>
          </div>

          {client?.notes && (
            <>
              <div className="filet" />
              <h2 style={{ marginTop: 0 }}>À savoir sur place</h2>
              <p className="citation">{client.notes}</p>
            </>
          )}

          {d.questions_en_suspens && (
            <>
              <div className="filet" />
              <h2 style={{ marginTop: 0 }}>Questions en suspens</h2>
              <p className="citation">{d.questions_en_suspens}</p>
            </>
          )}

          {appel?.transcript && (
            <>
              <div className="filet" />
              <h2 style={{ marginTop: 0 }}>Ce qui s&apos;est dit au téléphone</h2>

              {visibles ? (
                <div style={{ maxWidth: "62ch" }}>
                  {visibles.map((t, i) => (
                    <div key={i} style={{ display: "flex", gap: "1rem", padding: ".75rem 0",
                                          borderTop: i === 0 ? 0 : "1px solid var(--line-2)" }}>
                      <div style={{ flex: "none", width: 76, fontSize: ".8125rem", fontWeight: 600,
                                    color: t.qui === "assistant" ? "var(--accent)" : "var(--ink-2)" }}>
                        {t.qui === "assistant" ? "Assistant" : "Client"}
                      </div>
                      <div style={{ flex: "1 1 auto", minWidth: 0, fontSize: ".9375rem",
                                    lineHeight: 1.6 }}>
                        {t.texte}
                      </div>
                    </div>
                  ))}
                  {echange && echange.length > 4 && (
                    <button onClick={() => setTout(!tout)}
                            style={{ background: "none", border: 0, padding: ".75rem 0",
                                     minHeight: 44, cursor: "pointer", fontFamily: "inherit",
                                     fontSize: ".875rem", fontWeight: 600, color: "var(--accent)",
                                     borderTop: "1px solid var(--line-2)", width: "100%",
                                     textAlign: "left" }}>
                      {tout ? "Réduire l'échange" : "Lire l'échange complet →"}
                    </button>
                  )}
                </div>
              ) : (
                <div className="transcription">{appel.transcript}</div>
              )}
            </>
          )}
        </div>

        <aside className="colonne-cote">

          <div className="carte-lieu">
            {carte && (
              <iframe src={carte} title={`Carte — ${destination}`} loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade" />
            )}
            <div style={{ padding: "1.375rem 1.5rem 1.5rem" }}>
              <div className="champ-nom">Adresse</div>
              <div style={{ fontSize: "1.1875rem", fontWeight: 600, lineHeight: 1.4 }}>
                {d.adresse}{d.commune && !d.adresse?.toLowerCase().includes(d.commune.toLowerCase())
                  && <><br />{d.commune}</>}
              </div>

              {d.adresse_verifiee && (
                <div style={{ display: "flex", alignItems: "flex-start", gap: ".5rem",
                              marginTop: ".75rem", fontSize: ".8125rem", lineHeight: 1.5,
                              color: "var(--ink-2)" }}>
                  <svg width="15" height="15" viewBox="0 0 20 20" fill="none" aria-hidden="true"
                       style={{ flex: "none", marginTop: 2 }}>
                    <circle cx="10" cy="10" r="7.6" stroke="var(--accent)" strokeWidth="1.7" />
                    <path d="m6.6 10.2 2.3 2.3 4.5-4.8" stroke="var(--accent)" strokeWidth="1.9"
                          strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span>Adresse confirmée dans la Base Adresse Nationale.</span>
                </div>
              )}

              {rdv?.trajet_min != null && (
                <div className="discret" style={{ marginTop: ".5rem" }}>
                  Environ {rdv.trajet_min} min depuis le chantier précédent.
                </div>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: ".625rem",
                            marginTop: "1.375rem" }}>
                {destination && (
                  <>
                    <a className="bouton" data-style="plein" data-pleine-largeur="true"
                       href={lienWaze(destination)} target="_blank" rel="noreferrer">
                      Y aller avec Waze
                    </a>
                    <a className="bouton" data-pleine-largeur="true"
                       href={lienGoogleMaps(destination)} target="_blank" rel="noreferrer">
                      Ouvrir dans Google Maps
                    </a>
                  </>
                )}
                {tel && (
                  <a className="bouton" data-pleine-largeur="true" href={`tel:${tel}`}>
                    Appeler {d.nom_client ?? ""}
                  </a>
                )}
              </div>
            </div>
          </div>

          <div className="encadre" style={{ marginTop: "1.25rem" }}>
            <h2 style={{ marginTop: 0 }}>Où en est-on</h2>
            <p style={{ margin: "0 0 1rem" }}>
              {rdv?.termine_le
                ? "Intervention terminée."
                : rdv?.statut === "propose"
                ? "Créneau réservé, en attente de votre décision."
                : rdv
                ? "Rendez-vous confirmé et posé dans votre agenda Google."
                : "Aucun rendez-vous : cette demande attend votre rappel."}
              {d.duree_estimee_min ? ` Durée prévue ${dureeTexte(d.duree_estimee_min)}.` : ""}
            </p>

            {d.statut !== "traitee" && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: ".625rem" }}>
                <button className="bouton" onClick={terminer} disabled={action === "en_cours"}
                        style={{ minHeight: 48, borderColor: "var(--accent)",
                                 color: "var(--accent)" }}>
                  Marquer terminé
                </button>
                {rdv && (
                  <button className="bouton" onClick={reporter} disabled={action === "en_cours"}
                          style={{ minHeight: 48 }}>
                    Reporter
                  </button>
                )}
              </div>
            )}
          </div>
        </aside>
      </div>
    </main>
  );
}
