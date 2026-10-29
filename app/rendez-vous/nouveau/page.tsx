"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { sb } from "@/lib/supabase-browser";
import Entete from "../../composants/Entete";
import Garde from "../../composants/Garde";
import { Erreur, type ErreurPostgrest } from "../../composants/Etat";

type Membre = { id: string; nom: string; role: string; entreprise_id: string; recoit_rdv: boolean };

type Verif =
  | { etat: "vierge" }
  | { etat: "en_cours" }
  | { etat: "ok"; libelle: string; lat: number; lon: number; score: number }
  | { etat: "echec"; message: string };

const TYPES: [string, string][] = [
  ["fuite", "Fuite"],
  ["debouchage", "Canalisation bouchée"],
  ["chauffe_eau_depannage", "Chauffe-eau — dépannage"],
  ["chauffe_eau_remplacement", "Chauffe-eau — remplacement"],
  ["entretien_chaudiere", "Entretien chaudière"],
  ["wc", "WC"],
  ["robinetterie", "Robinetterie"],
  ["recherche_fuite", "Recherche de fuite"],
  ["devis", "Devis ou métré"],
  ["autre", "Autre"],
];

const DUREES: [number, string][] = [
  [30, "30 minutes"], [60, "1 heure"], [90, "1 h 30"],
  [120, "2 heures"], [180, "3 heures"], [480, "Journée"],
];

export default function NouveauRdv() {
  return <Garde><Entete /><Contenu /></Garde>;
}

function Contenu() {
  const router = useRouter();

  const [membres, setMembres] = useState<Membre[]>([]);
  const [erreur, setErreur] = useState<ErreurPostgrest>(null);
  const [envoi, setEnvoi] = useState(false);
  const [verif, setVerif] = useState<Verif>({ etat: "vierge" });
  const [avertissement, setAvertissement] = useState<string | null>(null);

  const [nom, setNom] = useState("");
  const [tel, setTel] = useState("");
  const [adresse, setAdresse] = useState("");
  const [commune, setCommune] = useState("");
  const [type, setType] = useState("fuite");
  const [qui, setQui] = useState("");
  const [descr, setDescr] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [debut, setDebut] = useState("14:00");
  const [duree, setDuree] = useState(90);
  const [urgence, setUrgence] = useState("basse");
  const [prevenir, setPrevenir] = useState(true);

  useEffect(() => {
    (async () => {
      const { data, error } = await sb
        .from("plombiers")
        .select("id, nom, role, entreprise_id, recoit_rdv")
        .order("role");
      if (error) { setErreur(error); return; }
      const m = (data as Membre[]) ?? [];
      setMembres(m);
      const premier = m.find((x) => x.recoit_rdv) ?? m[0];
      if (premier) setQui(premier.id);
    })();
  }, []);

  /**
   * Vérification d'adresse par la Base Adresse Nationale, appelée
   * directement depuis le navigateur : l'API est publique, gratuite
   * et autorise les requêtes croisées. Pas de clé, pas de serveur.
   */
  async function verifier() {
    if (!adresse.trim()) return;
    setVerif({ etat: "en_cours" });
    const requete = [adresse, commune].filter(Boolean).join(" ");
    try {
      const r = await fetch(
        `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(requete)}&limit=5`
      );
      const j = await r.json();
      const traits: { properties: { label: string; city: string; score: number };
                      geometry: { coordinates: [number, number] } }[] = j.features ?? [];

      // Le filtre par commune est la protection essentielle : sans
      // lui, « 48 rue des Lilas » peut renvoyer un résultat à 500 km.
      const cible = commune.trim().toLowerCase();
      const candidats = cible
        ? traits.filter((t) => t.properties.city?.toLowerCase() === cible)
        : traits;

      const meilleur = candidats[0];
      if (!meilleur || meilleur.properties.score < 0.6) {
        setVerif({ etat: "echec",
                   message: cible
                     ? `Rien trouvé à ${commune} pour cette rue. Vérifiez l'orthographe.`
                     : "Adresse introuvable dans le référentiel." });
        return;
      }

      const [lon, lat] = meilleur.geometry.coordinates;
      setVerif({ etat: "ok", libelle: meilleur.properties.label,
                 lat, lon, score: meilleur.properties.score });
      if (!commune) setCommune(meilleur.properties.city);
    } catch {
      setVerif({ etat: "echec", message: "Le référentiel d'adresses n'a pas répondu." });
    }
  }

  async function enregistrer() {
    setErreur(null);
    setAvertissement(null);

    if (!nom.trim() || !adresse.trim() || !qui) {
      setErreur({ message: "Nom, adresse et plombier sont obligatoires." });
      return;
    }

    setEnvoi(true);

    // L'écriture passe par le serveur : poser le créneau dans Google
    // Agenda demande le jeton du plombier, qui ne doit jamais
    // atteindre un navigateur.
    const { data: session } = await sb.auth.getSession();
    const jeton = session.session?.access_token;
    if (!jeton) {
      setErreur({ message: "Session expirée. Reconnectez-vous." });
      setEnvoi(false);
      return;
    }

    const ok = verif.etat === "ok";

    const reponse = await fetch("/api/rendez-vous", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${jeton}`,
      },
      body: JSON.stringify({
        nom: nom.trim(),
        telephone: tel.trim(),
        adresse: adresse.trim(),
        commune: commune.trim(),
        type,
        assigneA: qui,
        description: descr.trim(),
        debut: new Date(`${date}T${debut}:00`).toISOString(),
        dureeMin: duree,
        urgence,
        prevenir,
        latitude: ok ? verif.lat : null,
        longitude: ok ? verif.lon : null,
        score: ok ? verif.score : null,
        adresseNormalisee: ok ? verif.libelle : null,
      }),
    });

    const corps = await reponse.json().catch(() => ({}));
    setEnvoi(false);

    if (!reponse.ok) {
      setErreur({ message: corps.erreur ?? "Enregistrement impossible." });
      return;
    }

    // Le rendez-vous est enregistré dans tous les cas. Si Google a
    // refusé, on reste sur la page pour le dire : partir en silence
    // laisserait croire que le créneau est bloqué partout.
    if (!corps.googleOk && corps.googleMessage) {
      setAvertissement(corps.googleMessage);
      return;
    }

    router.push("/agenda");
  }

  return (
    <main className="page">
      <Link href="/agenda" className="retour">
        <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path d="M11.5 5 6.5 10l5 5" stroke="currentColor" strokeWidth="1.8"
                strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Retour au planning
      </Link>

      <h1 style={{ marginTop: ".75rem" }}>Nouveau rendez-vous</h1>
      <p className="sous-titre">
        Pour un client qui vous a appelé directement, croisé sur un chantier, ou
        laissé un mot. L&apos;assistant tiendra compte de ce créneau comme des autres.
      </p>

      <Erreur e={erreur} />

      {avertissement && (
        <div className="encart-erreur" role="status"
             style={{ borderColor: "var(--urgent-bord)" }}>
          <div className="encart-erreur-titre">Enregistré, mais pas dans Google Agenda</div>
          <div style={{ lineHeight: 1.55 }}>{avertissement}</div>
          <div style={{ marginTop: ".75rem" }}>
            <Link className="bouton" href="/agenda" style={{ minHeight: 44 }}>
              Voir le planning
            </Link>
          </div>
        </div>
      )}

      <div className="colonnes">
        <div className="colonne-large">

          <h2 style={{ marginTop: 0 }}>Le client</h2>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem" }}>
            <div style={{ flex: "1 1 260px", minWidth: 0 }}>
              <label htmlFor="nom" style={{ display: "block", fontSize: ".875rem",
                                            fontWeight: 500, marginBottom: ".375rem" }}>
                Nom
              </label>
              <input id="nom" type="text" value={nom}
                     onChange={(e) => setNom(e.target.value)} placeholder="Mme Arnaud" />
            </div>
            <div style={{ flex: "1 1 200px", minWidth: 0 }}>
              <label htmlFor="tel" style={{ display: "block", fontSize: ".875rem",
                                            fontWeight: 500, marginBottom: ".375rem" }}>
                Téléphone
              </label>
              <input id="tel" type="text" value={tel}
                     onChange={(e) => setTel(e.target.value)} placeholder="06 00 00 00 00" />
            </div>
          </div>

          <h2>L&apos;adresse</h2>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem" }}>
            <div style={{ flex: "2 1 300px", minWidth: 0 }}>
              <label htmlFor="adr" style={{ display: "block", fontSize: ".875rem",
                                            fontWeight: 500, marginBottom: ".375rem" }}>
                Numéro et rue
              </label>
              <input id="adr" type="text" value={adresse}
                     onChange={(e) => { setAdresse(e.target.value); setVerif({ etat: "vierge" }); }}
                     placeholder="18 rue Volney" />
            </div>
            <div style={{ flex: "1 1 180px", minWidth: 0 }}>
              <label htmlFor="com" style={{ display: "block", fontSize: ".875rem",
                                            fontWeight: 500, marginBottom: ".375rem" }}>
                Commune
              </label>
              <input id="com" type="text" value={commune}
                     onChange={(e) => { setCommune(e.target.value); setVerif({ etat: "vierge" }); }}
                     placeholder="Angers" />
            </div>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center",
                        gap: ".875rem", marginTop: ".875rem" }}>
            <button type="button" className="bouton" onClick={verifier}
                    style={{ minHeight: 44, borderColor: "var(--accent)", color: "var(--accent)" }}
                    disabled={verif.etat === "en_cours"}>
              {verif.etat === "en_cours" ? "Vérification…" : "Vérifier l'adresse"}
            </button>
            {verif.etat === "ok" && (
              <span style={{ fontSize: ".875rem", color: "var(--accent-sombre)", lineHeight: 1.45 }}>
                {verif.libelle} — trouvée dans la Base Adresse Nationale
              </span>
            )}
            {verif.etat === "echec" && (
              <span className="erreur">{verif.message}</span>
            )}
          </div>

          <h2>L&apos;intervention</h2>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem" }}>
            <div style={{ flex: "1 1 240px", minWidth: 0 }}>
              <label htmlFor="type" style={{ display: "block", fontSize: ".875rem",
                                             fontWeight: 500, marginBottom: ".375rem" }}>
                Type
              </label>
              <select id="type" value={type} onChange={(e) => setType(e.target.value)}>
                {TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div style={{ flex: "1 1 200px", minWidth: 0 }}>
              <label htmlFor="qui" style={{ display: "block", fontSize: ".875rem",
                                            fontWeight: 500, marginBottom: ".375rem" }}>
                Plombier
              </label>
              <select id="qui" value={qui} onChange={(e) => setQui(e.target.value)}>
                {membres.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nom}{m.recoit_rdv ? "" : " (ne reçoit pas de rendez-vous)"}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ marginTop: "1rem" }}>
            <label htmlFor="desc" style={{ display: "block", fontSize: ".875rem",
                                           fontWeight: 500, marginBottom: ".375rem" }}>
              Ce qu&apos;il faut savoir
            </label>
            <textarea id="desc" rows={3} value={descr}
                      onChange={(e) => setDescr(e.target.value)}
                      placeholder="Se garer dans la cour, portail bleu." />
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem", marginTop: "1rem" }}>
            <div style={{ flex: "1 1 180px", minWidth: 0 }}>
              <label htmlFor="date" style={{ display: "block", fontSize: ".875rem",
                                             fontWeight: 500, marginBottom: ".375rem" }}>
                Date
              </label>
              <input id="date" type="date" value={date}
                     onChange={(e) => setDate(e.target.value)} />
            </div>
            <div style={{ flex: "1 1 140px", minWidth: 0 }}>
              <label htmlFor="deb" style={{ display: "block", fontSize: ".875rem",
                                            fontWeight: 500, marginBottom: ".375rem" }}>
                Début
              </label>
              <input id="deb" type="time" step={900} value={debut}
                     onChange={(e) => setDebut(e.target.value)} />
            </div>
            <div style={{ flex: "1 1 160px", minWidth: 0 }}>
              <label htmlFor="dur" style={{ display: "block", fontSize: ".875rem",
                                            fontWeight: 500, marginBottom: ".375rem" }}>
                Durée
              </label>
              <select id="dur" value={duree} onChange={(e) => setDuree(Number(e.target.value))}>
                {DUREES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          </div>

          <fieldset style={{ border: 0, padding: 0, margin: "1.5rem 0 0" }}>
            <legend style={{ padding: 0, fontSize: ".875rem", fontWeight: 500,
                             marginBottom: ".625rem" }}>
              Urgence
            </legend>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "1.25rem" }}>
              {[["basse", "Normale"], ["haute", "Urgente"]].map(([v, l]) => (
                <label key={v} style={{ display: "inline-flex", alignItems: "center",
                                        gap: ".5625rem", minHeight: 44, cursor: "pointer",
                                        fontSize: ".9375rem" }}>
                  <input type="radio" name="urgence" checked={urgence === v}
                         onChange={() => setUrgence(v)}
                         style={{ width: 18, height: 18, minHeight: 0,
                                  accentColor: v === "haute" ? "var(--urgent)" : "var(--accent)" }} />
                  {l}
                </label>
              ))}
            </div>
          </fieldset>

          <div style={{ display: "flex", flexWrap: "wrap", gap: ".75rem",
                        marginTop: "2rem", paddingTop: "1.5rem",
                        borderTop: "1px solid var(--line)" }}>
            <button className="bouton" data-style="plein" onClick={enregistrer} disabled={envoi}>
              {envoi ? "Enregistrement…" : "Ajouter au planning"}
            </button>
            <Link className="bouton" href="/agenda">Annuler</Link>
          </div>
        </div>

        <aside className="colonne-cote">
          <div className="encadre">
            <h2 style={{ marginTop: 0 }}>Prévenir le client</h2>
            <label style={{ display: "flex", alignItems: "flex-start", gap: ".625rem",
                            cursor: "pointer" }}>
              <input type="checkbox" checked={prevenir}
                     onChange={(e) => setPrevenir(e.target.checked)}
                     style={{ width: 18, height: 18, minHeight: 0, marginTop: 2,
                              accentColor: "var(--accent)" }} />
              <span>Enregistrer un message de confirmation</span>
            </label>
            <div className="filet" />
            <p style={{ margin: 0, fontSize: ".875rem", lineHeight: 1.6 }}>
              Le message est écrit en base avec son texte exact. Il ne part
              réellement que si le canal de l&apos;entreprise est réglé sur SMS
              ou courriel dans les réglages. Par défaut, rien n&apos;est envoyé
              ni facturé.
            </p>
          </div>

          <div className="encadre" style={{ marginTop: "1.25rem",
                                            background: "var(--neutre-fond)" }}>
            <h2 style={{ marginTop: 0, color: "var(--ink-2)" }}>Ce qui se passe</h2>
            <p style={{ margin: 0, fontSize: ".875rem", lineHeight: 1.6 }}>
              Le rendez-vous est écrit dans ChantierPilot et posé dans
              l&apos;agenda Google du plombier choisi. L&apos;assistant lisant
              cet agenda pour ses disponibilités, il cessera aussitôt de
              proposer ce créneau au téléphone.
            </p>
          </div>
        </aside>
      </div>
    </main>
  );
}
