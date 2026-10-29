"use client";

import { useEffect, useState } from "react";
import { sb } from "@/lib/supabase-browser";
import Entete from "../composants/Entete";
import Garde from "../composants/Garde";
import { Erreur, type ErreurPostgrest } from "../composants/Etat";
import Squelette from "../composants/Squelette";

/* ---------------------------------------------------------------
   Horaires : « 08:00-12:00, 13:30-18:00 » ↔ objet manipulable
   --------------------------------------------------------------- */

const JOURS: [string, string][] = [
  ["1", "Lundi"], ["2", "Mardi"], ["3", "Mercredi"], ["4", "Jeudi"],
  ["5", "Vendredi"], ["6", "Samedi"], ["0", "Dimanche"],
];

type Journee = {
  actif: boolean; coupure: boolean;
  debut: string; pause: string; reprise: string; fin: string;
};

const JOURNEE_DEFAUT: Journee = {
  actif: false, coupure: true,
  debut: "08:00", pause: "12:00", reprise: "13:30", fin: "18:00",
};

function lire(valeur: string | undefined): Journee {
  if (!valeur) return { ...JOURNEE_DEFAUT };
  const tranches = valeur.split(",").map((t) => t.trim()).filter(Boolean);
  if (tranches.length === 0) return { ...JOURNEE_DEFAUT };
  const [d1, f1] = tranches[0].split("-");
  if (tranches.length === 1) {
    return { ...JOURNEE_DEFAUT, actif: true, coupure: false, debut: d1, fin: f1 };
  }
  const [d2, f2] = tranches[1].split("-");
  return { actif: true, coupure: true, debut: d1, pause: f1, reprise: d2, fin: f2 };
}

function ecrire(j: Journee): string | null {
  if (!j.actif) return null;
  return j.coupure ? `${j.debut}-${j.pause}, ${j.reprise}-${j.fin}` : `${j.debut}-${j.fin}`;
}

/* --------------------------------------------------------------- */

type Entreprise = Record<string, unknown> & { id: string };
type Membre = {
  id: string; nom: string; email: string; telephone: string; role: string;
  couleur: string; recoit_rdv: boolean; agenda_connecte: boolean | null;
  communes: string[] | null; horaires: Record<string, string> | null;
};
type Facture = { id: string; periode: string; numero: string | null;
                 montant_eur: number; statut: string; pdf_url: string | null };

const SECTIONS: [string, string][] = [
  ["entreprise", "Mon entreprise"],
  ["compte", "Mon compte"],
  ["horaires", "Horaires"],
  ["zone", "Zone d'intervention"],
  ["assistant", "L'assistant"],
  ["agenda", "Agenda"],
  ["equipe", "Équipe"],
  ["notifications", "Notifications"],
  ["abonnement", "Abonnement"],
];

export default function Reglages() {
  return <Garde><Entete /><Contenu /></Garde>;
}

function Contenu() {
  const [section, setSection] = useState("entreprise");
  const [ent, setEnt] = useState<Entreprise | null>(null);
  const [moi, setMoi] = useState<Membre | null>(null);
  const [membres, setMembres] = useState<Membre[]>([]);
  const [factures, setFactures] = useState<Facture[]>([]);
  const [semaine, setSemaine] = useState<Record<string, Journee>>({});
  const [communes, setCommunes] = useState("");
  const [erreur, setErreur] = useState<ErreurPostgrest>(null);
  const [modifie, setModifie] = useState(false);
  const [etat, setEtat] = useState<"" | "en_cours" | "ok">("");

  useEffect(() => {
    (async () => {
      const { data: e, error: errE } = await sb.from("entreprises").select("*").maybeSingle();
      if (errE) { setErreur(errE); return; }
      setEnt(e as Entreprise);

      const { data: m, error: errM } = await sb
        .from("plombiers")
        .select("id, nom, email, telephone, role, couleur, recoit_rdv, agenda_connecte, communes, horaires")
        .order("role");
      if (errM) { setErreur(errM); return; }
      const liste = (m as Membre[]) ?? [];
      setMembres(liste);

      // « Moi » : la fiche dont l'adresse correspond au compte connecté.
      const { data: u } = await sb.auth.getUser();
      const courriel = u.user?.email?.toLowerCase();
      const self = liste.find((x) => x.email?.toLowerCase() === courriel)
        ?? liste.find((x) => x.role === "gerant")
        ?? liste[0];
      setMoi(self ?? null);

      if (self) {
        const s: Record<string, Journee> = {};
        for (const [cle] of JOURS) s[cle] = lire(self.horaires?.[cle]);
        setSemaine(s);
        setCommunes((self.communes ?? []).join(", "));
      }

      const { data: f } = await sb
        .from("factures").select("*").order("periode", { ascending: false }).limit(12);
      setFactures((f as Facture[]) ?? []);
    })();
  }, []);

  function majEnt(champ: string, valeur: unknown) {
    setEnt((e) => (e ? { ...e, [champ]: valeur } : e));
    setModifie(true);
  }
  function majJour(cle: string, champ: keyof Journee, valeur: string | boolean) {
    setSemaine((s) => ({ ...s, [cle]: { ...s[cle], [champ]: valeur } }));
    setModifie(true);
  }
  function propager(source: string) {
    const modele = semaine[source];
    setSemaine((s) => {
      const copie = { ...s };
      for (const [cle] of JOURS) {
        if (cle !== source && copie[cle].actif) copie[cle] = { ...modele, actif: true };
      }
      return copie;
    });
    setModifie(true);
  }

  async function enregistrer() {
    if (!ent || !moi) return;
    setEtat("en_cours");
    setErreur(null);

    // Seules les colonnes autorisées à l'écriture par la migration 007.
    const champs = ["nom", "forme_juridique", "siret", "adresse", "ville",
      "telephone_public", "email", "site", "assurance_decennale", "phrase_accueil",
      "validation_mode", "delai_reponse_min", "delai_min_rdv_h", "duree_defaut_min",
      "creneaux_proposes", "transfert_urgence", "canal_notification", "rayon_km",
      "notif_sms_rdv", "notif_email_soir", "notif_alerte_rappel",
      "notif_client_confirmation", "notif_client_veille"];
    const charge: Record<string, unknown> = {};
    for (const c of champs) if (c in ent) charge[c] = ent[c];

    const { error: errE } = await sb.from("entreprises").update(charge).eq("id", ent.id);
    if (errE) { setErreur(errE); setEtat(""); return; }

    const horaires: Record<string, string> = {};
    for (const [cle] of JOURS) {
      const v = ecrire(semaine[cle]);
      if (v) horaires[cle] = v;
    }
    const { error: errP } = await sb.from("plombiers").update({
      horaires,
      communes: communes.split(",").map((c) => c.trim()).filter(Boolean),
      telephone: moi.telephone,
    }).eq("id", moi.id);
    if (errP) { setErreur(errP); setEtat(""); return; }

    setEtat("ok");
    setModifie(false);
    setTimeout(() => setEtat(""), 2500);
  }

  async function basculerRecoit(m: Membre) {
    const { error } = await sb.from("plombiers")
      .update({ recoit_rdv: !m.recoit_rdv }).eq("id", m.id);
    if (error) { setErreur(error); return; }
    setMembres((liste) => liste.map((x) =>
      x.id === m.id ? { ...x, recoit_rdv: !x.recoit_rdv } : x));
  }

  if (!ent || !moi) {
    if (erreur) return <main className="page"><Erreur e={erreur} /></main>;
    return <Squelette variante="formulaire" />;
  }

  const S = (champ: string) => (ent[champ] as string) ?? "";
  const N = (champ: string) => (ent[champ] as number) ?? 0;
  const B = (champ: string) => Boolean(ent[champ]);
  const manuel = S("validation_mode") !== "auto";

  return (
    <main className="page">
      <h1 style={{ marginBottom: "1.75rem" }}>Réglages</h1>

      <Erreur e={erreur} />

      <div className="colonnes">
        <nav aria-label="Sections des réglages" style={{ flex: "0 1 236px", minWidth: 0 }}>
          {SECTIONS.map(([cle, nom]) => {
            const on = section === cle;
            return (
              <button key={cle} type="button" onClick={() => setSection(cle)}
                      style={{
                        display: "flex", alignItems: "center", width: "100%",
                        textAlign: "left", minHeight: 48, padding: "0 .875rem",
                        marginBottom: 2, borderRadius: 9, border: 0,
                        fontFamily: "inherit", fontSize: ".9375rem", cursor: "pointer",
                        background: on ? "var(--accent-fond)" : "transparent",
                        color: on ? "var(--ink)" : "var(--ink-2)",
                        fontWeight: on ? 600 : 500,
                      }}>
                {nom}
              </button>
            );
          })}
        </nav>

        <div className="colonne-large">

          {section === "entreprise" && (
            <section>
              <h2 style={{ marginTop: 0, fontSize: "1.375rem", textTransform: "none",
                           letterSpacing: "-0.018em", color: "var(--ink)" }}>
                Mon entreprise
              </h2>
              <p className="sous-titre">
                Ces informations apparaissent dans les messages envoyés à vos clients.
              </p>
              <Champ id="r-nom" nom="Raison sociale" valeur={S("nom")}
                     surChange={(v) => majEnt("nom", v)} />
              <Liste id="r-forme" nom="Forme juridique" valeur={S("forme_juridique")}
                     options={[["ei", "Entreprise individuelle"], ["eurl", "EURL"],
                               ["sarl", "SARL"], ["sas", "SAS ou SASU"]]}
                     surChange={(v) => majEnt("forme_juridique", v)} />
              <Champ id="r-siret" nom="SIRET" valeur={S("siret")}
                     surChange={(v) => majEnt("siret", v)} />
              <Champ id="r-adr" nom="Adresse de l'atelier" valeur={S("adresse")}
                     surChange={(v) => majEnt("adresse", v)} />
              <Champ id="r-ville" nom="Ville" valeur={S("ville")}
                     surChange={(v) => majEnt("ville", v)} />
              <Champ id="r-telp" nom="Téléphone public" valeur={S("telephone_public")}
                     surChange={(v) => majEnt("telephone_public", v)} />
              <Champ id="r-assur" nom="Assurance décennale" valeur={S("assurance_decennale")}
                     aide="Reprise automatiquement sur vos devis."
                     surChange={(v) => majEnt("assurance_decennale", v)} />
            </section>
          )}

          {section === "compte" && (
            <section>
              <h2 style={{ marginTop: 0, fontSize: "1.375rem", textTransform: "none",
                           letterSpacing: "-0.018em", color: "var(--ink)" }}>
                Mon compte
              </h2>
              <p className="sous-titre">Vos informations et la façon dont vous vous connectez.</p>
              <div className="ligne-reglage">
                <label>Nom</label>
                <div><div className="champ-valeur">{moi.nom}</div></div>
              </div>
              <div className="ligne-reglage">
                <label>Courriel de connexion</label>
                <div>
                  <div className="champ-valeur">{moi.email}</div>
                  <div className="discret" style={{ marginTop: ".4375rem" }}>
                    C&apos;est à cette adresse qu&apos;arrive le code à six chiffres.
                    Pas de mot de passe à retenir.
                  </div>
                </div>
              </div>
              <div className="ligne-reglage">
                <label htmlFor="c-tel">Portable</label>
                <div>
                  <input id="c-tel" type="text" value={moi.telephone ?? ""}
                         onChange={(e) => { setMoi({ ...moi, telephone: e.target.value });
                                            setModifie(true); }} />
                  <div className="discret" style={{ marginTop: ".4375rem" }}>
                    Numéro vers lequel les appels urgents sont transférés.
                  </div>
                </div>
              </div>
              <div className="ligne-reglage">
                <label>Rôle</label>
                <div><div className="champ-valeur">{moi.role}</div></div>
              </div>
            </section>
          )}

          {section === "horaires" && (
            <section>
              <h2 style={{ marginTop: 0, fontSize: "1.375rem", textTransform: "none",
                           letterSpacing: "-0.018em", color: "var(--ink)" }}>
                Horaires
              </h2>
              <p className="sous-titre">
                L&apos;assistant ne proposera jamais de créneau en dehors.
              </p>
              <div className="bloc" style={{ padding: ".5rem" }}>
                {JOURS.map(([cle, libelle]) => {
                  const j = semaine[cle] ?? JOURNEE_DEFAUT;
                  return (
                    <div key={cle} className="jour" data-actif={j.actif}>
                      <div className="jour-haut">
                        <label className="bascule">
                          <input type="checkbox" checked={j.actif}
                                 onChange={(e) => majJour(cle, "actif", e.target.checked)} />
                          <span className="bascule-piste"><span className="bascule-pion" /></span>
                          <span className="jour-nom">{libelle}</span>
                        </label>
                        {!j.actif && <span className="jour-repos">Repos</span>}
                      </div>
                      {j.actif && (
                        <>
                          <div className="tranches">
                            <Plage a={j.debut} b={j.coupure ? j.pause : j.fin}
                                   surA={(v) => majJour(cle, "debut", v)}
                                   surB={(v) => majJour(cle, j.coupure ? "pause" : "fin", v)} />
                            {j.coupure && (
                              <Plage a={j.reprise} b={j.fin}
                                     surA={(v) => majJour(cle, "reprise", v)}
                                     surB={(v) => majJour(cle, "fin", v)} />
                            )}
                          </div>
                          <div className="jour-bas">
                            <button type="button"
                                    onClick={() => majJour(cle, "coupure", !j.coupure)}>
                              {j.coupure ? "Journée continue" : "Couper à midi"}
                            </button>
                            <button type="button" onClick={() => propager(cle)}>
                              Appliquer aux autres jours
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {section === "zone" && (
            <section>
              <h2 style={{ marginTop: 0, fontSize: "1.375rem", textTransform: "none",
                           letterSpacing: "-0.018em", color: "var(--ink)" }}>
                Zone d&apos;intervention
              </h2>
              <p className="sous-titre">
                En dehors de cette liste, l&apos;assistant prend le message mais ne
                propose pas de rendez-vous.
              </p>
              <div className="ligne-reglage">
                <label htmlFor="z-com">Communes</label>
                <div>
                  <textarea id="z-com" rows={4} value={communes}
                            onChange={(e) => { setCommunes(e.target.value); setModifie(true); }}
                            placeholder="Angers, Avrillé, Beaucouzé" />
                  <div className="discret" style={{ marginTop: ".4375rem" }}>
                    Séparées par des virgules.
                  </div>
                </div>
              </div>
              <Liste id="z-rayon" nom="Déplacement maximum" valeur={String(N("rayon_km"))}
                     options={[["10", "10 km"], ["25", "25 km"], ["40", "40 km"], ["60", "60 km"]]}
                     aide="Sert à estimer le temps de trajet entre deux interventions."
                     surChange={(v) => majEnt("rayon_km", Number(v))} />
            </section>
          )}

          {section === "assistant" && (
            <section>
              <h2 style={{ marginTop: 0, fontSize: "1.375rem", textTransform: "none",
                           letterSpacing: "-0.018em", color: "var(--ink)" }}>
                L&apos;assistant
              </h2>
              <p className="sous-titre">
                Sa façon de répondre et ce qu&apos;il a le droit de promettre.
              </p>

              <div className="ligne-reglage">
                <label htmlFor="a-valid">Prise de rendez-vous</label>
                <div>
                  <select id="a-valid" value={manuel ? "manuelle" : "auto"}
                          onChange={(e) => majEnt("validation_mode", e.target.value)}>
                    <option value="manuelle">Je valide chaque rendez-vous</option>
                    <option value="auto">L&apos;assistant confirme seul les créneaux libres</option>
                  </select>
                  <div className="discret" style={{ marginTop: ".5rem", lineHeight: 1.6 }}>
                    {manuel
                      ? "L'assistant propose un créneau et dit au client que vous confirmerez par message. Rien n'est ferme tant que vous n'avez pas tranché dans l'onglet Demandes."
                      : "L'assistant confirme le rendez-vous au téléphone et l'écrit dans votre agenda. Vous ne décidez de rien : ce qui est dit est pris."}
                  </div>
                </div>
              </div>

              {manuel && (
                <Liste id="a-fen" nom="Délai pour répondre" valeur={String(N("delai_reponse_min"))}
                       options={[["30", "30 minutes"], ["60", "1 heure"],
                                 ["180", "3 heures"], ["720", "Jusqu'au soir"]]}
                       aide="Passé ce délai sans réponse de votre part, le créneau est libéré et le client reçoit un message lui disant que vous le rappellerez."
                       surChange={(v) => majEnt("delai_reponse_min", Number(v))} />
              )}

              <div className="ligne-reglage">
                <label htmlFor="a-acc">Phrase d&apos;accueil</label>
                <div>
                  <textarea id="a-acc" rows={3} value={S("phrase_accueil")}
                            onChange={(e) => majEnt("phrase_accueil", e.target.value)} />
                </div>
              </div>

              <Liste id="a-delai" nom="Délai minimum" valeur={String(N("delai_min_rdv_h"))}
                     options={[["1", "1 heure avant le rendez-vous"],
                               ["2", "2 heures avant le rendez-vous"],
                               ["4", "4 heures avant le rendez-vous"],
                               ["24", "Le lendemain au plus tôt"]]}
                     surChange={(v) => majEnt("delai_min_rdv_h", Number(v))} />

              <Liste id="a-duree" nom="Durée par défaut" valeur={String(N("duree_defaut_min"))}
                     options={[["60", "1 heure"], ["90", "1 h 30"], ["120", "2 heures"]]}
                     surChange={(v) => majEnt("duree_defaut_min", Number(v))} />

              <Liste id="a-cren" nom="Créneaux proposés" valeur={String(N("creneaux_proposes"))}
                     options={[["1", "Un seul"], ["2", "Deux"], ["3", "Trois"]]}
                     surChange={(v) => majEnt("creneaux_proposes", Number(v))} />

              <div className="ligne-reglage">
                <label>Urgences</label>
                <div>
                  <label style={{ display: "flex", alignItems: "flex-start", gap: ".625rem",
                                  cursor: "pointer" }}>
                    <input type="checkbox" checked={B("transfert_urgence")}
                           onChange={(e) => majEnt("transfert_urgence", e.target.checked)}
                           style={{ width: 18, height: 18, minHeight: 0, marginTop: 2,
                                    accentColor: "var(--accent)" }} />
                    <span>Transférer l&apos;appel sur mon portable si c&apos;est une urgence</span>
                  </label>
                </div>
              </div>
            </section>
          )}

          {section === "agenda" && (
            <section>
              <h2 style={{ marginTop: 0, fontSize: "1.375rem", textTransform: "none",
                           letterSpacing: "-0.018em", color: "var(--ink)" }}>
                Agenda
              </h2>
              <p className="sous-titre">
                L&apos;assistant lit vos créneaux occupés et y écrit les rendez-vous qu&apos;il prend.
              </p>
              <div className="ligne-reglage">
                <label>Compte connecté</label>
                <div>
                  <div className="champ-valeur" style={{ marginBottom: ".75rem" }}>
                    {moi.agenda_connecte
                      ? `Google Agenda connecté · ${moi.email}`
                      : "Aucun agenda connecté."}
                  </div>
                  <a className="bouton" href="/api/auth/google" style={{ minHeight: 44 }}>
                    {moi.agenda_connecte ? "Reconnecter" : "Connecter mon agenda"}
                  </a>
                </div>
              </div>
              <div className="ligne-reglage">
                <label>Vie privée</label>
                <div style={{ fontSize: ".9375rem", lineHeight: 1.6 }}>
                  Nous lisons uniquement les heures occupées. Ni le titre de vos
                  rendez-vous personnels, ni leurs participants, ni leur contenu
                  ne sont enregistrés.
                </div>
              </div>
            </section>
          )}

          {section === "equipe" && (
            <section>
              <h2 style={{ marginTop: 0, fontSize: "1.375rem", textTransform: "none",
                           letterSpacing: "-0.018em", color: "var(--ink)" }}>
                Équipe
              </h2>
              <p className="sous-titre">
                Chaque plombier a son agenda et sa zone. L&apos;assistant propose le
                créneau du bon plombier selon la commune.
              </p>

              {membres.map((m) => (
                <div key={m.id} style={{ display: "flex", flexWrap: "wrap",
                                         gap: "1.25rem 1.75rem", alignItems: "flex-start",
                                         padding: "1.5rem .25rem",
                                         borderTop: "1px solid var(--line)" }}>
                  <div style={{ flex: "none", width: 54, height: 54, borderRadius: "50%",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: "1.0625rem", fontWeight: 600,
                                background: `${m.couleur}22`, color: m.couleur }}>
                    {m.nom.split(" ").map((p) => p[0]).slice(0, 2).join("")}
                  </div>

                  <div style={{ flex: "1 1 240px", minWidth: 0 }}>
                    <div style={{ fontSize: "1.125rem", fontWeight: 600,
                                  letterSpacing: "-0.015em", marginBottom: ".25rem" }}>
                      {m.nom}
                    </div>
                    <div className="carte-desc">{m.role} · {m.telephone}</div>
                    <div className="carte-desc">{(m.communes ?? []).join(", ") || "Aucune commune"}</div>
                  </div>

                  <div style={{ flex: "0 1 210px", minWidth: 0 }}>
                    <div className="champ-nom">Agenda</div>
                    <div style={{ fontSize: ".9375rem", fontWeight: 500,
                                  color: m.agenda_connecte ? "var(--accent-sombre)" : "var(--urgent-texte)" }}>
                      {m.agenda_connecte ? "Google connecté" : "Non connecté"}
                    </div>
                    <label style={{ display: "inline-flex", alignItems: "center", gap: ".5625rem",
                                    minHeight: 44, cursor: "pointer", fontSize: ".875rem" }}>
                      <input type="checkbox" checked={m.recoit_rdv}
                             onChange={() => basculerRecoit(m)}
                             style={{ width: 18, height: 18, minHeight: 0,
                                      accentColor: "var(--accent)" }} />
                      Reçoit des rendez-vous
                    </label>
                  </div>
                </div>
              ))}

              <div style={{ borderTop: "1px solid var(--line)", paddingTop: "1.75rem",
                            marginTop: ".5rem" }}>
                <p className="discret" style={{ lineHeight: 1.6 }}>
                  L&apos;ajout d&apos;un plombier passe par une invitation par courriel,
                  qui lui fait connecter son propre agenda Google. Cette partie
                  demande une route serveur : elle arrive avec l&apos;envoi des messages.
                </p>
              </div>
            </section>
          )}

          {section === "notifications" && (
            <section>
              <h2 style={{ marginTop: 0, fontSize: "1.375rem", textTransform: "none",
                           letterSpacing: "-0.018em", color: "var(--ink)" }}>
                Notifications
              </h2>
              <p className="sous-titre">Ce que vous recevez, et ce que reçoit le client.</p>

              <Liste id="n-canal" nom="Canal d'envoi" valeur={S("canal_notification")}
                     options={[["interface", "Interface seulement — rien n'est envoyé"],
                               ["email", "Courriel"], ["sms", "SMS"]]}
                     aide="Tant que le canal vaut « interface », les messages sont écrits en base avec leur texte exact mais ne partent pas. Aucun coût."
                     surChange={(v) => majEnt("canal_notification", v)} />

              <div className="ligne-reglage">
                <label>Pour vous</label>
                <div>
                  <Case nom="Message dès qu'un rendez-vous est pris"
                        coche={B("notif_sms_rdv")}
                        surChange={(v) => majEnt("notif_sms_rdv", v)} />
                  <Case nom="Récapitulatif chaque soir"
                        coche={B("notif_email_soir")}
                        surChange={(v) => majEnt("notif_email_soir", v)} />
                  <Case nom="Alerte si une demande attend depuis plus de deux heures"
                        coche={B("notif_alerte_rappel")}
                        surChange={(v) => majEnt("notif_alerte_rappel", v)} />
                </div>
              </div>

              <div className="ligne-reglage">
                <label>Pour le client</label>
                <div>
                  <Case nom="Confirmation à la fin de l'appel"
                        coche={B("notif_client_confirmation")}
                        surChange={(v) => majEnt("notif_client_confirmation", v)} />
                  <Case nom="Rappel la veille"
                        coche={B("notif_client_veille")}
                        surChange={(v) => majEnt("notif_client_veille", v)} />
                </div>
              </div>
            </section>
          )}

          {section === "abonnement" && (
            <section>
              <h2 style={{ marginTop: 0, fontSize: "1.375rem", textTransform: "none",
                           letterSpacing: "-0.018em", color: "var(--ink)" }}>
                Abonnement
              </h2>
              <p className="sous-titre">Sans engagement, résiliable à tout moment.</p>
              <div className="ligne-reglage">
                <label>Formule</label>
                <div>
                  <div style={{ fontSize: "1.1875rem", fontWeight: 600 }}>
                    {ent.abonnement_prix_eur ? `${ent.abonnement_prix_eur} € par mois` : "[VOTRE PRIX]"}
                  </div>
                  <div className="discret" style={{ marginTop: ".375rem" }}>
                    {membres.length} plombier{membres.length > 1 ? "s" : ""}
                    {ent.prochaine_echeance ? ` · prochaine échéance le ${ent.prochaine_echeance}` : ""}
                  </div>
                </div>
              </div>
              <div className="ligne-reglage">
                <label>Moyen de paiement</label>
                <div className="champ-valeur">{S("moyen_paiement") || "Non renseigné"}</div>
              </div>
              <div className="ligne-reglage">
                <label>Factures</label>
                <div>
                  {factures.length === 0 && <span className="discret">Aucune facture.</span>}
                  {factures.map((f) => (
                    <div key={f.id} className="horaire-ligne">
                      <span>{f.periode} · {f.montant_eur} €</span>
                      <span className="discret">{f.statut}</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {(modifie || etat) && (
            <div className="barre-enregistrer">
              <span className="discret">
                {etat === "ok" ? "Modifications enregistrées"
                  : "Modifications non enregistrées"}
              </span>
              <button className="bouton" data-style="plein" onClick={enregistrer}
                      disabled={etat === "en_cours"}>
                {etat === "en_cours" ? "…" : "Enregistrer"}
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

/* --------------------------------------------------------------- */

function Champ({ id, nom, valeur, aide, surChange }: {
  id: string; nom: string; valeur: string; aide?: string;
  surChange: (v: string) => void;
}) {
  return (
    <div className="ligne-reglage">
      <label htmlFor={id}>{nom}</label>
      <div>
        <input id={id} type="text" value={valeur} onChange={(e) => surChange(e.target.value)} />
        {aide && <div className="discret" style={{ marginTop: ".4375rem" }}>{aide}</div>}
      </div>
    </div>
  );
}

function Liste({ id, nom, valeur, options, aide, surChange }: {
  id: string; nom: string; valeur: string; options: [string, string][];
  aide?: string; surChange: (v: string) => void;
}) {
  return (
    <div className="ligne-reglage">
      <label htmlFor={id}>{nom}</label>
      <div>
        <select id={id} value={valeur} onChange={(e) => surChange(e.target.value)}>
          {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        {aide && <div className="discret" style={{ marginTop: ".4375rem", lineHeight: 1.6 }}>{aide}</div>}
      </div>
    </div>
  );
}

function Case({ nom, coche, surChange }: {
  nom: string; coche: boolean; surChange: (v: boolean) => void;
}) {
  return (
    <label style={{ display: "flex", alignItems: "flex-start", gap: ".625rem",
                    cursor: "pointer", marginBottom: ".875rem" }}>
      <input type="checkbox" checked={coche} onChange={(e) => surChange(e.target.checked)}
             style={{ width: 18, height: 18, minHeight: 0, marginTop: 2,
                      accentColor: "var(--accent)" }} />
      <span style={{ fontSize: ".9375rem", lineHeight: 1.5 }}>{nom}</span>
    </label>
  );
}

function Plage({ a, b, surA, surB }: {
  a: string; b: string; surA: (v: string) => void; surB: (v: string) => void;
}) {
  return (
    <div className="tranche">
      <input type="time" value={a} step={900} onChange={(e) => surA(e.target.value)} />
      <span>→</span>
      <input type="time" value={b} step={900} onChange={(e) => surB(e.target.value)} />
    </div>
  );
}
