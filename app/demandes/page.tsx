"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { sb, type Demande } from "@/lib/supabase-browser";
import {
  LIBELLES_PROBLEME, LIBELLES_STATUT, heure, ilYA, dureeTexte, lienWaze,
} from "@/lib/affichage";
import Entete from "../composants/Entete";
import Garde from "../composants/Garde";
import { Erreur, Vide, type ErreurPostgrest } from "../composants/Etat";

export default function Aujourdhui() {
  return (
    <Garde>
      <Entete />
      <Contenu />
    </Garde>
  );
}

const DATE_LONGUE = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Paris",
});

function Contenu() {
  const [demandes, setDemandes] = useState<Demande[]>([]);
  const [erreur, setErreur] = useState<ErreurPostgrest>(null);
  const [indices, setIndices] = useState<string[]>([]);
  const [chargement, setChargement] = useState(true);
  const vivant = useRef(true);

  useEffect(() => {
    vivant.current = true;

    async function charger() {
      const { data, error } = await sb
        .from("demandes")
        .select("*, rendez_vous(debut, fin, statut)")
        .order("cree_le", { ascending: false })
        .limit(100);

      if (!vivant.current) return;

      // Le client Supabase ne lève pas d'exception : il renvoie
      // l'erreur dans l'objet. L'ignorer, c'est s'aveugler.
      if (error) {
        setErreur(error);
        setChargement(false);
        return;
      }

      setErreur(null);
      const lignes = (data as Demande[]) ?? [];
      setDemandes(lignes);

      if (lignes.length === 0 && process.env.NODE_ENV !== "production") {
        const total = await sb.from("demandes").select("id", { count: "exact", head: true });
        setIndices([
          "requête : demandes + rendez_vous, sans filtre, limite 100",
          total.error
            ? `comptage : ${total.error.message} (${total.error.code ?? "?"})`
            : `la table contient ${total.count ?? 0} ligne(s) visibles pour ce compte`,
          (total.count ?? 0) === 0
            ? "→ la RLS ne laisse rien passer : vérifier plombiers.auth_user_id"
            : "→ incohérence entre le comptage et la lecture",
        ]);
      }

      setChargement(false);
    }

    charger();

    // Une demande arrive pendant que l'écran est ouvert : elle
    // apparaît sans rafraîchir.
    const canal = sb
      .channel("demandes-live")
      .on("postgres_changes",
          { event: "*", schema: "public", table: "demandes" },
          () => charger())
      .subscribe();

    return () => { vivant.current = false; sb.removeChannel(canal); };
  }, []);

  if (chargement) return <main className="page" />;

  const maintenant = Date.now();
  const auj = new Date().toDateString();

  const avecRdv = demandes.filter((d) => d.rendez_vous?.[0]);

  const duJour = avecRdv
    .filter((d) => new Date(d.rendez_vous![0].debut).toDateString() === auj)
    .sort((a, b) => a.rendez_vous![0].debut.localeCompare(b.rendez_vous![0].debut));

  const prochain = duJour.find(
    (d) => new Date(d.rendez_vous![0].debut).getTime() >= maintenant
  );

  const aTraiter = demandes.filter(
    (d) => d.statut === "nouvelle" || d.statut === "a_rappeler"
  );

  const faites = duJour.filter(
    (d) => new Date(d.rendez_vous![0].fin).getTime() < maintenant
  ).length;

  const resume = [
    duJour.length === 0
      ? "Aucune intervention prévue aujourd'hui."
      : `${duJour.length} intervention${duJour.length > 1 ? "s" : ""}${
          faites > 0 ? `, dont ${faites} déjà faite${faites > 1 ? "s" : ""}` : ""
        }.`,
    aTraiter.length > 0
      ? `${aTraiter.length} demande${aTraiter.length > 1 ? "s" : ""} en attente de votre rappel.`
      : "",
  ].filter(Boolean).join(" ");

  return (
    <main className="page">
      <h1>{DATE_LONGUE.format(new Date())}</h1>
      <p className="sous-titre">{resume}</p>

      <Erreur e={erreur} />
      {demandes.length === 0 && <Vide indices={indices} />}

      <div className="colonnes">
        <div className="colonne-large">

          {prochain ? (
            <>
              <p className="titre-section">Prochaine intervention</p>
              <Hero d={prochain} />
            </>
          ) : duJour.length > 0 ? (
            <div className="encadre">
              <h2>Journée terminée</h2>
              Plus rien de prévu aujourd&apos;hui. L&apos;assistant continue de
              prendre les appels.
            </div>
          ) : null}

          {duJour.length > 0 && (
            <>
              <h2>La journée</h2>
              <div className="liste">
                {duJour.map((d) => {
                  const r = d.rendez_vous![0];
                  const passe = new Date(r.fin).getTime() < maintenant;
                  return (
                    <Link key={d.id} href={`/demandes/${d.id}`} className="rdv"
                          data-passe={passe}
                          data-prochain={prochain?.id === d.id}>
                      <div className="rdv-heure">{heure(r.debut)}</div>
                      <div className="rdv-corps">
                        <div className="carte-titre">
                          {d.nom_client ?? LIBELLES_PROBLEME[d.type_probleme ?? "autre"]}
                        </div>
                        <div className="carte-desc">
                          {LIBELLES_PROBLEME[d.type_probleme ?? "autre"]}
                          {[d.adresse, d.commune].filter(Boolean).length > 0 &&
                            ` · ${[d.adresse, d.commune].filter(Boolean).join(", ")}`}
                        </div>
                      </div>
                      {d.urgence === "haute" && (
                        <span className="puce" data-ton="haute">Urgent</span>
                      )}
                      {passe && <span className="discret">Terminé</span>}
                    </Link>
                  );
                })}
              </div>
            </>
          )}
        </div>

        <aside className="colonne-cote">
          <h2 style={{ marginTop: 0 }}>À rappeler</h2>

          {aTraiter.length === 0 ? (
            <div className="vide"><p>Rien en attente.</p></div>
          ) : (
            <div className="liste">
              {aTraiter.slice(0, 6).map((d) => (
                <Link key={d.id} href={`/demandes/${d.id}`} className="carte"
                      style={{ gap: 0, display: "block" }}>
                  <div className="carte-haut">
                    <span className="carte-titre">
                      {d.nom_client ?? LIBELLES_PROBLEME[d.type_probleme ?? "autre"]}
                    </span>
                    <span className="carte-quand">{ilYA(d.cree_le)}</span>
                  </div>
                  <div className="carte-desc">
                    {d.description_client ??
                      LIBELLES_PROBLEME[d.type_probleme ?? "autre"]}
                  </div>
                  <div className="carte-bas">
                    <span className="puce" data-ton={d.statut}>
                      {LIBELLES_STATUT[d.statut] ?? d.statut}
                    </span>
                    {d.commune && <span>{d.commune}</span>}
                  </div>
                </Link>
              ))}
            </div>
          )}

          <div className="encadre" style={{ marginTop: "2.5rem" }}>
            <h2 style={{ marginTop: 0 }}>L&apos;assistant</h2>
            {demandes.length} demande{demandes.length > 1 ? "s" : ""} recueillie
            {demandes.length > 1 ? "s" : ""} au total, dont{" "}
            {avecRdv.length} transformée{avecRdv.length > 1 ? "s" : ""} en
            rendez-vous.
          </div>
        </aside>
      </div>
    </main>
  );
}

function Hero({ d }: { d: Demande }) {
  const r = d.rendez_vous![0];
  const destination = [d.adresse, d.commune].filter(Boolean).join(", ");

  return (
    <div className="hero">
      <div className="hero-haut">
        <div className="hero-heure">{heure(r.debut)}</div>
        <div style={{ flex: "1 1 260px", minWidth: 0 }}>
          <div className="hero-nom">
            {d.nom_client ?? LIBELLES_PROBLEME[d.type_probleme ?? "autre"]}
          </div>
          <div className="carte-desc">
            {d.description_client ?? LIBELLES_PROBLEME[d.type_probleme ?? "autre"]}
          </div>
        </div>
      </div>

      <div className="hero-faits">
        {destination && (
          <div style={{ flex: "1 1 240px", minWidth: 0 }}>
            <div className="champ-nom">Adresse</div>
            <div className="champ-valeur">
              {d.adresse}{d.commune && <><br />{d.commune}</>}
            </div>
          </div>
        )}
        {d.telephone_client && (
          <div style={{ flex: "0 1 200px", minWidth: 0 }}>
            <div className="champ-nom">Téléphone</div>
            <div className="champ-valeur" style={{ fontVariantNumeric: "tabular-nums" }}>
              {d.telephone_client}
            </div>
          </div>
        )}
        {d.duree_estimee_min && (
          <div style={{ flex: "0 1 160px", minWidth: 0 }}>
            <div className="champ-nom">Durée prévue</div>
            <div className="champ-valeur">{dureeTexte(d.duree_estimee_min)}</div>
          </div>
        )}
      </div>

      <div className="actions" style={{ marginBottom: 0 }}>
        {destination && (
          <a className="bouton" data-style="plein" href={lienWaze(destination)}
             target="_blank" rel="noreferrer">
            Y aller
          </a>
        )}
        {d.telephone_client && (
          <a className="bouton" href={`tel:${d.telephone_client}`}>Appeler</a>
        )}
        <Link className="bouton" data-style="nu" href={`/demandes/${d.id}`}>
          Voir la fiche
        </Link>
      </div>
    </div>
  );
}
