"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { sb } from "@/lib/supabase-browser";

/**
 * Connexion.
 *
 * Deux voies, et ce n'est pas un luxe : le mot de passe sert à
 * l'équipe, qui se connecte dix fois par jour ; le code par courriel
 * servira au plombier, qui se connecte deux fois par mois et ne
 * retiendra aucun mot de passe.
 */

type Vue = "motdepasse" | "demande_code" | "saisie_code";

export default function Connexion() {
  const router = useRouter();
  const [vue, setVue] = useState<Vue>("motdepasse");
  const [adresse, setAdresse] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [code, setCode] = useState("");
  const [erreur, setErreur] = useState("");
  const [occupe, setOccupe] = useState(false);
  const enCours = useRef(false);

  async function parMotDePasse(e: React.FormEvent) {
    e.preventDefault();
    setErreur("");
    setOccupe(true);
    const { error } = await sb.auth.signInWithPassword({
      email: adresse.trim(),
      password: motDePasse,
    });
    setOccupe(false);
    if (error) {
      setErreur("Adresse ou mot de passe incorrect.");
      return;
    }
    router.replace("/demandes");
  }

  async function demanderCode(e: React.FormEvent) {
    e.preventDefault();
    setErreur("");
    setOccupe(true);
    const { error } = await sb.auth.signInWithOtp({ email: adresse.trim() });
    setOccupe(false);
    if (error) {
      setErreur(
        error.message.toLowerCase().includes("rate")
          ? "Trop de demandes. Attendez quelques minutes."
          : "Envoi impossible. Vérifiez l'adresse."
      );
      return;
    }
    setVue("saisie_code");
  }

  async function verifierCode(valeur: string) {
    // Supabase n'utilise pas le même type selon que le compte existe
    // déjà ou vient d'être créé : « email » pour une connexion,
    // « signup » pour une première inscription.
    if (enCours.current) return;
    enCours.current = true;
    setErreur("");
    setOccupe(true);

    let ok = false;
    for (const type of ["email", "signup"] as const) {
      const { error } = await sb.auth.verifyOtp({
        email: adresse.trim(), token: valeur, type,
      });
      if (!error) { ok = true; break; }
    }

    setOccupe(false);
    enCours.current = false;

    if (!ok) {
      setErreur("Code incorrect ou expiré. Demandez-en un nouveau.");
      return;
    }
    router.replace("/demandes");
  }

  return (
    <main className="connexion">
      <div className="connexion-boite">
        <div className="marque" style={{ marginBottom: "1.5rem" }}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="M3 13.5 L8 8.5 L11.5 12 L17 6" stroke="var(--accent)"
                  strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          ChantierPilot
        </div>

        {vue === "motdepasse" && (
          <>
            <h1>Votre espace</h1>
            <p className="sous-titre">
              Les demandes prises par votre assistant pendant que vous êtes
              en intervention.
            </p>
            <form onSubmit={parMotDePasse}>
              <label htmlFor="adr" style={{ fontSize: ".875rem", fontWeight: 500 }}>
                Adresse e-mail
              </label>
              <input id="adr" type="email" autoComplete="username" required
                     value={adresse} onChange={(e) => setAdresse(e.target.value)}
                     placeholder="vous@exemple.fr" />

              <label htmlFor="mdp" style={{ fontSize: ".875rem", fontWeight: 500,
                                            marginTop: ".5rem" }}>
                Mot de passe
              </label>
              <input id="mdp" type="password" autoComplete="current-password" required
                     value={motDePasse} onChange={(e) => setMotDePasse(e.target.value)} />

              <button type="submit" className="bouton" data-style="plein"
                      data-pleine-largeur="true" disabled={occupe}>
                {occupe ? "…" : "Entrer"}
              </button>
            </form>

            {erreur && <p className="erreur" style={{ marginTop: ".75rem" }}>{erreur}</p>}

            <button type="button" onClick={() => { setVue("demande_code"); setErreur(""); }}
                    style={{ background: "none", border: 0, padding: ".875rem 0 0",
                             minHeight: 44, cursor: "pointer", fontFamily: "inherit",
                             fontSize: ".875rem", color: "var(--ink-2)" }}>
              Recevoir plutôt un code par e-mail
            </button>
          </>
        )}

        {vue === "demande_code" && (
          <>
            <h1>Code par e-mail</h1>
            <p className="sous-titre">
              Entrez votre adresse. Vous recevrez de quoi vous connecter,
              sans mot de passe à retenir.
            </p>
            <form onSubmit={demanderCode}>
              <input type="email" autoComplete="username" required
                     value={adresse} onChange={(e) => setAdresse(e.target.value)}
                     placeholder="vous@exemple.fr" />
              <button type="submit" className="bouton" data-style="plein"
                      data-pleine-largeur="true" disabled={occupe}>
                {occupe ? "…" : "Recevoir le code"}
              </button>
            </form>

            {erreur && <p className="erreur" style={{ marginTop: ".75rem" }}>{erreur}</p>}

            <button type="button" onClick={() => { setVue("motdepasse"); setErreur(""); }}
                    style={{ background: "none", border: 0, padding: ".875rem 0 0",
                             minHeight: 44, cursor: "pointer", fontFamily: "inherit",
                             fontSize: ".875rem", color: "var(--ink-2)" }}>
              ← Utiliser mon mot de passe
            </button>
          </>
        )}

        {vue === "saisie_code" && (
          <>
            <h1>Votre code</h1>
            <p className="sous-titre">
              Envoyé à {adresse}. Si le message contient un lien plutôt
              qu&apos;un code, cliquez dessus : il vaut connexion.
            </p>
            <input
              className="champ-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              placeholder="······"
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, "").slice(0, 6);
                setCode(v);
                if (v.length === 6) verifierCode(v);
              }}
            />

            {erreur && <p className="erreur" style={{ marginTop: ".75rem" }}>{erreur}</p>}

            <button type="button"
                    onClick={() => { setVue("demande_code"); setCode(""); setErreur(""); }}
                    style={{ background: "none", border: 0, padding: ".875rem 0 0",
                             minHeight: 44, cursor: "pointer", fontFamily: "inherit",
                             fontSize: ".875rem", color: "var(--ink-2)" }}>
              ← Changer d&apos;adresse
            </button>
          </>
        )}
      </div>
    </main>
  );
}
