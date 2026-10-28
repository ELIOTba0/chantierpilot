"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { sb } from "@/lib/supabase-browser";

/**
 * En-tête sur ordinateur, barre du bas sur téléphone.
 *
 * Le plombier consulte presque toujours depuis sa camionnette : la
 * navigation doit tomber sous le pouce, pas en haut de l'écran.
 */

const ONGLETS = [
  { href: "/demandes", libelle: "Aujourd'hui" },
  { href: "/agenda", libelle: "Planning" },
  { href: "/reglages", libelle: "Réglages" },
];

function Icone({ nom }: { nom: string }) {
  if (nom === "/demandes") {
    return (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <rect x="3" y="4" width="14" height="13" rx="2.5" stroke="currentColor" strokeWidth="1.7" />
        <path d="M3 8h14M7 2.5v3M13 2.5v3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    );
  }
  if (nom === "/agenda") {
    return (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <rect x="3" y="3.5" width="14" height="13" rx="2.5" stroke="currentColor" strokeWidth="1.7" />
        <path d="M7.7 3.5v13M12.3 3.5v13" stroke="currentColor" strokeWidth="1.7" />
      </svg>
    );
  }
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="10" cy="10" r="2.6" stroke="currentColor" strokeWidth="1.7" />
      <path d="M10 2.6v2M10 15.4v2M17.4 10h-2M4.6 10h-2M15.2 4.8l-1.4 1.4M6.2 13.8l-1.4 1.4M15.2 15.2l-1.4-1.4M6.2 6.2 4.8 4.8"
            stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export default function Entete() {
  const chemin = usePathname() ?? "";
  const router = useRouter();

  async function deconnexion() {
    await sb.auth.signOut();
    router.replace("/");
  }

  const actif = (href: string) => chemin.startsWith(href);

  return (
    <>
      <header className="entete">
        <div className="entete-haut">
          <Link href="/demandes" className="marque">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path d="M3 13.5 L8 8.5 L11.5 12 L17 6" stroke="var(--accent)"
                    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            ChantierPilot
          </Link>

          <nav className="onglets">
            {ONGLETS.map((o) => (
              <Link key={o.href} href={o.href} className="onglet" data-actif={actif(o.href)}>
                {o.libelle}
              </Link>
            ))}
          </nav>

          <div className="entete-fin">
            <span className="etat-ligne">Assistant en ligne</span>
            <button onClick={deconnexion} className="discret"
                    style={{ background: "none", border: 0, cursor: "pointer", minHeight: 44 }}>
              Quitter
            </button>
          </div>
        </div>
      </header>

      <nav className="barre-basse" aria-label="Navigation principale">
        {ONGLETS.map((o) => (
          <Link key={o.href} href={o.href} data-actif={actif(o.href)}>
            <Icone nom={o.href} />
            {o.libelle}
          </Link>
        ))}
      </nav>
    </>
  );
}
