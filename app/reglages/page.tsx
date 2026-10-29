"use client";

import { useEffect, useState } from "react";
import { sb } from "@/lib/supabase-browser";
import { lireTarifs, normaliser, type LigneTarif } from "@/lib/tarifs-csv";
import { calculerPrix, type BaseCalcul } from "@/lib/base-calcul";
import Entete from "../composants/Entete";
import Garde from "../composants/Garde";
import { Erreur, type ErreurPostgrest } from "../composants/Etat";
import ChampSuggere, { type Proposition } from "../composants/ChampSuggere";
import { telephoneFrancais } from "@/lib/affichage";
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
type Prestation = {
  id: string; libelle: string; unite: string; famille: string;
  prix_ht: number | null; taux_tva: number; rang: number; actif: boolean;
  temps_min: number | null; fourniture_ht: number | null;
};

type Rapport = {
  misAJour: string[];
  ajoutes: string[];
  rejets: { ligne: string; raison: string }[];
};

const UNITES: Record<string, string> = {
  forfait: "forfait", heure: "l'heure", unite: "l'unité", m: "le mètre", m2: "le m²",
};

const SECTIONS: [string, string][] = [
  ["entreprise", "Mon entreprise"],
  ["compte", "Mon compte"],
  ["horaires", "Horaires"],
  ["zone", "Zone d'intervention"],
  ["assistant", "L'assistant"],
  ["agenda", "Agenda"],
  ["tarifs", "Mes tarifs"],
  ["devis", "Devis"],
  ["equipe", "Équipe"],
  ["notifications", "Notifications"],
  ["abonnement", "Abonnement"],
];

type CommuneGeo = { nom: string; codesPostaux?: string[] };

/**
 * Communes françaises, API officielle geo.api.gouv.fr.
 *
 * Gratuite et sans clé, comme la Base Adresse Nationale. Choisir
 * dans la liste évite les fautes de frappe — et une commune mal
 * orthographiée en base, c'est l'assistant qui refuse un client
 * qu'il aurait dû accepter.
 */
async function chercherCommune(requete: string): Promise<Proposition<CommuneGeo>[]> {
  const r = await fetch(
    `https://geo.api.gouv.fr/communes?nom=${encodeURIComponent(requete)}`
    + "&fields=nom,codesPostaux&boost=population&limit=7"
  );
  if (!r.ok) return [];
  const liste = (await r.json()) as CommuneGeo[];
  return liste.map((c) => ({
    cle: c.nom,
    titre: c.nom,
    detail: c.codesPostaux?.[0],
    valeur: c,
  }));
}

type TraitBAN = {
  properties: { label: string; name: string; city: string; postcode: string };
  geometry: { coordinates: [number, number] };
};

type Societe = {
  siren: string;
  nom_complet: string;
  nom_raison_sociale?: string;
  nature_juridique?: string;
  siege?: { siret?: string; libelle_commune?: string; code_postal?: string;
            numero_voie?: string; type_voie?: string; libelle_voie?: string };
};

async function chercherAdresse(requete: string): Promise<Proposition<TraitBAN>[]> {
  const r = await fetch(
    `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(requete)}`
    + "&limit=6&autocomplete=1"
  );
  if (!r.ok) return [];
  const j = await r.json();
  return ((j.features ?? []) as TraitBAN[]).map((t) => ({
    cle: t.properties.label,
    titre: t.properties.name,
    detail: `${t.properties.postcode} ${t.properties.city}`,
    valeur: t,
  }));
}

/**
 * Le répertoire INSEE renvoie tout en capitales : « 46 RUE CESAR
 * GEOFFRAY ». Ces informations finiront dans des messages envoyés
 * aux clients — une adresse qui crie fait amateur.
 *
 * Les accents perdus par l'INSEE ne sont pas restituables ; on se
 * contente de rendre la casse lisible, et le plombier corrige s'il
 * le souhaite.
 */
function casseNormale(texte?: string): string {
  if (!texte) return "";
  return texte
    .toLowerCase()
    .split(" ")
    .map((mot) => (mot.length > 2 ? mot.charAt(0).toUpperCase() + mot.slice(1) : mot))
    .join(" ")
    .replace(/^./, (c) => c.toUpperCase());
}

/**
 * Catégorie juridique INSEE vers les quatre formes que connaît le
 * formulaire. Le codage officiel compte des centaines de valeurs ;
 * seules les familles utiles à un artisan sont traitées, et on ne
 * touche à rien quand on ne sait pas.
 */
function formeJuridique(code?: string): string | null {
  if (!code) return null;
  if (code.startsWith("1")) return "ei";      // entrepreneur individuel
  if (code === "5498") return "eurl";         // SARL à associé unique
  if (code.startsWith("54")) return "sarl";
  if (code.startsWith("57")) return "sas";    // SAS et SASU
  return null;
}

/** « 81245590300024 » → « 812 455 903 00024 », lisible à l'œil. */
function siretLisible(brut?: string): string {
  if (!brut || brut.length !== 14) return brut ?? "";
  return `${brut.slice(0, 3)} ${brut.slice(3, 6)} ${brut.slice(6, 9)} ${brut.slice(9)}`;
}

/**
 * Répertoire officiel des entreprises, recherche-entreprises.api.gouv.fr.
 *
 * Gratuit, sans clé, tenu par l'État à partir du registre INSEE. Le
 * plombier tape le nom de sa société : raison sociale, SIRET et
 * adresse du siège se remplissent ensemble. Trois champs ingrats en
 * moins, et un SIRET qui ne comporte pas de faute de frappe.
 */
async function chercherSociete(requete: string): Promise<Proposition<Societe>[]> {
  const r = await fetch(
    `https://recherche-entreprises.api.gouv.fr/search?q=${encodeURIComponent(requete)}`
    + "&per_page=6&page=1"
  );
  if (!r.ok) return [];
  const j = await r.json();
  return ((j.results ?? []) as Societe[]).map((e) => ({
    cle: e.siren,
    titre: e.nom_complet,
    detail: [e.siege?.libelle_commune, siretLisible(e.siege?.siret)]
      .filter(Boolean).join(" · "),
    valeur: e,
  }));
}

export default function Reglages() {
  return <Garde><Entete /><Contenu /></Garde>;
}

function Contenu() {
  const [section, setSection] = useState("entreprise");
  const [ent, setEnt] = useState<Entreprise | null>(null);
  const [moi, setMoi] = useState<Membre | null>(null);
  const [membres, setMembres] = useState<Membre[]>([]);
  const [factures, setFactures] = useState<Facture[]>([]);
  const [prestations, setPrestations] = useState<Prestation[]>([]);
  const [rapport, setRapport] = useState<Rapport | null>(null);
  const [importEnCours, setImportEnCours] = useState(false);
  const [enAttente, setEnAttente] = useState<number | null>(null);
  const [envoiEtat, setEnvoiEtat] = useState<string | null>(null);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [semaine, setSemaine] = useState<Record<string, Journee>>({});
  const [communes, setCommunes] = useState("");
  const [ajoutCommune, setAjoutCommune] = useState("");
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

      const { count } = await sb
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("statut", "a_envoyer");
      setEnAttente(count ?? 0);

      const { data: pr } = await sb
        .from("prestations")
        .select("id, libelle, unite, famille, prix_ht, taux_tva, rang, actif, temps_min, fourniture_ht")
        .eq("actif", true)
        .order("rang");
      setPrestations((pr as Prestation[]) ?? []);
    })();
  }, []);

  // La base de calcul telle que la voit l'entreprise à cet instant.
  const base: BaseCalcul = {
    taux_horaire_ht: ent?.taux_horaire_ht != null ? Number(ent.taux_horaire_ht) : null,
    coef_fournitures: ent?.coef_fournitures != null ? Number(ent.coef_fournitures) : 1,
    frais_deplacement_ht: ent?.frais_deplacement_ht != null
      ? Number(ent.frais_deplacement_ht) : null,
  };

  /** Le prix d'une prestation : celui qui est fixé, sinon celui que donne la base. */
  const calcul = (p: Prestation) =>
    calculerPrix({ prix_ht: p.prix_ht, temps_min: p.temps_min,
                   fourniture_ht: p.fourniture_ht }, base);

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
      "telephone_public", "email", "site", "phrase_accueil",
      "validation_mode", "delai_reponse_min", "delai_min_rdv_h", "duree_defaut_min",
      "creneaux_proposes", "transfert_urgence", "canal_notification", "rayon_km",
      "tva_intracom", "mediateur_nom", "mediateur_url", "conditions_paiement",
      "delai_execution_defaut", "devis_payant_defaut", "assurance_decennale",
      "notif_sms_rdv", "notif_email_soir", "notif_alerte_rappel",
      "notif_client_confirmation", "notif_client_veille",
      "taux_horaire_ht", "coef_fournitures", "frais_deplacement_ht"];
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

  /**
   * Un tarif s'enregistre seul, dès qu'on quitte la case.
   *
   * Vingt-sept lignes derrière un unique bouton « Enregistrer »,
   * c'est l'assurance de perdre sa saisie en changeant d'onglet.
   */
  async function enregistrerTarif(
    p: Prestation,
    champ: "prix_ht" | "taux_tva" | "temps_min" | "fourniture_ht",
    valeur: string,
  ) {
    let nombre = valeur.trim() === "" ? null : Number(valeur.replace(",", "."));
    if (nombre !== null && Number.isNaN(nombre)) return;
    // Le temps se compte en minutes entières.
    if (nombre !== null && champ === "temps_min") nombre = Math.round(nombre);
    if (nombre !== null && nombre < 0) return;

    setPrestations((liste) =>
      liste.map((x) => (x.id === p.id ? { ...x, [champ]: nombre } : x)));

    const { error } = await sb.from("prestations")
      .update({ [champ]: nombre }).eq("id", p.id);
    if (error) setErreur(error);
  }

  /**
   * Reprend les tarifs d'un fichier de tableur.
   *
   * Deux règles. Une prestation déjà connue est mise à jour, jamais
   * dupliquée : le rapprochement se fait sur le libellé débarrassé
   * de ses accents et de sa casse. Et rien ne disparaît en silence :
   * chaque ligne écartée est affichée avec sa raison, parce qu'un
   * import qui annonce « 24 lignes importées » quand le fichier en
   * comptait 31 est un mensonge par omission.
   */
  /** Un exemple valide vaut mieux qu'un paragraphe d'explications. */
  function modeleCsv() {
    const contenu = [
      "Désignation;Unité;Temps;Fournitures;Prix HT;TVA",
      "Déplacement et diagnostic;forfait;30;;;10",
      "Recherche de fuite non destructive;forfait;1h30;;;10",
      "Remplacement d'un mitigeur;unité;45;80,00;;10",
      "Pose d'un chauffe-eau 200 L;unité;3h;650,00;;10",
      "Forfait négocié (prix imposé);forfait;;;390,00;10",
    ].join("\r\n");
    const blob = new Blob(["\uFEFF" + contenu], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "modele-tarifs.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function importerTarifs(fichier: File) {
    setImportEnCours(true);
    setRapport(null);
    setErreur(null);
    try {
      const lecture = lireTarifs(await fichier.text());
      if (lecture.lignes.length === 0) {
        setRapport({ misAJour: [], ajoutes: [], rejets: lecture.rejets });
        return;
      }

      const connues = new Map(prestations.map((p) => [normaliser(p.libelle), p]));
      const aModifier: { p: Prestation; l: LigneTarif }[] = [];
      const aCreer: LigneTarif[] = [];
      for (const l of lecture.lignes) {
        const existante = connues.get(normaliser(l.libelle));
        if (existante) aModifier.push({ p: existante, l });
        else aCreer.push(l);
      }

      for (const { p: pres, l } of aModifier) {
        // On n'écrase que ce que le fichier renseigne : une colonne
        // absente ne doit pas effacer ce qui était déjà là.
        const champs: Record<string, unknown> = {};
        if (l.prix_ht !== null) champs.prix_ht = l.prix_ht;
        if (l.unite) champs.unite = l.unite;
        if (l.taux_tva !== null) champs.taux_tva = l.taux_tva;
        if (l.temps_min !== null) champs.temps_min = l.temps_min;
        if (l.fourniture_ht !== null) champs.fourniture_ht = l.fourniture_ht;
        if (Object.keys(champs).length === 0) continue;
        const { error } = await sb.from("prestations").update(champs).eq("id", pres.id);
        if (error) { setErreur(error); return; }
      }

      if (aCreer.length > 0) {
        const { data: entId, error: eEnt } = await sb.rpc("entreprise_courante");
        if (eEnt) { setErreur(eEnt); return; }
        const rangDepart = prestations.reduce((m, x) => Math.max(m, x.rang), 0) + 1;
        const { error } = await sb.from("prestations").insert(
          aCreer.map((l, i) => ({
            entreprise_id: entId,
            libelle: l.libelle,
            unite: l.unite ?? "forfait",
            prix_ht: l.prix_ht,
            taux_tva: l.taux_tva ?? 10,
            temps_min: l.temps_min,
            fourniture_ht: l.fourniture_ht,
            famille: "Import",
            rang: rangDepart + i,
            actif: true,
          })));
        if (error) { setErreur(error); return; }
      }

      // On relit la base plutôt que de rafistoler l'état local :
      // c'est la base qui fait foi.
      const { data: c } = await sb
        .from("prestations")
        .select("id, libelle, unite, famille, prix_ht, taux_tva, rang, actif, temps_min, fourniture_ht")
        .order("rang");
      setPrestations((c as Prestation[]) ?? []);

      setRapport({
        misAJour: aModifier.map((x) => x.p.libelle),
        ajoutes: aCreer.map((x) => x.libelle),
        rejets: lecture.rejets,
      });
    } catch {
      setErreur({ message: "Ce fichier n'a pas pu être lu. Enregistrez-le au format CSV depuis votre tableur." });
    } finally {
      setImportEnCours(false);
    }
  }

  /**
   * Relève la file des messages.
   *
   * L'envoi passe par le serveur : la clé Resend ne doit pas se
   * trouver dans le navigateur, et le destinataire réel se décide
   * côté base, pas côté interface.
   */
  async function envoyerFile() {
    setEnvoiEnCours(true);
    setEnvoiEtat(null);

    const { data: session } = await sb.auth.getSession();
    const jeton = session.session?.access_token;
    if (!jeton) {
      setEnvoiEtat("Session expirée. Reconnectez-vous.");
      setEnvoiEnCours(false);
      return;
    }

    const r = await fetch("/api/notifications/envoyer", {
      method: "POST",
      headers: { Authorization: `Bearer ${jeton}` },
    });
    const corps = await r.json().catch(() => ({}));
    setEnvoiEnCours(false);

    if (!r.ok) {
      setEnvoiEtat(corps.erreur ?? "Envoi impossible.");
      return;
    }

    setEnvoiEtat(
      corps.envoyes === 0 && corps.echecs === 0 && corps.ignores === 0
        ? "Aucun message en attente."
        : `${corps.envoyes} envoyé(s)`
          + (corps.echecs ? `, ${corps.echecs} en échec` : "")
          + (corps.ignores ? `, ${corps.ignores} sans adresse` : "")
          + (corps.modeTest ? " — en mode test, rien n'est parti chez un client." : "")
    );

    const { count } = await sb
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("statut", "a_envoyer");
    setEnAttente(count ?? 0);
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
  const mode = S("validation_mode") || "manuelle";
  const manuel = mode === "manuelle";

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
              <div className="ligne-reglage">
                <label htmlFor="r-nom">Raison sociale</label>
                <div>
                  <ChampSuggere<Societe>
                    id="r-nom"
                    libelle="Raison sociale"
                    libelleExterne
                    texte={S("nom")}
                    surTexte={(v) => majEnt("nom", v)}
                    minimum={3}
                    chercher={chercherSociete}
                    aide="Cherchez votre société : le SIRET et l'adresse du siège se remplissent avec."
                    surChoix={(p) => {
                      const e = p.valeur;
                      // nom_complet ajoute les sigles entre parenthèses :
                      // « ANGERS PLOMBERIE (APC) ». La raison sociale seule
                      // est ce qui doit figurer sur un devis.
                      majEnt("nom", e.nom_raison_sociale || e.nom_complet);

                      if (e.siege?.siret) majEnt("siret", siretLisible(e.siege.siret));

                      const forme = formeJuridique(e.nature_juridique);
                      if (forme) majEnt("forme_juridique", forme);

                      const rue = [e.siege?.numero_voie, e.siege?.type_voie, e.siege?.libelle_voie]
                        .filter(Boolean).join(" ");
                      if (rue) majEnt("adresse", casseNormale(rue));
                      if (e.siege?.libelle_commune) {
                        majEnt("ville", casseNormale(e.siege.libelle_commune));
                      }
                    }}
                  />
                </div>
              </div>
              <Liste id="r-forme" nom="Forme juridique" valeur={S("forme_juridique")}
                     options={[["ei", "Entreprise individuelle"], ["eurl", "EURL"],
                               ["sarl", "SARL"], ["sas", "SAS ou SASU"]]}
                     surChange={(v) => majEnt("forme_juridique", v)} />
              <Champ id="r-siret" nom="SIRET" valeur={S("siret")}
                     surChange={(v) => majEnt("siret", v)} />
              <div className="ligne-reglage">
                <label htmlFor="r-adr">Adresse de l&apos;atelier</label>
                <div>
                  <ChampSuggere<TraitBAN>
                    id="r-adr"
                    libelle="Adresse de l'atelier"
                    libelleExterne
                    texte={S("adresse")}
                    surTexte={(v) => majEnt("adresse", v)}
                    chercher={chercherAdresse}
                    surChoix={(p) => {
                      majEnt("adresse", p.valeur.properties.name);
                      majEnt("ville", p.valeur.properties.city);
                    }}
                  />
                </div>
              </div>

              <div className="ligne-reglage">
                <label htmlFor="r-ville">Ville</label>
                <div>
                  <ChampSuggere<CommuneGeo>
                    id="r-ville"
                    libelle="Ville"
                    libelleExterne
                    texte={S("ville")}
                    surTexte={(v) => majEnt("ville", v)}
                    minimum={2}
                    chercher={chercherCommune}
                    surChoix={(p) => majEnt("ville", p.valeur.nom)}
                  />
                </div>
              </div>
              <div className="ligne-reglage">
                <label htmlFor="r-telp">Téléphone public</label>
                <div>
                  <input id="r-telp" type="tel" inputMode="tel"
                         value={S("telephone_public")}
                         onChange={(e) => majEnt("telephone_public", e.target.value)}
                         // La mise en forme attend la fin de la saisie :
                         // reformater à chaque touche déplace le curseur
                         // et rend le champ impossible à corriger.
                         onBlur={(e) => majEnt("telephone_public",
                                               telephoneFrancais(e.target.value))}
                         placeholder="02 41 00 00 00" />
                  <div className="discret" style={{ marginTop: ".4375rem" }}>
                    Le numéro que vos clients voient. Il se met en forme tout seul.
                  </div>
                </div>
              </div>

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
                  <input id="c-tel" type="tel" inputMode="tel" value={moi.telephone ?? ""}
                         onChange={(e) => { setMoi({ ...moi, telephone: e.target.value });
                                            setModifie(true); }}
                         onBlur={(e) => setMoi({ ...moi,
                                                 telephone: telephoneFrancais(e.target.value) })}
                         placeholder="06 00 00 00 00" />
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
                <span style={{ flex: "0 0 190px", fontSize: ".875rem",
                               fontWeight: 500, paddingTop: ".8125rem" }}>
                  Communes
                </span>
                <div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: ".5rem",
                                marginBottom: communes.trim() ? "1rem" : 0 }}>
                    {communes.split(",").map((c) => c.trim()).filter(Boolean).map((c) => (
                      <span key={c} className="puce-commune">
                        {c}
                        <button type="button" aria-label={`Retirer ${c}`}
                                onClick={() => {
                                  setCommunes(
                                    communes.split(",").map((x) => x.trim())
                                      .filter((x) => x && x !== c).join(", ")
                                  );
                                  setModifie(true);
                                }}>
                          <svg width="13" height="13" viewBox="0 0 20 20" fill="none"
                               aria-hidden="true">
                            <path d="M5 5l10 10M15 5 5 15" stroke="currentColor"
                                  strokeWidth="2" strokeLinecap="round" />
                          </svg>
                        </button>
                      </span>
                    ))}
                  </div>

                  <ChampSuggere<CommuneGeo>
                    id="z-com"
                    libelle="Ajouter une commune"
                    texte={ajoutCommune}
                    surTexte={setAjoutCommune}
                    placeholder="Commencez à taper…"
                    minimum={2}
                    chercher={chercherCommune}
                    aide="Choisissez dans la liste : une commune mal orthographiée fait refuser un client qu'il fallait accepter."
                    surChoix={(p) => {
                      const deja = communes.split(",").map((x) => x.trim()).filter(Boolean);
                      if (!deja.some((x) => x.toLowerCase() === p.valeur.nom.toLowerCase())) {
                        setCommunes([...deja, p.valeur.nom].join(", "));
                        setModifie(true);
                      }
                      setAjoutCommune("");
                    }}
                  />
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
                  <select id="a-valid" value={mode}
                          onChange={(e) => majEnt("validation_mode", e.target.value)}>
                    <option value="manuelle">Je valide chaque rendez-vous</option>
                    <option value="auto">L&apos;assistant confirme seul les créneaux libres</option>
                    <option value="aucune">L&apos;assistant ne prend aucun rendez-vous</option>
                  </select>
                  <div className="discret" style={{ marginTop: ".5rem", lineHeight: 1.6 }}>
                    {mode === "manuelle" &&
                      "L'assistant propose un créneau, le retient dans votre agenda sous la mention « à confirmer », et dit au client que vous confirmerez par message. Rien n'est ferme tant que vous n'avez pas tranché dans l'onglet Demandes."}
                    {mode === "auto" &&
                      "L'assistant confirme le rendez-vous au téléphone et l'écrit dans votre agenda. Vous ne décidez de rien : ce qui est dit est pris."}
                    {mode === "aucune" &&
                      "L'assistant recueille la demande, l'adresse et le numéro, puis annonce que vous rappellerez. Il ne propose aucun créneau et ne touche pas à votre agenda."}
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

          {section === "tarifs" && (
            <section>
              <h2 style={{ marginTop: 0, fontSize: "1.375rem", textTransform: "none",
                           letterSpacing: "-0.018em", color: "var(--ink)" }}>
                Mes tarifs
              </h2>
              <p className="sous-titre">
                Vos prix, pas les nôtres. Un logiciel qui suggérerait un tarif
                vous ferait perdre de l&apos;argent sans que vous le voyiez.
                Remplissez cette liste une fois : chaque devis s&apos;écrira
                ensuite en deux clics.
              </p>

              <div className="encart-info" style={{ marginTop: 0 }}>
                Les taux de TVA sont ceux de la réglementation : 10 % pour
                l&apos;entretien et la réparation d&apos;un logement de plus de
                deux ans, 20 % pour le neuf et les fournitures vendues seules,
                5,5 % pour la rénovation énergétique. Modifiez-les si votre
                situation diffère.
              </div>

              <div className="base-calcul">
                <div className="bloc-import-titre">Votre base de calcul</div>
                <p className="discret" style={{ margin: "0 0 1rem", lineHeight: 1.55 }}>
                  Remplissez ces trois cases et vous n&apos;aurez plus à connaître
                  le prix de chaque prestation : il se déduit du temps et des
                  pièces. Un prix écrit à la main dans la liste ci-dessous
                  reste prioritaire — un forfait négocié ne doit jamais être
                  recalculé.
                </p>

                <div className="base-calcul-champs">
                  <div>
                    <label htmlFor="taux-horaire">Taux horaire HT</label>
                    <input id="taux-horaire" type="text" inputMode="decimal"
                           defaultValue={(ent.taux_horaire_ht as number) ?? ""}
                           placeholder="55"
                           onBlur={(e) => majEnt("taux_horaire_ht",
                             e.target.value.trim() === "" ? null
                               : Number(e.target.value.replace(",", ".")))}
                           style={{ minHeight: 44 }} />
                    <span className="discret">€ par heure de main-d&apos;œuvre</span>
                  </div>
                  <div>
                    <label htmlFor="coef-four">Coefficient fournitures</label>
                    <input id="coef-four" type="text" inputMode="decimal"
                           defaultValue={(ent.coef_fournitures as number) ?? 1}
                           placeholder="1,3"
                           onBlur={(e) => majEnt("coef_fournitures",
                             e.target.value.trim() === "" ? 1
                               : Number(e.target.value.replace(",", ".")))}
                           style={{ minHeight: 44 }} />
                    <span className="discret">
                      1 = revente au prix d&apos;achat, 1,3 = 30 % de marge
                    </span>
                  </div>
                  <div>
                    <label htmlFor="frais-depl">Déplacement HT</label>
                    <input id="frais-depl" type="text" inputMode="decimal"
                           defaultValue={(ent.frais_deplacement_ht as number) ?? ""}
                           placeholder="45"
                           onBlur={(e) => majEnt("frais_deplacement_ht",
                             e.target.value.trim() === "" ? null
                               : Number(e.target.value.replace(",", ".")))}
                           style={{ minHeight: 44 }} />
                    <span className="discret">Forfait proposé en un clic sur le devis</span>
                  </div>
                </div>

                {base.taux_horaire_ht === null && (
                  <p className="discret" style={{ marginTop: ".875rem" }}>
                    Sans taux horaire, aucun prix ne peut être calculé : les
                    prestations qui n&apos;ont pas de prix fixé resteront
                    « à définir » plutôt que d&apos;afficher un montant faux.
                  </p>
                )}
              </div>

              <div className="bloc-import">
                <div className="bloc-import-titre">Reprendre une liste existante</div>
                <p className="discret" style={{ margin: "0 0 .875rem", lineHeight: 1.55 }}>
                  Si vos prix sont déjà dans un classeur, ouvrez-le puis
                  <strong> Fichier → Enregistrer sous → CSV</strong>, et déposez
                  le fichier ici. Une prestation déjà présente est mise à jour,
                  les autres sont ajoutées. Rien n&apos;est supprimé.
                </p>

                <div style={{ display: "flex", flexWrap: "wrap", gap: ".75rem",
                              alignItems: "center" }}>
                  <label className="bouton" data-style="plein"
                         style={{ minHeight: 44, cursor: "pointer" }}>
                    {importEnCours ? "Lecture…" : "Choisir un fichier CSV"}
                    <input type="file" accept=".csv,.txt,text/csv,text/plain"
                           disabled={importEnCours}
                           style={{ display: "none" }}
                           onChange={(e) => {
                             const f = e.target.files?.[0];
                             if (f) importerTarifs(f);
                             e.target.value = "";
                           }} />
                  </label>
                  <button type="button" className="bouton" style={{ minHeight: 44 }}
                          onClick={modeleCsv}>
                    Télécharger un modèle
                  </button>
                </div>

                {rapport && (
                  <div className="rapport-import" role="status">
                    {rapport.misAJour.length > 0 && (
                      <p style={{ margin: "0 0 .375rem" }}>
                        <strong>{rapport.misAJour.length} tarif(s) mis à jour</strong>
                        {" : "}{rapport.misAJour.slice(0, 6).join(", ")}
                        {rapport.misAJour.length > 6
                          ? ` et ${rapport.misAJour.length - 6} autre(s)` : ""}.
                      </p>
                    )}
                    {rapport.ajoutes.length > 0 && (
                      <p style={{ margin: "0 0 .375rem" }}>
                        <strong>{rapport.ajoutes.length} prestation(s) ajoutée(s)</strong>
                        {" : "}{rapport.ajoutes.slice(0, 6).join(", ")}
                        {rapport.ajoutes.length > 6
                          ? ` et ${rapport.ajoutes.length - 6} autre(s)` : ""}.
                      </p>
                    )}
                    {rapport.rejets.length > 0 && (
                      <div style={{ marginTop: ".5rem" }}>
                        <strong>{rapport.rejets.length} ligne(s) non reprise(s)</strong> :
                        <ul style={{ margin: ".375rem 0 0", paddingLeft: "1.25rem" }}>
                          {rapport.rejets.slice(0, 8).map((r, i) => (
                            <li key={i} style={{ fontSize: ".8125rem", lineHeight: 1.5 }}>
                              <code>{r.ligne.slice(0, 70)}</code> — {r.raison}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {rapport.misAJour.length === 0 && rapport.ajoutes.length === 0
                      && rapport.rejets.length === 0 && (
                      <p style={{ margin: 0 }}>Ce fichier ne contenait aucune ligne lisible.</p>
                    )}
                  </div>
                )}
              </div>

              <div style={{ overflowX: "auto" }}>
                <div style={{ minWidth: 760 }}>
                  <div style={{ display: "flex", gap: "1rem", padding: "0 .25rem .625rem",
                                fontSize: ".75rem", fontWeight: 600, letterSpacing: ".06em",
                                textTransform: "uppercase", color: "var(--ink-2)" }}>
                    <div style={{ flex: "1 1 auto" }}>Prestation</div>
                    <div style={{ flex: "none", width: 82 }}>Unité</div>
                    <div style={{ flex: "none", width: 92 }}>Temps</div>
                    <div style={{ flex: "none", width: 104 }}>Fournitures</div>
                    <div style={{ flex: "none", width: 118 }}>Prix HT</div>
                    <div style={{ flex: "none", width: 92 }}>TVA</div>
                  </div>

                  {prestations.map((p) => (
                    <div key={p.id}
                         style={{ display: "flex", gap: "1rem", alignItems: "center",
                                  padding: ".625rem .25rem",
                                  borderTop: "1px solid var(--line)" }}>
                      <div style={{ flex: "1 1 auto", minWidth: 0, fontSize: ".9375rem" }}>
                        {p.libelle}
                      </div>
                      <div style={{ flex: "none", width: 82, fontSize: ".8125rem",
                                    color: "var(--ink-2)" }}>
                        {UNITES[p.unite] ?? p.unite}
                      </div>
                      <div style={{ flex: "none", width: 92 }}>
                        <input type="text" inputMode="numeric"
                               aria-label={`Temps en minutes — ${p.libelle}`}
                               defaultValue={p.temps_min ?? ""}
                               placeholder="min"
                               onBlur={(e) => enregistrerTarif(p, "temps_min", e.target.value)}
                               style={{ minHeight: 44, textAlign: "right",
                                        fontVariantNumeric: "tabular-nums" }} />
                      </div>
                      <div style={{ flex: "none", width: 104 }}>
                        <input type="text" inputMode="decimal"
                               aria-label={`Fournitures hors taxes — ${p.libelle}`}
                               defaultValue={p.fourniture_ht ?? ""}
                               placeholder="€"
                               onBlur={(e) => enregistrerTarif(p, "fourniture_ht", e.target.value)}
                               style={{ minHeight: 44, textAlign: "right",
                                        fontVariantNumeric: "tabular-nums" }} />
                      </div>
                      <div style={{ flex: "none", width: 118 }}>
                        <input type="text" inputMode="decimal"
                               aria-label={`Prix hors taxes — ${p.libelle}`}
                               defaultValue={p.prix_ht ?? ""}
                               placeholder={calcul(p)?.prix != null && !calcul(p)!.fixe
                                 ? `${calcul(p)!.prix}` : "—"}
                               onBlur={(e) => enregistrerTarif(p, "prix_ht", e.target.value)}
                               style={{ minHeight: 44, textAlign: "right",
                                        fontVariantNumeric: "tabular-nums" }} />
                        {(() => {
                          const c = calcul(p);
                          if (!c || c.fixe) return null;
                          return (
                            <div className="prix-calcule" title={c.detail}>
                              calculé : {c.detail}
                            </div>
                          );
                        })()}
                      </div>
                      <div style={{ flex: "none", width: 92 }}>
                        <select defaultValue={String(p.taux_tva)}
                                aria-label={`Taux de TVA — ${p.libelle}`}
                                onChange={(e) => enregistrerTarif(p, "taux_tva", e.target.value)}
                                style={{ minHeight: 44 }}>
                          <option value="5.5">5,5 %</option>
                          <option value="10">10 %</option>
                          <option value="20">20 %</option>
                        </select>
                      </div>
                    </div>
                  ))}
                  <div style={{ borderTop: "1px solid var(--line)" }} />
                </div>
              </div>

              <p className="discret" style={{ marginTop: "1.25rem" }}>
                {prestations.filter((p) => calcul(p) !== null).length} prestation(s)
                chiffrée(s) sur {prestations.length}, dont{" "}
                {prestations.filter((p) => calcul(p)?.fixe).length} à prix fixé et{" "}
                {prestations.filter((p) => { const c = calcul(p); return c && !c.fixe; }).length}{" "}
                calculée(s) depuis votre base. Chaque case s&apos;enregistre dès que
                vous la quittez.
              </p>
            </section>
          )}

          {section === "devis" && (
            <section>
              <h2 style={{ marginTop: 0, fontSize: "1.375rem", textTransform: "none",
                           letterSpacing: "-0.018em", color: "var(--ink)" }}>
                Devis
              </h2>
              <p className="sous-titre">
                Ces informations figurent sur chaque devis. La loi les impose :
                un devis incomplet expose à une amende administrative.
              </p>

              <Champ id="d-assur" nom="Assurance décennale" valeur={S("assurance_decennale")}
                     aide="Nom de l'assureur, numéro de contrat et couverture géographique. Obligatoire sur tout devis du bâtiment."
                     surChange={(v) => majEnt("assurance_decennale", v)} />

              <Champ id="d-tva" nom="TVA intracommunautaire" valeur={S("tva_intracom")}
                     aide="FR suivi de deux chiffres et de votre SIREN. Laissez vide si vous êtes en franchise de TVA."
                     surChange={(v) => majEnt("tva_intracom", v)} />

              <Champ id="d-med" nom="Médiateur de la consommation" valeur={S("mediateur_nom")}
                     aide="Tout professionnel vendant à des particuliers doit en désigner un et l'indiquer."
                     surChange={(v) => majEnt("mediateur_nom", v)} />

              <Champ id="d-medurl" nom="Site du médiateur" valeur={S("mediateur_url")}
                     surChange={(v) => majEnt("mediateur_url", v)} />

              <div className="ligne-reglage">
                <label htmlFor="d-paie">Conditions de paiement</label>
                <div>
                  <textarea id="d-paie" rows={3} value={S("conditions_paiement")}
                            onChange={(e) => majEnt("conditions_paiement", e.target.value)} />
                </div>
              </div>

              <div className="ligne-reglage">
                <label htmlFor="d-delai">Délai d&apos;exécution</label>
                <div>
                  <input id="d-delai" type="text" value={S("delai_execution_defaut")}
                         onChange={(e) => majEnt("delai_execution_defaut", e.target.value)} />
                </div>
              </div>

              <div className="ligne-reglage">
                <span style={{ flex: "0 0 190px", fontSize: ".875rem",
                               fontWeight: 500, paddingTop: ".8125rem" }}>
                  Devis payant
                </span>
                <div>
                  <label style={{ display: "flex", alignItems: "flex-start", gap: ".625rem",
                                  cursor: "pointer" }}>
                    <input type="checkbox" checked={B("devis_payant_defaut")}
                           onChange={(e) => majEnt("devis_payant_defaut", e.target.checked)}
                           style={{ width: 18, height: 18, minHeight: 0, marginTop: 2,
                                    accentColor: "var(--accent)" }} />
                    <span>Je facture l&apos;établissement du devis</span>
                  </label>
                  <div className="discret" style={{ marginTop: ".5rem", lineHeight: 1.6 }}>
                    Si le devis est payant, son prix doit être annoncé au client
                    avant d&apos;être établi. La plupart des dépanneurs le font
                    gratuitement.
                  </div>
                </div>
              </div>

              <div className="encart-info">
                Un devis est obligatoire au-delà de 150 € TTC pour un dépannage,
                une réparation ou un entretien à domicile. En dessous, il reste
                recommandé.
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

              <Champ id="n-test" nom="Adresse de test" valeur={S("email_test")}
                     aide="Tant que ce champ est rempli, tous les messages arrivent à cette adresse au lieu du client, avec son nom dans l'objet. Videz-le le jour où vous passerez en production."
                     surChange={(v) => majEnt("email_test", v)} />

              <div className="ligne-reglage">
                <span style={{ flex: "0 0 190px", fontSize: ".875rem",
                               fontWeight: 500, paddingTop: ".8125rem" }}>
                  File d&apos;envoi
                </span>
                <div>
                  <div className="champ-valeur" style={{ marginBottom: ".75rem" }}>
                    {enAttente === null
                      ? "…"
                      : enAttente === 0
                      ? "Aucun message en attente."
                      : `${enAttente} message(s) en attente.`}
                  </div>
                  <button type="button" className="bouton" onClick={envoyerFile}
                          disabled={envoiEnCours || enAttente === 0}
                          style={{ minHeight: 44 }}>
                    {envoiEnCours ? "Envoi…" : "Envoyer maintenant"}
                  </button>
                  {envoiEtat && (
                    <div className="discret" style={{ marginTop: ".625rem", lineHeight: 1.55 }}>
                      {envoiEtat}
                    </div>
                  )}
                </div>
              </div>

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
