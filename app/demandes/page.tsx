"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { sb, type Demande } from "@/lib/supabase-browser";
import {
  LIBELLES_PROBLEME, PRIORITE, RESULTAT_APPEL, RESULTAT_INCONNU, TRAITEMENT_APPEL,
  heure, ilYA, dureeTexte, libelleProbleme, lienWaze,
} from "@/lib/affichage";
import {
  chargerIndicateurs, listerAppels, listerRappels,
  type Appel, type Indicateurs as Chiffres, type Rappel,
} from "@/lib/donnees";
import { dateHeure } from "@/lib/dates";
import Entete from "../composants/Entete";
import Garde from "../composants/Garde";
import { Erreur, Vide, type ErreurPostgrest } from "../composants/Etat";
import { Indicateur, Indicateurs, Puce } from "../composants/Ui";
import CalendrierSemaine from "../composants/CalendrierSemaine";

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
  const [chiffres, setChiffres] = useState<Chiffres | null>(null);
  const [rappels, setRappels] = useState<Rappel[]>([]);
  const [recents, setRecents] = useState<Appel[]>([]);
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

      // Indicateurs, rappels et appels récents : calculés en base, sur
      // le seul périmètre de l'entreprise (RLS).
      try {
        const [c, r, a] = await Promise.all([
          chargerIndicateurs(),
          listerRappels({ vue: "ouverts" }),
          listerAppels({ ordre: "recent" }),
        ]);
        if (!vivant.current) return;
        setChiffres(c);
        setRappels(r.lignes.slice(0, 6));
        setRecents(a.lignes.slice(0, 6));
      } catch {
        // Les blocs concernés restent vides ; l'écran du jour s'affiche.
      }

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
      .on("postgres_changes",
          { event: "*", schema: "public", table: "appels" },
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


  const faites = duJour.filter(
    (d) => new Date(d.rendez_vous![0].fin).getTime() < maintenant
  ).length;

  const resume = [
    duJour.length === 0
      ? "Aucune intervention prévue aujourd'hui."
      : `${duJour.length} intervention${duJour.length > 1 ? "s" : ""}${
          faites > 0 ? `, dont ${faites} déjà faite${faites > 1 ? "s" : ""}` : ""
        }.`,
    chiffres && chiffres.rappels_en_attente > 0
      ? `${chiffres.rappels_en_attente} personne${chiffres.rappels_en_attente > 1 ? "s" : ""} à rappeler.`
      : "",
  ].filter(Boolean).join(" ");

  const premier = rappels[0];
  const enRetard = chiffres?.rappels_en_retard ?? 0;

  return (
    <main className="page">
      <h1>{DATE_LONGUE.format(new Date())}</h1>
      <p className="sous-titre">{resume}</p>

      <Erreur e={erreur} />
      {demandes.length === 0 && <Vide indices={indices} />}

      <div className="cartes-action">
        <Link href="/appels" className="carte-action">
          <span className="carte-action-titre">Appels reçus aujourd&apos;hui</span>
          <span className="carte-action-valeur">{chiffres?.appels_aujourdhui ?? "—"}</span>
          <span className="carte-action-texte">
            {!chiffres ? "" : chiffres.appels_aujourdhui === 0
              ? "Aucun appel pour l'instant aujourd'hui."
              : `${chiffres.appels_aujourdhui_traites} traité${chiffres.appels_aujourdhui_traites > 1 ? "s" : ""} par l'assistant sans vous solliciter.`}
          </span>
          <span className="carte-action-lien">Voir les appels →</span>
        </Link>

        <Link href="/rappels" className="carte-action" data-ton={enRetard > 0 ? "urgent" : undefined}>
          <span className="carte-action-titre">À rappeler</span>
          <span className="carte-action-valeur">{chiffres?.rappels_en_attente ?? "—"}</span>
          <span className="carte-action-texte">
            {premier
              ? `Commencez par ${premier.nom_client ?? "l'appelant inconnu"}${premier.raison ? ` : ${premier.raison.charAt(0).toLowerCase()}${premier.raison.slice(1)}` : "."}`
              : "Personne n'attend de rappel."}
            {enRetard > 0 && ` ${enRetard} rappel${enRetard > 1 ? "s" : ""} en retard.`}
          </span>
          <span className="carte-action-lien">Traiter les rappels →</span>
        </Link>
      </div>

      <Indicateurs>
        <Indicateur titre="Appels reçus" valeur={chiffres?.appels_7j ?? null}
                    detail="7 derniers jours" href="/appels" />
        <Indicateur titre="RDV pris par l'IA" valeur={chiffres?.rdv_ia_7j ?? null}
                    detail={chiffres ? `${chiffres.rdv_a_venir} à venir` : undefined} href="/rendez-vous" />
        <Indicateur titre="À rappeler" valeur={chiffres?.rappels_en_attente ?? null}
                    detail={chiffres && chiffres.rappels_en_retard > 0
                      ? `dont ${chiffres.rappels_en_retard} en retard` : "en attente"}
                    href="/rappels" ton={chiffres && chiffres.rappels_en_retard > 0 ? "urgent" : undefined} />
        <Indicateur titre="Appels traités" valeur={chiffres?.appels_traites_7j ?? null}
                    detail={chiffres && chiffres.appels_7j > 0
                      ? `${Math.round(100 * chiffres.appels_traites_7j / chiffres.appels_7j)} % des appels de la semaine`
                      : "7 derniers jours"} href="/appels" />
      </Indicateurs>

      {prochain && (
        <>
          <p className="titre-section">Prochaine intervention</p>
          <Hero d={prochain} />
        </>
      )}

      <h2>Cette semaine</h2>
      <CalendrierSemaine
        lien={(r) => (r.demande_id ? `/demandes/${r.demande_id}` : "/rendez-vous")}
        actions={<Link className="bouton" data-taille="petit" href="/agenda">Planning complet</Link>} />

      <div className="colonnes">
        <div className="colonne-large">
          <h2>Derniers appels</h2>
          {recents.length === 0 ? (
            <div className="vide"><p>Aucun appel ces 7 derniers jours.</p></div>
          ) : (
            <div className="liste">
              {recents.map((a) => (
                <Link key={a.id} href={`/appels/${a.id}`} className="carte" style={{ display: "block" }}>
                  <div className="carte-haut">
                    <span className="carte-titre">{a.nom_appelant ?? a.numero_appelant ?? "Appelant inconnu"}</span>
                    <span className="carte-quand">{dateHeure(a.date_appel)}</span>
                  </div>
                  <div className="carte-desc">{a.resume ?? libelleProbleme(a.motif)}</div>
                  <div className="carte-bas">
                    <Puce l={TRAITEMENT_APPEL[a.traitement]} />
                    <Puce l={a.resultat ? RESULTAT_APPEL[a.resultat] ?? RESULTAT_INCONNU : RESULTAT_INCONNU} />
                  </div>
                </Link>
              ))}
            </div>
          )}
          <p><Link href="/appels">Tout l&apos;historique →</Link></p>
        </div>

        <aside className="colonne-cote">
          <h2 style={{ marginTop: 0 }}>À rappeler en priorité</h2>

          {rappels.length === 0 ? (
            <div className="vide"><p>Personne à rappeler.</p></div>
          ) : (
            <div className="liste">
              {rappels.map((r) => (
                <Link key={r.id} href={r.appel_id ? `/appels/${r.appel_id}` : "/rappels"} className="carte"
                      style={{ gap: 0, display: "block" }}>
                  <div className="carte-haut">
                    <span className="carte-titre">{r.nom_client ?? "Appelant inconnu"}</span>
                    <span className="carte-quand">{ilYA(r.date_appel)}</span>
                  </div>
                  <div className="carte-desc">{r.raison}</div>
                  <div className="carte-bas">
                    {r.en_retard && <span className="puce" data-ton="urgent">En retard</span>}
                    {r.priorite && <Puce l={PRIORITE[r.priorite]} />}
                    <span>{libelleProbleme(r.motif)}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
          <p><Link href="/rappels">Tous les rappels →</Link></p>

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
