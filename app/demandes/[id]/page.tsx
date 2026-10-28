"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { sb, type Demande } from "@/lib/supabase-browser";
import {
  LIBELLES_PROBLEME, LIBELLES_STATUT, heure, jour, dureeTexte,
  lienWaze, lienGoogleMaps, lienAppleMaps,
} from "@/lib/affichage";
import Garde from "../../composants/Garde";

type Appel = {
  transcript: string | null;
  resume: string | null;
  duree_s: number | null;
  numero_appelant: string | null;
};

export default function Detail() {
  return <Garde><Contenu /></Garde>;
}

function Contenu() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [d, setD] = useState<Demande | null>(null);
  const [appel, setAppel] = useState<Appel | null>(null);
  const [transcriptOuvert, setTranscriptOuvert] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await sb
        .from("demandes")
        .select("*, rendez_vous(debut, fin, statut)")
        .eq("id", id)
        .single();
      if (!data) return;
      const dem = data as Demande;
      setD(dem);

      if (dem.appel_id) {
        const { data: a } = await sb
          .from("appels")
          .select("transcript, resume, duree_s, numero_appelant")
          .eq("id", dem.appel_id)
          .single();
        setAppel(a as Appel);
      }
    })();
  }, [id]);

  async function marquerTraitee() {
    if (!d) return;
    await sb.from("demandes").update({ statut: "traitee" }).eq("id", d.id);
    router.push("/demandes");
  }

  if (!d) return <main className="page" />;

  const rdv = d.rendez_vous?.[0];
  const destination = [d.adresse, d.commune].filter(Boolean).join(", ");
  const tel = d.telephone_client ?? appel?.numero_appelant ?? null;

  // OpenStreetMap : libre, sans clé, et l'encadré se règle à la main.
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
        ← Demandes
      </button>

      <h1>{d.nom_client ?? "Demande"}</h1>
      <p className="sous-titre">
        {LIBELLES_PROBLEME[d.type_probleme ?? "autre"]}
        {d.duree_estimee_min ? ` · ${dureeTexte(d.duree_estimee_min)} à prévoir` : ""}
        {d.urgence === "haute" ? " · Urgent" : ""}
      </p>

      {rdv && (
        <div className="bandeau-rdv">
          <div className="bandeau-rdv-jour">{jour(rdv.debut)}</div>
          <div className="bandeau-rdv-heure">{heure(rdv.debut)}</div>
        </div>
      )}

      {/* Les deux gestes réels : appeler, et y aller. */}
      <div className="actions">
        {tel && (
          <a className="bouton" data-style="plein" href={`tel:${tel}`}>
            Appeler
          </a>
        )}
        {destination && (
          <a className="bouton" href={lienWaze(destination)}
             target="_blank" rel="noreferrer"
             data-pleine-largeur={!tel}>
            Waze
          </a>
        )}
      </div>

      {carte && (
        <div className="carte-lieu">
          <iframe
            src={carte}
            title={`Carte — ${destination}`}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
          <div className="carte-lieu-pied">
            <span>{destination}</span>
            <span className="carte-lieu-liens">
              <a href={lienGoogleMaps(destination)} target="_blank" rel="noreferrer">
                Google Maps
              </a>
              <a href={lienAppleMaps(destination)} target="_blank" rel="noreferrer">
                Plans
              </a>
            </span>
          </div>
        </div>
      )}

      <div className="bloc">
        {d.description_client && (
          <div className="champ">
            <div className="champ-nom">Ce que dit le client</div>
            <div className="citation">{d.description_client}</div>
          </div>
        )}

        {!carte && destination && (
          <div className="champ">
            <div className="champ-nom">Adresse</div>
            <div className="champ-valeur">
              {d.adresse}{d.commune && <><br />{d.commune}</>}
            </div>
            <div className="liens-carte">
              <a href={lienGoogleMaps(destination)} target="_blank" rel="noreferrer">
                Google Maps
              </a>
              <a href={lienAppleMaps(destination)} target="_blank" rel="noreferrer">
                Plans
              </a>
            </div>
          </div>
        )}

        {tel && (
          <div className="champ">
            <div className="champ-nom">Téléphone</div>
            <div className="champ-valeur">
              <a href={`tel:${tel}`} style={{ color: "var(--accent)" }}>{tel}</a>
            </div>
          </div>
        )}

        <div className="champ">
          <div className="champ-nom">Statut</div>
          <div className="champ-valeur">{LIBELLES_STATUT[d.statut] ?? d.statut}</div>
        </div>

        {d.questions_en_suspens && (
          <div className="champ">
            <div className="champ-nom">Questions en suspens</div>
            <div className="champ-valeur">{d.questions_en_suspens}</div>
          </div>
        )}
      </div>

      {appel?.resume && (
        <div className="bloc">
          <div className="champ-nom">Résumé de l'appel</div>
          <p style={{ margin: ".25rem 0 0" }}>{appel.resume}</p>
        </div>
      )}

      {appel?.transcript && (
        <div className="bloc">
          <button
            onClick={() => setTranscriptOuvert(!transcriptOuvert)}
            style={{ background: "none", border: 0, padding: 0, cursor: "pointer",
                     display: "flex", width: "100%", justifyContent: "space-between",
                     alignItems: "center" }}
          >
            <span className="champ-nom" style={{ marginBottom: 0 }}>
              Transcription{appel.duree_s ? ` · ${Math.round(appel.duree_s / 60)} min` : ""}
            </span>
            <span className="discret">{transcriptOuvert ? "Masquer" : "Lire"}</span>
          </button>
          {transcriptOuvert && (
            <div className="transcription" style={{ marginTop: ".875rem" }}>
              {appel.transcript}
            </div>
          )}
        </div>
      )}

      {d.statut !== "traitee" && (
        <button className="bouton" onClick={marquerTraitee}
                style={{ width: "100%", marginTop: ".5rem" }}>
          Marquer comme traitée
        </button>
      )}
    </main>
  );
}
