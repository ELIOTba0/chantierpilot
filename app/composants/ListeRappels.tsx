"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  listerRappels, mettreAJourRappel, messageErreur, optionsEntreprises,
  type FiltresRappels, type Page, type Rappel,
} from "@/lib/donnees";
import { PRIORITE, STATUT_RAPPEL, libelleProbleme } from "@/lib/affichage";
import { aujourdhuiSaisie, dateCourte, dateHeure, depuisSaisieHoraire } from "@/lib/dates";
import { Champ, Chargement, Dialogue, EtatVide, Message, Pagination, Puce, type Retour } from "./Ui";

/**
 * Les personnes à rappeler, avec les actions qui vont avec. Toutes les
 * modifications passent par rappel_mettre_a_jour(), qui vérifie en
 * base que le rappel appartient bien à l'entreprise de l'utilisateur.
 *
 * Aucun appel n'est passé depuis ici : le numéro s'ouvre dans le
 * composeur du téléphone, et c'est au plombier de dire ensuite que le
 * rappel est fait.
 */
export default function ListeRappels({
  baseAppels, admin = false, entrepriseFixe, surModification,
}: {
  baseAppels: string;
  admin?: boolean;
  entrepriseFixe?: string;
  surModification?: () => void;
}) {
  const [vue, setVue] = useState<NonNullable<FiltresRappels["vue"]>>("ouverts");
  const [priorite, setPriorite] = useState("");
  const [recherche, setRecherche] = useState("");
  const [rechercheActive, setRechercheActive] = useState("");
  const [entreprise, setEntreprise] = useState("");
  const [page, setPage] = useState(0);
  const [entreprises, setEntreprises] = useState<{ id: string; nom: string }[]>([]);

  const [donnees, setDonnees] = useState<Page<Rappel> | null>(null);
  const [erreur, setErreur] = useState("");
  const [retour, setRetour] = useState<Retour>(null);
  const [version, setVersion] = useState(0);

  const [action, setAction] = useState<{ type: "effectue" | "reporte"; r: Rappel } | null>(null);
  const [note, setNote] = useState("");
  const [quand, setQuand] = useState("");
  const [envoi, setEnvoi] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setRechercheActive(recherche), 300);
    return () => clearTimeout(t);
  }, [recherche]);

  useEffect(() => { setPage(0); }, [vue, priorite, rechercheActive, entreprise]);

  useEffect(() => {
    if (admin && !entrepriseFixe) optionsEntreprises().then(setEntreprises).catch(() => {});
  }, [admin, entrepriseFixe]);

  useEffect(() => {
    let vivant = true;
    listerRappels({ vue, priorite, recherche: rechercheActive,
                    entreprise: entrepriseFixe ?? entreprise, page })
      .then((d) => { if (vivant) { setDonnees(d); setErreur(""); } })
      .catch((e) => { if (vivant) { setErreur(messageErreur(e)); setDonnees({ lignes: [], total: 0 }); } });
    return () => { vivant = false; };
  }, [vue, priorite, rechercheActive, entreprise, entrepriseFixe, page, version]);

  const fermerMessage = useCallback(() => setRetour(null), []);

  async function appliquer(r: Rappel, statut: Rappel["statut"], opts: { echeance?: string | null; note?: string } = {},
                           confirmation?: string) {
    setEnvoi(true);
    try {
      await mettreAJourRappel(r.id, statut, opts);
      setRetour({ type: "ok", texte: confirmation ?? "Rappel mis à jour." });
      setAction(null);
      setVersion((v) => v + 1);
      surModification?.();
    } catch (e) {
      setRetour({ type: "erreur", texte: messageErreur(e) });
    } finally {
      setEnvoi(false);
    }
  }

  function ouvrir(type: "effectue" | "reporte", r: Rappel) {
    setNote("");
    setQuand(`${aujourdhuiSaisie(1)}T09:00`);
    setAction({ type, r });
  }

  return (
    <>
      <Message retour={retour} fermer={fermerMessage} />

      <div className="onglets-vue" role="tablist" aria-label="Rappels à afficher">
        {([["ouverts", "En attente"], ["clos", "Traités"], ["tous", "Tous"]] as const).map(([v, l]) => (
          <button key={v} role="tab" aria-selected={vue === v} data-actif={vue === v}
                  onClick={() => setVue(v)} type="button">
            {l}
          </button>
        ))}
      </div>

      <div className="filtres" role="search">
        <div className="filtre filtre-large">
          <label htmlFor="recherche-rappels">Rechercher</label>
          <input id="recherche-rappels" type="search" placeholder="Nom ou numéro de téléphone"
                 value={recherche} onChange={(e) => setRecherche(e.target.value)} />
        </div>
        <div className="filtre">
          <label htmlFor="priorite">Priorité</label>
          <select id="priorite" value={priorite} onChange={(e) => setPriorite(e.target.value)}>
            <option value="">Toutes</option>
            <option value="haute">Haute</option>
            <option value="moyenne">Moyenne</option>
            <option value="basse">Basse</option>
          </select>
        </div>
        {admin && !entrepriseFixe && (
          <div className="filtre">
            <label htmlFor="entreprise-rappels">Entreprise</label>
            <select id="entreprise-rappels" value={entreprise} onChange={(e) => setEntreprise(e.target.value)}>
              <option value="">Toutes</option>
              {entreprises.map((x) => <option key={x.id} value={x.id}>{x.nom}</option>)}
            </select>
          </div>
        )}
      </div>

      <div className="resume-liste">
        <span className="discret" aria-live="polite">
          {donnees ? `${donnees.total} rappel${donnees.total > 1 ? "s" : ""}` : "Chargement…"}
        </span>
      </div>

      {erreur && <p className="encart-erreur" role="alert">{erreur}</p>}

      {!donnees ? <Chargement /> : donnees.lignes.length === 0 ? (
        <EtatVide titre={vue === "ouverts" ? "Personne à rappeler." : "Aucun rappel ne correspond."}>
          {vue === "ouverts" && !rechercheActive && !priorite
            ? "Quand l'assistant ne peut pas fixer de rendez-vous, la personne apparaît ici."
            : "Modifiez la recherche ou les filtres."}
        </EtatVide>
      ) : (
        <ul className="liste-rappels">
          {donnees.lignes.map((r) => (
            <li key={r.id} className="rappel" data-retard={r.en_retard}>
              <div className="rappel-tete">
                <div style={{ minWidth: 0 }}>
                  <div className="carte-titre">{r.nom_client ?? "Appelant inconnu"}</div>
                  {r.telephone
                    ? <a href={`tel:${r.telephone.replace(/\s/g, "")}`} className="rappel-tel tabulaire"
                         title="Ouvre le composeur de votre téléphone">{r.telephone}</a>
                    : <span className="discret">Numéro inconnu</span>}
                </div>
                <div className="rappel-puces">
                  {r.en_retard && <span className="puce" data-ton="urgent">En retard</span>}
                  {r.priorite && <Puce l={PRIORITE[r.priorite]} />}
                  <Puce l={STATUT_RAPPEL[r.statut]} />
                </div>
              </div>

              <dl className="rappel-faits">
                <div><dt>Appel initial</dt><dd>{dateHeure(r.date_appel)}</dd></div>
                <div><dt>Motif</dt><dd>{libelleProbleme(r.motif)}</dd></div>
                {r.statut === "reporte" && r.echeance &&
                  <div><dt>Reporté au</dt><dd>{dateHeure(r.echeance)}</dd></div>}
                {r.statut === "a_faire" && r.echeance &&
                  <div><dt>À rappeler avant</dt><dd>{dateHeure(r.echeance)}</dd></div>}
                {r.effectue_le &&
                  <div><dt>{r.statut === "effectue" ? "Fait le" : "Clos le"}</dt><dd>{dateCourte(r.effectue_le)}</dd></div>}
                {admin && <div><dt>Entreprise</dt><dd>{r.entreprise_nom}</dd></div>}
              </dl>

              <p className="rappel-raison"><span className="champ-nom">Raison du rappel</span>{r.raison}</p>
              {r.note && <p className="rappel-note">{r.note}</p>}

              <div className="rappel-actions">
                {r.ouvert ? (
                  <>
                    <button className="bouton" data-style="plein" data-taille="petit"
                            onClick={() => ouvrir("effectue", r)}>
                      Marquer effectué
                    </button>
                    <button className="bouton" data-taille="petit" onClick={() => ouvrir("reporte", r)}>
                      Reporter
                    </button>
                    <button className="bouton" data-style="nu" data-taille="petit" disabled={envoi}
                            onClick={() => {
                              if (confirm(`Abandonner le rappel de ${r.nom_client ?? "cet appelant"} ? Il restera consultable dans « Traités ».`))
                                appliquer(r, "abandonne", {}, "Rappel abandonné.");
                            }}>
                      Abandonner
                    </button>
                  </>
                ) : (
                  <button className="bouton" data-taille="petit" disabled={envoi}
                          onClick={() => appliquer(r, "a_faire", {}, "Rappel remis en attente.")}>
                    Remettre à faire
                  </button>
                )}
                {r.appel_id && (
                  <Link className="bouton" data-style="nu" data-taille="petit"
                        href={`${baseAppels}/${r.appel_id}`}>
                    Voir l&apos;appel
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {donnees && <Pagination page={page} total={donnees.total} surPage={setPage} />}

      <Dialogue ouvert={action !== null} fermer={() => setAction(null)}
                titre={action?.type === "reporte" ? "Reporter le rappel" : "Rappel effectué"}>
        {action && (
          <form onSubmit={(e) => {
            e.preventDefault();
            if (action.type === "reporte") {
              const iso = depuisSaisieHoraire(quand);
              if (!iso || new Date(iso) <= new Date()) {
                setRetour({ type: "erreur", texte: "Choisissez une date et une heure à venir." });
                return;
              }
              appliquer(action.r, "reporte", { echeance: iso, note },
                        `Rappel reporté au ${dateHeure(iso)}.`);
            } else {
              appliquer(action.r, "effectue", { note }, "Rappel marqué comme effectué.");
            }
          }}>
            <p className="discret" style={{ marginTop: 0 }}>
              {action.r.nom_client ?? "Appelant inconnu"} · {action.r.telephone ?? "numéro inconnu"}
            </p>
            {action.type === "reporte" && (
              <Champ id="quand" libelle="Rappeler le">
                <input id="quand" type="datetime-local" required value={quand}
                       min={`${aujourdhuiSaisie()}T00:00`} onChange={(e) => setQuand(e.target.value)} />
              </Champ>
            )}
            <Champ id="note" libelle="Note (facultative)"
                   aide={action.type === "effectue" ? "Par exemple : devis envoyé, rendez-vous fixé." : undefined}>
              <textarea id="note" maxLength={2000} rows={3} value={note}
                        onChange={(e) => setNote(e.target.value)} />
            </Champ>
            <div className="actions" style={{ marginBottom: 0 }}>
              <button className="bouton" data-style="plein" disabled={envoi}>
                {envoi ? "Enregistrement…" : action.type === "reporte" ? "Reporter" : "Confirmer"}
              </button>
              <button type="button" className="bouton" data-style="nu" onClick={() => setAction(null)}>
                Annuler
              </button>
            </div>
          </form>
        )}
      </Dialogue>
    </>
  );
}
