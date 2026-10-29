"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { sb } from "@/lib/supabase-browser";
import { EUROS } from "@/lib/devis";
import { calculerPrix, dureeLisible, type BaseCalcul } from "@/lib/base-calcul";
import { telephoneFrancais } from "@/lib/affichage";
import Entete from "../../composants/Entete";
import Garde from "../../composants/Garde";
import Squelette from "../../composants/Squelette";
import { Erreur, type ErreurPostgrest } from "../../composants/Etat";
import ChampSuggere, { type Proposition } from "../../composants/ChampSuggere";

/**
 * Le devis s'édite dans le document tel qu'il sera imprimé.
 *
 * Un formulaire d'un côté et un aperçu de l'autre oblige à faire
 * l'aller-retour pour juger du résultat. Ici les champs sont dans le
 * document ; à l'impression, la feuille de style retire les cadres,
 * la navigation et la barre d'outils. Ce qu'on voit est ce qui sort.
 */

type Entreprise = Record<string, unknown> & { id: string };

type Ligne = {
  id: string; rang: number; libelle: string; description: string | null;
  unite: string; quantite: number; prix_unitaire_ht: number;
  remise_pct: number; taux_tva: number; total_ht: number;
};

type Devis = {
  id: string; numero: string; statut: string; date_emission: string;
  validite_jours: number; client_nom: string; client_adresse: string | null;
  client_commune: string | null; client_tel: string | null;
  client_email: string | null;
  lieu_travaux: string | null; conditions: string | null;
  delai_execution: string | null; acompte_pct: number | null;
  devis_payant: boolean; prix_devis_ht: number | null;
  total_ht: number; total_tva: number; total_ttc: number;
  demande_id: string | null;
};

type Prestation = {
  id: string; libelle: string; unite: string;
  prix_ht: number | null; taux_tva: number;
  temps_min: number | null; fourniture_ht: number | null;
};

type ClientConnu = {
  id: string; nom: string | null; telephone: string | null;
  email: string | null;
  adresse: string | null; commune: string | null;
};

type Intervention = {
  id: string; cree_le: string; type_probleme: string | null;
  description_client: string | null; origine: string | null;
  adresse: string | null; commune: string | null; statut: string;
};

export default function FicheDevis() {
  return <Garde><Entete /><Contenu /></Garde>;
}

function Contenu() {
  const { id } = useParams<{ id: string }>();
  const [d, setD] = useState<Devis | null>(null);
  const [lignes, setLignes] = useState<Ligne[]>([]);
  const [ent, setEnt] = useState<Entreprise | null>(null);
  const [catalogue, setCatalogue] = useState<Prestation[]>([]);
  const [erreur, setErreur] = useState<ErreurPostgrest>(null);
  const [interventions, setInterventions] = useState<Intervention[]>([]);
  const [copie, setCopie] = useState(false);

  const charger = useCallback(async () => {
    const { data: dev, error } = await sb
      .from("devis").select("*").eq("id", id).maybeSingle();
    if (error) { setErreur(error); return; }
    setD(dev as Devis);

    const { data: l } = await sb
      .from("devis_lignes").select("*").eq("devis_id", id).order("rang");
    setLignes((l as Ligne[]) ?? []);
  }, [id]);

  useEffect(() => {
    (async () => {
      const { data: e } = await sb.from("entreprises").select("*").limit(1).maybeSingle();
      setEnt(e as Entreprise);
      const { data: c } = await sb
        .from("prestations").select("id, libelle, unite, prix_ht, taux_tva, temps_min, fourniture_ht")
        .eq("actif", true).order("rang");
      setCatalogue((c as Prestation[]) ?? []);
      await charger();
    })();
  }, [charger]);

  /**
   * Les interventions passées du client.
   *
   * Un devis suit presque toujours une visite : la description, le
   * lieu et le problème existent déjà quelque part. Les retrouver
   * évite de les retaper, et surtout évite de les retaper de
   * travers.
   */
  const chargerInterventions = useCallback(async (clientId: string | null) => {
    if (!clientId) { setInterventions([]); return; }
    const { data } = await sb
      .from("demandes")
      .select("id, cree_le, type_probleme, description_client, origine, adresse, commune, statut")
      .eq("client_id", clientId)
      .order("cree_le", { ascending: false })
      .limit(6);
    setInterventions((data as Intervention[]) ?? []);
  }, []);

  // On ne suit que l'identifiant du client : recharger la liste à
  // chaque frappe dans le document n'aurait aucun sens.
  const clientId = (d as (Devis & { client_id?: string | null }) | null)?.client_id ?? null;
  useEffect(() => { chargerInterventions(clientId); }, [clientId, chargerInterventions]);

  async function choisirClient(c: ClientConnu) {
    const champs = {
      client_id: c.id,
      client_nom: c.nom ?? "",
      client_adresse: c.adresse,
      client_commune: c.commune,
      client_tel: c.telephone,
      client_email: c.email,
      lieu_travaux: [c.adresse, c.commune].filter(Boolean).join(", ") || null,
    };
    setD((x) => (x ? { ...x, ...champs } as Devis : x));
    await sb.from("devis").update(champs).eq("id", id);
    await chargerInterventions(c.id);
  }

  /** Reprend une intervention : lieu, et la description en note. */
  async function reprendre(i: Intervention) {
    const champs = {
      demande_id: i.id,
      lieu_travaux: [i.adresse, i.commune].filter(Boolean).join(", ") || null,
      notes_internes: i.description_client,
    };
    setD((x) => (x ? { ...x, ...champs } as Devis : x));
    await sb.from("devis").update(champs).eq("id", id);
  }

  async function majDevis(champ: string, valeur: unknown) {
    setD((x) => (x ? { ...x, [champ]: valeur } as Devis : x));
    const { error } = await sb.from("devis").update({ [champ]: valeur }).eq("id", id);
    if (error) setErreur(error);
  }

  async function majLigne(l: Ligne, champ: keyof Ligne, brut: string) {
    const numerique = ["quantite", "prix_unitaire_ht", "remise_pct", "taux_tva"];
    const valeur = numerique.includes(champ as string)
      ? Number(String(brut).replace(",", ".")) || 0
      : brut;
    const { error } = await sb.from("devis_lignes")
      .update({ [champ]: valeur }).eq("id", l.id);
    if (error) { setErreur(error); return; }
    // Les totaux sont recalculés par la base : on relit plutôt que
    // de refaire le calcul ici et risquer un écart.
    await charger();
  }

  async function ajouter(p?: Prestation) {
    const rang = (lignes.at(-1)?.rang ?? 0) + 10;
    // Le prix fixé l'emporte ; sinon la base de calcul le déduit du
    // temps et des fournitures. Si ni l'un ni l'autre, on laisse zéro
    // et le plombier voit tout de suite qu'il doit le remplir.
    const c = p ? calculerPrix(p, base()) : null;
    const { error } = await sb.from("devis_lignes").insert({
      devis_id: id,
      rang,
      libelle: p?.libelle ?? "",
      unite: p?.unite ?? "unite",
      quantite: 1,
      prix_unitaire_ht: c?.prix ?? 0,
      taux_tva: p?.taux_tva ?? 10,
    });
    if (error) { setErreur(error); return; }
    await charger();
  }

  /** Le forfait de déplacement, en une ligne. */
  async function ajouterDeplacement(montant: number) {
    const rang = (lignes.at(-1)?.rang ?? 0) + 10;
    const { error } = await sb.from("devis_lignes").insert({
      devis_id: id, rang,
      libelle: "Déplacement",
      unite: "forfait",
      quantite: 1,
      prix_unitaire_ht: montant,
      taux_tva: 10,
    });
    if (error) { setErreur(error); return; }
    await charger();
  }

  async function retirer(l: Ligne) {
    await sb.from("devis_lignes").delete().eq("id", l.id);
    await charger();
  }

  if (erreur && !d) return <main className="page"><Erreur e={erreur} /></main>;
  if (!d || !ent) return <Squelette variante="fiche" />;

  const S = (c: string) => (ent[c] as string) ?? "";

  /**
   * La base de calcul de l'entreprise.
   *
   * Déclarée en fonction parce qu'elle sert aussi avant le rendu,
   * dans ajouter(), où `ent` est déjà chargée.
   */
  function base(): BaseCalcul {
    return {
      taux_horaire_ht: ent?.taux_horaire_ht != null ? Number(ent.taux_horaire_ht) : null,
      coef_fournitures: ent?.coef_fournitures != null ? Number(ent.coef_fournitures) : 1,
      frais_deplacement_ht: ent?.frais_deplacement_ht != null
        ? Number(ent.frais_deplacement_ht) : null,
    };
  }
  /**
   * Le devis en texte simple.
   *
   * C'est ce que reçoit le client dans le corps du courriel. Le PDF
   * reste la pièce jointe ; ce texte sert à ce que le message soit
   * lisible même sans l'ouvrir.
   */
  function resume(): string {
    const l = lignes.map((x) =>
      `- ${x.libelle} : ${x.quantite} ${x.unite} x ${EUROS.format(Number(x.prix_unitaire_ht))}`
      + ` = ${EUROS.format(Number(x.total_ht))} HT`).join("\n");
    return [
      `Bonjour,`,
      ``,
      `Veuillez trouver ci-dessous le devis ${d!.numero}`
        + (d!.lieu_travaux ? ` pour les travaux situés ${d!.lieu_travaux}` : "") + ` :`,
      ``,
      l || "(aucune ligne)",
      ``,
      `Total hors taxes : ${EUROS.format(Number(d!.total_ht))}`,
      `TVA : ${EUROS.format(Number(d!.total_tva))}`,
      `TOTAL À PAYER : ${EUROS.format(Number(d!.total_ttc))} TTC`,
      ``,
      `Devis valable ${d!.validite_jours} jours.`
        + (d!.delai_execution ? ` Délai d'exécution : ${d!.delai_execution}.` : ""),
      ``,
      `Cordialement,`,
      S("nom"),
      [S("telephone_public") && telephoneFrancais(S("telephone_public")), S("email_public")]
        .filter(Boolean).join(" — "),
    ].join("\n");
  }

  function lienWebmail(service: "gmail" | "outlook" | "yahoo" | "defaut"): string {
    const a = encodeURIComponent(d!.client_email ?? "");
    const o = encodeURIComponent(`Devis ${d!.numero} — ${S("nom")}`);
    const c = encodeURIComponent(resume());
    if (service === "gmail")   return `https://mail.google.com/mail/?view=cm&fs=1&to=${a}&su=${o}&body=${c}`;
    if (service === "outlook") return `https://outlook.live.com/mail/0/deeplink/compose?to=${a}&subject=${o}&body=${c}`;
    if (service === "yahoo")   return `https://compose.mail.yahoo.com/?to=${a}&subject=${o}&body=${c}`;
    return `mailto:${a}?subject=${o}&body=${c}`;
  }

  /**
   * Export tableur.
   *
   * Un vrai .xlsx demanderait une bibliothèque de 900 Ko pour un
   * gain nul : Excel, LibreOffice et Numbers ouvrent ce CSV
   * directement. Le point-virgule et le BOM sont ce qu'attend
   * Excel en français.
   */
  function exporterCsv() {
    const q = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const virgule = (n: number) => String(n).replace(".", ",");
    const lig = [
      ["Devis", d!.numero].map(q).join(";"),
      ["Client", d!.client_nom].map(q).join(";"),
      ["Lieu des travaux", d!.lieu_travaux ?? ""].map(q).join(";"),
      ["Date", new Date(d!.date_emission).toLocaleDateString("fr-FR")].map(q).join(";"),
      "",
      ["Désignation", "Unité", "Quantité", "Prix HT", "TVA %", "Total HT"].map(q).join(";"),
      ...lignes.map((x) => [
        x.libelle, x.unite, virgule(Number(x.quantite)),
        virgule(Number(x.prix_unitaire_ht)), virgule(Number(x.taux_tva)),
        virgule(Number(x.total_ht)),
      ].map(q).join(";")),
      "",
      ["", "", "", "", "Total HT", virgule(Number(d!.total_ht))].map(q).join(";"),
      ["", "", "", "", "TVA", virgule(Number(d!.total_tva))].map(q).join(";"),
      ["", "", "", "", "Total TTC", virgule(Number(d!.total_ttc))].map(q).join(";"),
    ].join("\r\n");

    // Le BOM : sans lui Excel lit les accents de travers.
    const blob = new Blob(["\uFEFF" + lig], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${d!.numero}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function copier() {
    try {
      await navigator.clipboard.writeText(resume());
      setCopie(true);
      setTimeout(() => setCopie(false), 2500);
    } catch {
      setErreur({ message: "Le navigateur a refusé l'accès au presse-papiers." });
    }
  }

  const modifiable = d.statut === "brouillon";

  // Ce que la loi impose et qui manque encore.
  const manquant = [
    !S("nom") && "la raison sociale",
    !S("siret") && "le SIRET",
    !S("adresse") && "l'adresse de l'entreprise",
    !S("assurance_decennale") && "l'assurance décennale",
    !S("mediateur_nom") && "le médiateur de la consommation",
  ].filter(Boolean) as string[];

  const echeance = new Date(d.date_emission);
  echeance.setDate(echeance.getDate() + (d.validite_jours ?? 90));

  // La TVA se ventile par taux : un devis mêlant 10 % et 20 % doit
  // montrer les deux lignes, pas un total global.
  const parTaux = new Map<number, { base: number; tva: number }>();
  for (const l of lignes) {
    const e = parTaux.get(l.taux_tva) ?? { base: 0, tva: 0 };
    e.base += Number(l.total_ht);
    e.tva += Math.round(Number(l.total_ht) * l.taux_tva) / 100;
    parTaux.set(l.taux_tva, e);
  }

  return (
    <main className="page">
      <div className="barre-devis">
        <Link href="/devis" className="retour">← Tous les devis</Link>
        <span className="discret" style={{ marginLeft: "auto" }}>
          {modifiable ? "Brouillon — modifiable" : "Document figé"}
        </span>
        {modifiable && (
          <button className="bouton" style={{ minHeight: 44 }}
                  onClick={() => majDevis("statut", "envoye")}>
            Marquer envoyé
          </button>
        )}
        <button className="bouton" data-style="plein" style={{ minHeight: 44 }}
                onClick={() => window.print()}>
          Imprimer ou enregistrer en PDF
        </button>
      </div>

      <Erreur e={erreur} />

      {modifiable && interventions.length > 0 && (
        <section className="rappel-client sans-impression">
          <div className="rappel-client-titre">
            Ce que nous savons déjà de {d.client_nom}
          </div>
          <ul className="rappel-liste">
            {interventions.map((i) => (
              <li key={i.id}>
                <div className="rappel-quand">
                  {new Date(i.cree_le).toLocaleDateString("fr-FR",
                    { day: "numeric", month: "short", year: "numeric" })}
                  <span className="rappel-origine">
                    {i.origine === "assistant" ? "Assistant" : "Saisi à la main"}
                  </span>
                </div>
                <div className="rappel-texte">
                  <strong>{i.type_probleme ?? "Demande"}</strong>
                  {i.description_client ? ` — ${i.description_client}` : ""}
                </div>
                <div className="rappel-lieu">
                  {[i.adresse, i.commune].filter(Boolean).join(", ")}
                </div>
                <div className="rappel-actions">
                  <button type="button" className="bouton" style={{ minHeight: 40 }}
                          onClick={() => reprendre(i)}>
                    Reprendre pour ce devis
                  </button>
                  <Link href={`/demandes/${i.id}`} className="retour">Voir la fiche</Link>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {manquant.length > 0 && (
        <div className="encart-erreur" role="alert">
          <div className="encart-erreur-titre">Mentions obligatoires manquantes</div>
          <div style={{ lineHeight: 1.55 }}>
            Il manque {manquant.join(", ")}. Un devis incomplet expose à une
            amende administrative. À compléter dans{" "}
            <Link href="/reglages">Réglages → Devis</Link>.
          </div>
        </div>
      )}

      <article className="devis">
        <header className="devis-tete">
          <div>
            <div className="devis-entreprise">{S("nom") || "[RAISON SOCIALE]"}</div>
            <div className="devis-petit">
              {S("adresse")}{S("ville") && <><br />{S("ville")}</>}
              {S("telephone_public") && <><br />{telephoneFrancais(S("telephone_public"))}</>}
              {S("siret") && <><br />SIRET {S("siret")}</>}
              {S("tva_intracom") && <><br />TVA {S("tva_intracom")}</>}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div className="devis-titre">Devis</div>
            <div className="devis-numero">{d.numero}</div>
            <div className="devis-petit">
              Établi le {new Date(d.date_emission).toLocaleDateString("fr-FR")}<br />
              Valable jusqu&apos;au {echeance.toLocaleDateString("fr-FR")}
            </div>
          </div>
        </header>

        <section className="devis-parties">
          <div>
            <div className="champ-nom">Client</div>
            {modifiable ? (
              <div className="sans-impression">
                <ChampSuggere<ClientConnu>
                  id="devis-client"
                  libelle="Nom du client"
                  libelleExterne
                  texte={d.client_nom}
                  surTexte={(v) => { setD({ ...d, client_nom: v }); }}
                  minimum={2}
                  chercher={async (q) => {
                    const { data } = await sb
                      .from("clients")
                      .select("id, nom, telephone, email, adresse, commune")
                      .ilike("nom", `%${q}%`)
                      .limit(6);
                    return ((data as ClientConnu[]) ?? []).map((c) => ({
                      cle: c.id,
                      titre: c.nom ?? "Sans nom",
                      detail: [c.telephone, c.commune].filter(Boolean).join(" · "),
                      valeur: c,
                    }));
                  }}
                  surChoix={(p: Proposition<ClientConnu>) => choisirClient(p.valeur)}
                  surFin={(v) => majDevis("client_nom", v)}
                />
              </div>
            ) : (
              <input className="devis-champ" value={d.client_nom} disabled
                     aria-label="Nom du client" readOnly />
            )}
            <input className="devis-champ" value={d.client_adresse ?? ""} disabled={!modifiable}
                   aria-label="Adresse du client" placeholder="Adresse"
                   onChange={(e) => setD({ ...d, client_adresse: e.target.value })}
                   onBlur={(e) => majDevis("client_adresse", e.target.value)} />
            <input className="devis-champ" value={d.client_commune ?? ""} disabled={!modifiable}
                   aria-label="Commune du client" placeholder="Commune"
                   onChange={(e) => setD({ ...d, client_commune: e.target.value })}
                   onBlur={(e) => majDevis("client_commune", e.target.value)} />
            <input className="devis-champ" type="email" value={d.client_email ?? ""}
                   disabled={!modifiable}
                   aria-label="Courriel du client" placeholder="Courriel"
                   onChange={(e) => setD({ ...d, client_email: e.target.value })}
                   onBlur={(e) => majDevis("client_email", e.target.value)} />
            <input className="devis-champ" value={d.client_tel ?? ""} disabled={!modifiable}
                   aria-label="Téléphone du client" placeholder="Téléphone"
                   onChange={(e) => setD({ ...d, client_tel: e.target.value })}
                   onBlur={(e) => majDevis("client_tel", e.target.value)} />
          </div>
          <div>
            <div className="champ-nom">Lieu des travaux</div>
            <input className="devis-champ" value={d.lieu_travaux ?? ""} disabled={!modifiable}
                   aria-label="Lieu des travaux" placeholder="Si différent"
                   onChange={(e) => setD({ ...d, lieu_travaux: e.target.value })}
                   onBlur={(e) => majDevis("lieu_travaux", e.target.value)} />
            <div className="champ-nom" style={{ marginTop: "1rem" }}>Délai d&apos;exécution</div>
            <input className="devis-champ" value={d.delai_execution ?? ""} disabled={!modifiable}
                   aria-label="Délai d'exécution"
                   onChange={(e) => setD({ ...d, delai_execution: e.target.value })}
                   onBlur={(e) => majDevis("delai_execution", e.target.value)} />
          </div>
        </section>

        <table className="devis-table">
          <thead>
            <tr>
              <th style={{ width: "44%" }}>Désignation</th>
              <th style={{ width: "10%" }}>Unité</th>
              <th style={{ width: "10%" }}>Qté</th>
              <th style={{ width: "14%" }}>Prix HT</th>
              <th style={{ width: "8%" }}>TVA</th>
              <th style={{ width: "14%" }}>Total HT</th>
              {modifiable && <th className="sans-impression" />}
            </tr>
          </thead>
          <tbody>
            {lignes.map((l) => (
              <tr key={l.id}>
                <td>
                  <input className="devis-champ" defaultValue={l.libelle} disabled={!modifiable}
                         aria-label="Désignation"
                         onBlur={(e) => majLigne(l, "libelle", e.target.value)} />
                </td>
                <td>
                  <input className="devis-champ" defaultValue={l.unite} disabled={!modifiable}
                         aria-label="Unité"
                         onBlur={(e) => majLigne(l, "unite", e.target.value)} />
                </td>
                <td>
                  <input className="devis-champ nombre" defaultValue={l.quantite}
                         disabled={!modifiable} inputMode="decimal" aria-label="Quantité"
                         onBlur={(e) => majLigne(l, "quantite", e.target.value)} />
                </td>
                <td>
                  <input className="devis-champ nombre" defaultValue={l.prix_unitaire_ht}
                         disabled={!modifiable} inputMode="decimal" aria-label="Prix unitaire HT"
                         onBlur={(e) => majLigne(l, "prix_unitaire_ht", e.target.value)} />
                </td>
                <td>
                  <input className="devis-champ nombre" defaultValue={l.taux_tva}
                         disabled={!modifiable} inputMode="decimal" aria-label="Taux de TVA"
                         onBlur={(e) => majLigne(l, "taux_tva", e.target.value)} />
                </td>
                <td className="nombre total">{EUROS.format(Number(l.total_ht))}</td>
                {modifiable && (
                  <td className="sans-impression">
                    <button type="button" aria-label={`Retirer ${l.libelle}`}
                            onClick={() => retirer(l)} className="retirer-ligne">×</button>
                  </td>
                )}
              </tr>
            ))}
            {lignes.length === 0 && (
              <tr><td colSpan={7} className="discret" style={{ padding: "1.25rem .5rem" }}>
                Aucune ligne. Choisissez une prestation ci-dessous.
              </td></tr>
            )}
          </tbody>
        </table>

        {modifiable && (
          <div className="sans-impression" style={{ display: "flex", flexWrap: "wrap",
                                                    gap: ".625rem", alignItems: "center",
                                                    margin: "1rem 0 2rem" }}>
            <label htmlFor="ajout-presta" className="discret">Ajouter</label>
            <select id="ajout-presta" defaultValue=""
                    style={{ width: "auto", minWidth: "18rem", minHeight: 44 }}
                    onChange={(e) => {
                      const p = catalogue.find((x) => x.id === e.target.value);
                      if (p) ajouter(p);
                      e.target.value = "";
                    }}>
              <option value="">Une prestation du catalogue…</option>
              {catalogue.map((p) => {
                const c = calculerPrix(p, base());
                const suite = c
                  ? ` — ${EUROS.format(c.prix)}${c.fixe ? "" : " (calculé)"}`
                  : p.temps_min
                    ? ` — ${dureeLisible(p.temps_min)}, prix à définir`
                    : " — prix à définir";
                return <option key={p.id} value={p.id}>{p.libelle}{suite}</option>;
              })}
            </select>
            <button type="button" className="bouton" style={{ minHeight: 44 }}
                    onClick={() => ajouter()}>Ligne libre</button>
            {base().frais_deplacement_ht !== null && (
              <button type="button" className="bouton" style={{ minHeight: 44 }}
                      onClick={() => ajouterDeplacement(base().frais_deplacement_ht!)}>
                Déplacement {EUROS.format(base().frais_deplacement_ht!)}
              </button>
            )}
          </div>
        )}

        <section className="devis-totaux">
          <div className="devis-ligne-total">
            <span>Total hors taxes</span>
            <span className="nombre">{EUROS.format(Number(d.total_ht))}</span>
          </div>
          {[...parTaux.entries()].sort((a, b) => a[0] - b[0]).map(([taux, v]) => (
            <div className="devis-ligne-total" key={taux}>
              <span>TVA {String(taux).replace(".", ",")} % sur {EUROS.format(v.base)}</span>
              <span className="nombre">{EUROS.format(v.tva)}</span>
            </div>
          ))}
          <div className="devis-ligne-total devis-ttc">
            <span>Total toutes taxes comprises</span>
            <span className="nombre">{EUROS.format(Number(d.total_ttc))}</span>
          </div>
        </section>

        <footer className="devis-mentions">
          {d.conditions && <p><strong>Paiement.</strong> {d.conditions}</p>}

          {S("assurance_decennale") && (
            <p><strong>Assurance décennale.</strong> {S("assurance_decennale")}</p>
          )}

          <p>
            <strong>Validité.</strong> Ce devis est valable {d.validite_jours} jours
            à compter de sa date d&apos;établissement.
            {d.devis_payant && d.prix_devis_ht != null
              ? ` Son établissement est facturé ${EUROS.format(d.prix_devis_ht)} hors taxes.`
              : " Son établissement est gratuit."}
          </p>

          {S("mediateur_nom") && (
            <p>
              <strong>Médiation.</strong> En cas de litige, le client peut saisir
              gratuitement {S("mediateur_nom")}
              {S("mediateur_url") ? ` — ${S("mediateur_url")}` : ""}.
            </p>
          )}

          <p>
            <strong>Rétractation.</strong> Lorsque le devis est signé au domicile
            du client à la suite d&apos;un démarchage, celui-ci dispose de
            quatorze jours pour se rétracter.
          </p>

          <div className="devis-signature">
            <div>
              <div className="champ-nom">Bon pour accord</div>
              <div className="devis-cadre-signature">
                Date, signature et mention « bon pour travaux »
              </div>
            </div>
          </div>
        </footer>
      </article>

      <section className="envoi-devis sans-impression">
        <h2 className="envoi-titre">Envoyer ce devis</h2>
        <p className="discret" style={{ margin: "0 0 1rem", lineHeight: 1.55 }}>
          Le texte du devis est recopié dans le message. Le document lui-même
          est une pièce jointe : enregistrez d&apos;abord le PDF, puis joignez-le
          au message qui s&apos;ouvre. Aucun site de messagerie n&apos;autorise un
          lien à attacher un fichier tout seul — c&apos;est une protection
          contre les pièces jointes piégées, et elle vaut mieux que la
          commodité.
        </p>

        <div className="envoi-grille">
          <button type="button" className="bouton" data-style="plein"
                  style={{ minHeight: 44 }} onClick={() => window.print()}>
            Enregistrer en PDF
          </button>
          <button type="button" className="bouton" style={{ minHeight: 44 }}
                  onClick={exporterCsv}>
            Exporter pour Excel
          </button>
          <button type="button" className="bouton" style={{ minHeight: 44 }}
                  onClick={copier}>
            {copie ? "Copié" : "Copier le texte"}
          </button>
        </div>

        <div className="envoi-grille" style={{ marginTop: ".625rem" }}>
          <a className="bouton" style={{ minHeight: 44 }} href={lienWebmail("gmail")}
             target="_blank" rel="noopener noreferrer">Ouvrir dans Gmail</a>
          <a className="bouton" style={{ minHeight: 44 }} href={lienWebmail("outlook")}
             target="_blank" rel="noopener noreferrer">Ouvrir dans Outlook</a>
          <a className="bouton" style={{ minHeight: 44 }} href={lienWebmail("yahoo")}
             target="_blank" rel="noopener noreferrer">Ouvrir dans Yahoo</a>
          <a className="bouton" style={{ minHeight: 44 }} href={lienWebmail("defaut")}>
            Logiciel de messagerie
          </a>
        </div>

        {!d.client_email && (
          <p className="discret" style={{ marginTop: ".875rem" }}>
            Aucun courriel pour ce client : le message s&apos;ouvrira avec le
            destinataire vide. Renseignez-le dans le devis ci-dessus.
          </p>
        )}
      </section>
    </main>
  );
}
