"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { sb } from "@/lib/supabase-browser";
import { chargerSession } from "@/lib/donnees";

/** Après connexion : l'administrateur vers l'administration, le plombier vers sa journée. */
async function espaceDuCompte(): Promise<string> {
  try {
    const s = await chargerSession();
    return s.role === "admin" ? "/admin" : "/demandes";
  } catch {
    return "/demandes";
  }
}

/**
 * Connexion par code à six chiffres reçu par e-mail.
 *
 * Pas de mot de passe : un artisan en oubliera un, et il ne verra cet
 * écran qu'une fois, le jour de l'installation. Un code se tape d'une
 * main sans quitter l'application — un lien obligerait à passer par la
 * boîte mail, puis à revenir.
 */
export default function Connexion() {
  const router = useRouter();
  const [etape, setEtape] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [erreur, setErreur] = useState("");
  const [occupe, setOccupe] = useState(false);
  const champCode = useRef<HTMLInputElement>(null);
  // Un code ne sert qu'une fois. Sans ce verrou, la validation
  // automatique au sixième chiffre et la touche Entrée déclenchent
  // deux vérifications : la première consomme le code, la seconde
  // échoue, et c'est son erreur que l'utilisateur voit.
  const enCours = useRef(false);

  useEffect(() => {
    sb.auth.getSession().then(({ data }) => {
      if (data.session) espaceDuCompte().then((v) => router.replace(v));
    });
  }, [router]);

  useEffect(() => {
    if (etape === "code") champCode.current?.focus();
  }, [etape]);

  async function envoyerCode(e: React.FormEvent) {
    e.preventDefault();
    setErreur("");
    setOccupe(true);
    const { error } = await sb.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { shouldCreateUser: true },
    });
    setOccupe(false);
    if (error) {
      setErreur(
        error.message.toLowerCase().includes("rate")
          ? "Trop de demandes. Patientez une minute."
          : "Envoi impossible. Vérifiez l'adresse."
      );
    } else {
      setEtape("code");
    }
  }

  async function verifier(valeur: string) {
    if (enCours.current) return;
    enCours.current = true;
    setErreur("");
    setOccupe(true);

    // Supabase n'utilise pas le même type selon que le compte existe
    // déjà ou vient d'être créé : « email » pour une connexion,
    // « signup » pour une première inscription. On essaie les deux
    // plutôt que de demander à l'artisan de savoir lequel s'applique.
    const adresse = email.trim().toLowerCase();
    let ok = false;

    for (const type of ["email", "signup"] as const) {
      const { error } = await sb.auth.verifyOtp({
        email: adresse,
        token: valeur,
        type,
      });
      if (!error) { ok = true; break; }
    }

    setOccupe(false);
    if (ok) {
      // On garde le verrou : la page va changer.
      router.replace(await espaceDuCompte());
    } else {
      enCours.current = false;
      setErreur("Code incorrect ou expiré. Demandez-en un nouveau.");
      setCode("");
      champCode.current?.focus();
    }
  }

  function saisirCode(valeur: string) {
    const chiffres = valeur.replace(/\D/g, "").slice(0, 6);
    setCode(chiffres);
    // Six chiffres saisis : on valide sans attendre un clic.
    if (chiffres.length === 6) verifier(chiffres);
  }

  return (
    <main className="connexion">
      <div className="connexion-boite">
        <div className="marque" style={{ marginBottom: "2.5rem" }}>
          Chantier<span>Pilot</span>
        </div>

        {etape === "email" ? (
          <form onSubmit={envoyerCode}>
            <h1>Votre espace</h1>
            <p className="sous-titre">
              Entrez votre adresse e-mail. Vous recevrez un code à six
              chiffres — pas de mot de passe à retenir.
            </p>
            <input
              className="saisie"
              type="email"
              inputMode="email"
              autoComplete="email"
              autoFocus
              required
              placeholder="vous@exemple.fr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <button className="bouton" data-style="plein" disabled={occupe}
                    style={{ width: "100%" }}>
              {occupe ? "Envoi…" : "Recevoir le code"}
            </button>
            {erreur && <p className="erreur">{erreur}</p>}
          </form>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); verifier(code); }}>
            <h1>Votre code</h1>
            <p className="sous-titre">
              Envoyé à {email}. Valable dix minutes.
            </p>
            <input
              ref={champCode}
              className="saisie code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              maxLength={6}
              placeholder="······"
              value={code}
              onChange={(e) => saisirCode(e.target.value)}
              disabled={occupe}
            />
            {erreur && <p className="erreur">{erreur}</p>}
            <button type="button" className="retour"
                    onClick={() => {
                      enCours.current = false;
                      setEtape("email"); setCode(""); setErreur("");
                    }}
                    style={{ background: "none", border: 0, cursor: "pointer" }}>
              ← Changer d'adresse
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
