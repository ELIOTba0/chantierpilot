"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { sb } from "@/lib/supabase-browser";
import { chargerSession, type Session } from "@/lib/donnees";

/**
 * Renvoie vers la connexion si aucune session, et vers le bon espace
 * selon le rôle : un administrateur n'a rien à faire dans l'espace
 * plombier, et inversement.
 *
 * Ce n'est qu'un confort d'affichage : la vraie protection est en
 * base. Le RLS et les fonctions SQL refusent les données d'une autre
 * entreprise et les actions d'administration à qui n'est pas admin,
 * même si quelqu'un force l'adresse d'une page.
 */

const ContexteSession = createContext<Session | null>(null);

export function useSession(): Session {
  const s = useContext(ContexteSession);
  if (!s) throw new Error("useSession hors de <Garde>");
  return s;
}

export type Espace = "plombier" | "admin";

export const ACCUEIL: Record<Espace, string> = {
  plombier: "/demandes",
  admin: "/admin",
};

export default function Garde({
  children, espace = "plombier",
}: { children: React.ReactNode; espace?: Espace }) {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [refus, setRefus] = useState<string>("");

  useEffect(() => {
    let vivant = true;

    (async () => {
      const { data } = await sb.auth.getSession();
      if (!data.session) { router.replace("/"); return; }
      try {
        const s = await chargerSession();
        if (!vivant) return;
        if (s.role === "admin" && espace !== "admin") { router.replace(ACCUEIL.admin); return; }
        if (s.role === "user" && espace !== "plombier") { router.replace(ACCUEIL.plombier); return; }
        if (!s.role) {
          setRefus(s.email ?? "");
          return;
        }
        setSession(s);
      } catch {
        if (vivant) setRefus("?");
      }
    })();

    const { data: sub } = sb.auth.onAuthStateChange((_e, s) => {
      if (!s) router.replace("/");
    });
    return () => { vivant = false; sub.subscription.unsubscribe(); };
  }, [router, espace]);

  if (refus) return <CompteNonRattache email={refus} />;
  if (!session) return <div className="chargement-page" aria-busy="true">Chargement…</div>;

  return (
    <ContexteSession.Provider value={session}>
      <div className="cadre" data-espace={espace}>{children}</div>
    </ContexteSession.Provider>
  );
}

function CompteNonRattache({ email }: { email: string }) {
  const router = useRouter();
  return (
    <main className="connexion">
      <div className="connexion-boite">
        <div className="marque" style={{ marginBottom: "1.5rem" }}>ChantierPilot</div>
        <h1>Compte sans accès</h1>
        <p className="sous-titre">
          {email && email !== "?"
            ? <>Le compte <strong>{email}</strong> n&apos;est</>
            : <>Ce compte n&apos;est</>}{" "}
          rattaché à aucune entreprise ni à l&apos;équipe ChantierPilot, ou son accès a été
          désactivé. Contactez l&apos;équipe ChantierPilot pour qu&apos;elle l&apos;ajoute.
        </p>
        <button className="bouton" onClick={async () => { await sb.auth.signOut(); router.replace("/"); }}>
          Changer de compte
        </button>
      </div>
    </main>
  );
}
