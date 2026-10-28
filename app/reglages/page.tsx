"use client";

import { useEffect, useState } from "react";
import { sb, type Plombier } from "@/lib/supabase-browser";
import Entete from "../composants/Entete";
import Garde from "../composants/Garde";

const JOURS: [string, string][] = [
  ["1", "Lundi"], ["2", "Mardi"], ["3", "Mercredi"], ["4", "Jeudi"],
  ["5", "Vendredi"], ["6", "Samedi"], ["0", "Dimanche"],
];

type Journee = {
  actif: boolean;
  coupure: boolean;
  debut: string;      // début de matinée
  pause: string;      // début de la coupure
  reprise: string;    // fin de la coupure
  fin: string;        // fin de journée
};

const JOURNEE_DEFAUT: Journee = {
  actif: false, coupure: true,
  debut: "08:00", pause: "12:00", reprise: "13:30", fin: "18:00",
};

/** « 08:00-12:00, 13:30-18:00 » → objet manipulable. */
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
  return j.coupure
    ? `${j.debut}-${j.pause}, ${j.reprise}-${j.fin}`
    : `${j.debut}-${j.fin}`;
}

export default function Reglages() {
  return <Garde><Entete /><Contenu /></Garde>;
}

function Contenu() {
  const [p, setP] = useState<Plombier | null>(null);
  const [semaine, setSemaine] = useState<Record<string, Journee>>({});
  const [communes, setCommunes] = useState("");
  const [etat, setEtat] = useState<"" | "en_cours" | "ok" | "erreur">("");
  const [modifie, setModifie] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await sb
        .from("plombiers")
        .select("id, nom, entreprise, email, telephone, ville, communes, horaires")
        .single();
      if (!data) return;
      const pl = data as Plombier;
      setP(pl);
      const s: Record<string, Journee> = {};
      for (const [cle] of JOURS) s[cle] = lire(pl.horaires?.[cle]);
      setSemaine(s);
      setCommunes((pl.communes ?? []).join(", "));
    })();
  }, []);

  function maj(cle: string, champ: keyof Journee, valeur: string | boolean) {
    setSemaine((s) => ({ ...s, [cle]: { ...s[cle], [champ]: valeur } }));
    setModifie(true);
  }

  /** Applique les horaires d'un jour à tous les autres jours actifs. */
  function propager(source: string) {
    const modele = semaine[source];
    setSemaine((s) => {
      const copie = { ...s };
      for (const [cle] of JOURS) {
        if (cle !== source && copie[cle].actif) {
          copie[cle] = { ...modele, actif: true };
        }
      }
      return copie;
    });
    setModifie(true);
  }

  async function enregistrer() {
    if (!p) return;
    setEtat("en_cours");

    const horaires: Record<string, string> = {};
    for (const [cle] of JOURS) {
      const v = ecrire(semaine[cle]);
      if (v) horaires[cle] = v;
    }

    const { error } = await sb
      .from("plombiers")
      .update({
        horaires,
        communes: communes.split(",").map((c) => c.trim()).filter(Boolean),
      })
      .eq("id", p.id);

    setEtat(error ? "erreur" : "ok");
    if (!error) {
      setModifie(false);
      setTimeout(() => setEtat(""), 2500);
    }
  }

  if (!p) return <main className="page" />;

  const heuresParSemaine = JOURS.reduce((total, [cle]) => {
    const j = semaine[cle];
    if (!j?.actif) return total;
    const mn = (a: string, b: string) => {
      const [ha, ma] = a.split(":").map(Number);
      const [hb, mb] = b.split(":").map(Number);
      return (hb * 60 + mb) - (ha * 60 + ma);
    };
    return total + (j.coupure
      ? mn(j.debut, j.pause) + mn(j.reprise, j.fin)
      : mn(j.debut, j.fin));
  }, 0);

  return (
    <main className="page">
      <h1>Réglages</h1>
      <p className="sous-titre">
        Ces réglages pilotent l'assistant. Il ne proposera jamais un
        créneau hors de ces horaires, ni une intervention hors de votre
        secteur.
      </p>

      <h2>Vos horaires</h2>
      <div className="bloc" style={{ padding: ".5rem" }}>
        {JOURS.map(([cle, libelle]) => {
          const j = semaine[cle] ?? JOURNEE_DEFAUT;
          return (
            <div key={cle} className="jour" data-actif={j.actif}>
              <div className="jour-haut">
                <label className="bascule">
                  <input type="checkbox" checked={j.actif}
                         onChange={(e) => maj(cle, "actif", e.target.checked)} />
                  <span className="bascule-piste"><span className="bascule-pion" /></span>
                  <span className="jour-nom">{libelle}</span>
                </label>
                {!j.actif && <span className="jour-repos">Repos</span>}
              </div>

              {j.actif && (
                <>
                  <div className="tranches">
                    <Plage a={j.debut} b={j.coupure ? j.pause : j.fin}
                           surA={(v) => maj(cle, "debut", v)}
                           surB={(v) => maj(cle, j.coupure ? "pause" : "fin", v)} />
                    {j.coupure && (
                      <Plage a={j.reprise} b={j.fin}
                             surA={(v) => maj(cle, "reprise", v)}
                             surB={(v) => maj(cle, "fin", v)} />
                    )}
                  </div>

                  <div className="jour-bas">
                    <button type="button"
                            onClick={() => maj(cle, "coupure", !j.coupure)}>
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

        <p className="discret" style={{ padding: "0 .75rem .5rem" }}>
          {Math.round(heuresParSemaine / 60)} heures ouvrées par semaine.
        </p>
      </div>

      <h2>Secteur d'intervention</h2>
      <div className="bloc">
        <textarea
          className="saisie"
          style={{ minHeight: "6.5rem", padding: ".75rem", lineHeight: 1.7 }}
          value={communes}
          onChange={(e) => { setCommunes(e.target.value); setModifie(true); }}
          placeholder="Angers, Avrillé, Beaucouzé"
        />
        <p className="discret">
          Les communes où vous vous déplacez, séparées par des virgules.
          Une demande venant d'ailleurs ne donnera pas de rendez-vous :
          l'assistant prendra un message et vous rappellerez.
        </p>
      </div>

      <h2>Votre entreprise</h2>
      <div className="bloc">
        <div className="champ">
          <div className="champ-nom">Nom</div>
          <div className="champ-valeur">{p.nom} — {p.entreprise}</div>
        </div>
        <div className="champ">
          <div className="champ-nom">Adresse e-mail</div>
          <div className="champ-valeur">{p.email}</div>
        </div>
        <div className="champ">
          <div className="champ-nom">Téléphone de transfert</div>
          <div className="champ-valeur">{p.telephone}</div>
        </div>
      </div>

      {/* Barre d'enregistrement, visible seulement s'il y a de quoi
          enregistrer : pas de bouton inerte en permanence. */}
      {(modifie || etat) && (
        <div className="barre-enregistrer">
          <span className="discret">
            {etat === "ok" ? "Modifications enregistrées"
              : etat === "erreur" ? "Échec de l'enregistrement"
              : "Modifications non enregistrées"}
          </span>
          <button className="bouton" data-style="plein" onClick={enregistrer}
                  disabled={etat === "en_cours"}>
            {etat === "en_cours" ? "…" : "Enregistrer"}
          </button>
        </div>
      )}
    </main>
  );
}

function Plage({ a, b, surA, surB }: {
  a: string; b: string;
  surA: (v: string) => void; surB: (v: string) => void;
}) {
  return (
    <div className="tranche">
      <input type="time" value={a} step={900} onChange={(e) => surA(e.target.value)} />
      <span>→</span>
      <input type="time" value={b} step={900} onChange={(e) => surB(e.target.value)} />
    </div>
  );
}
