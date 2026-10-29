"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { sb } from "@/lib/supabase-browser";
import { useSession, type Espace } from "./Garde";

/**
 * Navigation : barre latérale sur ordinateur, barre du bas sur
 * téléphone, et un bandeau qui rappelle quel compte est connecté.
 *
 * Le plombier consulte presque toujours depuis sa camionnette : sur
 * téléphone, la navigation doit tomber sous le pouce, pas en haut de
 * l'écran.
 */

type Onglet = { href: string; libelle: string; court: string; icone: string; aussi?: string[] };

const ONGLETS: Record<Espace, Onglet[]> = {
  plombier: [
    { href: "/demandes", libelle: "Vue d'ensemble", court: "Accueil", icone: "accueil" },
    { href: "/appels", libelle: "Appels", court: "Appels", icone: "appel" },
    { href: "/rappels", libelle: "À rappeler", court: "Rappels", icone: "rappel" },
    { href: "/rendez-vous", libelle: "Rendez-vous", court: "RDV", icone: "agenda",
      aussi: ["/agenda"] },
    { href: "/reglages", libelle: "Réglages", court: "Réglages", icone: "reglages" },
  ],
  admin: [
    { href: "/admin", libelle: "Vue d'ensemble", court: "Accueil", icone: "accueil" },
    { href: "/admin/entreprises", libelle: "Entreprises", court: "Clients", icone: "entreprise" },
    { href: "/admin/appels", libelle: "Appels", court: "Appels", icone: "appel" },
    { href: "/admin/rappels", libelle: "Rappels", court: "Rappels", icone: "rappel" },
    { href: "/admin/rendez-vous", libelle: "Rendez-vous", court: "RDV", icone: "agenda" },
    { href: "/admin/comptes", libelle: "Comptes et accès", court: "Comptes", icone: "comptes" },
  ],
};

const TRACES: Record<string, React.ReactNode> = {
  accueil: <path d="M3.5 9 10 3.5 16.5 9v7a1 1 0 0 1-1 1h-3.5v-5h-4v5H4.5a1 1 0 0 1-1-1Z" />,
  appel: <path d="M5.2 3.2h2.6l1.3 3.4-1.7 1.1a8.6 8.6 0 0 0 4.9 4.9l1.1-1.7 3.4 1.3v2.6a1.7 1.7 0 0 1-1.8 1.7A13.5 13.5 0 0 1 3.5 5a1.7 1.7 0 0 1 1.7-1.8Z" />,
  rappel: <><path d="M5.2 3.2h2.6l1.3 3.4-1.7 1.1a8.6 8.6 0 0 0 4.9 4.9l1.1-1.7 3.4 1.3v2.6a1.7 1.7 0 0 1-1.8 1.7A13.5 13.5 0 0 1 3.5 5a1.7 1.7 0 0 1 1.7-1.8Z" /><path d="M12.5 3v4.5H17M12.5 7.5 17 3" /></>,
  agenda: <><rect x="3" y="4" width="14" height="13" rx="2.5" /><path d="M3 8h14M7 2.5v3M13 2.5v3" /></>,
  reglages: <><circle cx="10" cy="10" r="2.6" /><path d="M10 2.6v2M10 15.4v2M17.4 10h-2M4.6 10h-2M15.2 4.8l-1.4 1.4M6.2 13.8l-1.4 1.4M15.2 15.2l-1.4-1.4M6.2 6.2 4.8 4.8" /></>,
  entreprise: <><path d="M4 17V5.5L10 3v14M10 7.5h6V17" /><path d="M2.5 17h15M6.5 7.5h1M6.5 10.5h1M6.5 13.5h1M12.5 10.5h1M12.5 13.5h1" /></>,
  comptes: <><circle cx="7.5" cy="7" r="2.8" /><path d="M2.5 16.5c.6-2.8 2.6-4.3 5-4.3s4.4 1.5 5 4.3M13 4.5a2.6 2.6 0 0 1 0 5M14.5 12.5c1.6.5 2.6 1.9 3 4" /></>,
};

function Icone({ nom }: { nom: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true"
         stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      {TRACES[nom]}
    </svg>
  );
}

function Marque() {
  return (
    <>
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path d="M3 13.5 L8 8.5 L11.5 12 L17 6" stroke="var(--accent)"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      ChantierPilot
    </>
  );
}

export default function Entete() {
  const chemin = usePathname() ?? "";
  const router = useRouter();
  const session = useSession();
  const espace: Espace = session.role === "admin" ? "admin" : "plombier";
  const onglets = ONGLETS[espace];

  async function deconnexion() {
    await sb.auth.signOut();
    router.replace("/");
  }

  // L'onglet le plus spécifique gagne : /admin ne doit pas rester
  // allumé sur /admin/entreprises.
  const actif = (o: Onglet) => {
    const correspond = (h: string) => chemin === h || chemin.startsWith(h + "/");
    if (![o.href, ...(o.aussi ?? [])].some(correspond)) return false;
    return !onglets.some((x) => x !== o && x.href.length > o.href.length && correspond(x.href));
  };

  const qui = session.admin?.nom ?? session.plombier?.nom ?? session.email ?? "";
  const contexte = espace === "admin"
    ? "Équipe ChantierPilot"
    : session.entreprise?.nom ?? "";

  return (
    <>
      <aside className="barre-laterale" aria-label="Navigation principale">
        <Link href={onglets[0].href} className="marque"><Marque /></Link>
        {espace === "admin" && <span className="etiquette-espace">Administration</span>}

        <nav className="laterale-liens">
          {onglets.map((o) => (
            <Link key={o.href} href={o.href} className="laterale-lien"
                  data-actif={actif(o)} aria-current={actif(o) ? "page" : undefined}>
              <Icone nom={o.icone} />
              {o.libelle}
            </Link>
          ))}
        </nav>
      </aside>

      <header className="barre-haut">
        <Link href={onglets[0].href} className="marque barre-haut-marque"><Marque /></Link>
        <div className="compte">
          <div className="compte-texte">
            <span className="compte-nom">{qui}</span>
            <span className="compte-contexte">
              {contexte}
              {session.entreprise?.demo && <span className="puce" data-ton="attenue" data-sans-point="true">Démo</span>}
            </span>
          </div>
          <span className="puce" data-ton={espace === "admin" ? "accent" : "neutre"} data-sans-point="true">
            {espace === "admin" ? "Admin" : "Plombier"}
          </span>
          <button onClick={deconnexion} className="bouton" data-style="nu" data-taille="petit">
            Se déconnecter
          </button>
        </div>
      </header>

      <nav className="barre-basse" aria-label="Navigation principale">
        {onglets.map((o) => (
          <Link key={o.href} href={o.href} data-actif={actif(o)}
                aria-current={actif(o) ? "page" : undefined}>
            <Icone nom={o.icone} />
            {o.court}
          </Link>
        ))}
      </nav>
    </>
  );
}
