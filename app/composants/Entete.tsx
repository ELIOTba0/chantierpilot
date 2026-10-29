"use client";

import { useEffect, useState } from "react";
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
  { href: "/demandes", libelle: "Aujourd'hui", exact: true },
  { href: "/agenda", libelle: "Planning", exact: false },
  { href: "/demandes/toutes", libelle: "Demandes", exact: false },
  { href: "/reglages", libelle: "Réglages", exact: false },
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
  if (nom === "/demandes/toutes") {
    return (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path d="M4 5.5h12M4 10h12M4 14.5h8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
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

type Entreprise = { id: string; nom: string };

export default function Entete() {
  const chemin = usePathname() ?? "";
  const router = useRouter();

  // Un membre de l'équipe ChantierPilot consulte l'entreprise de son
  // choix ; un artisan n'a pas ce sélecteur et ne sait même pas
  // qu'il existe — la table administrateurs ne lui est pas lisible.
  const [entreprises, setEntreprises] = useState<Entreprise[] | null>(null);
  const [active, setActive] = useState<string>("");
  const [ficheAdmin, setFicheAdmin] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: moi } = await sb
        .from("administrateurs")
        .select("id, entreprise_active")
        .maybeSingle();
      if (!moi) return;                       // artisan : rien à afficher
      setFicheAdmin(moi.id);
      setActive(moi.entreprise_active ?? "");

      const { data: liste } = await sb
        .from("entreprises")
        .select("id, nom")
        .order("nom");
      setEntreprises((liste as Entreprise[]) ?? []);
    })();
  }, []);

  async function changerEntreprise(id: string) {
    if (!ficheAdmin) return;
    setActive(id);
    const { error } = await sb
      .from("administrateurs")
      .update({ entreprise_active: id })
      .eq("id", ficheAdmin);
    if (!error) {
      // Tout l'écran dépend de ce contexte : on recharge plutôt que
      // de rafraîchir chaque page à la main.
      window.location.reload();
    }
  }

  async function deconnexion() {
    await sb.auth.signOut();
    router.replace("/");
  }

  // « Aujourd'hui » vit à /demandes et la liste à /demandes/toutes :
  // sans correspondance exacte, les deux s'allumeraient ensemble.
  const actif = (o: { href: string; exact: boolean }) =>
    o.exact ? chemin === o.href : chemin.startsWith(o.href);

  // Le titre de l'onglet suit la page. Les écrans étant des
  // composants client, ils ne peuvent pas exporter de métadonnées :
  // l'en-tête, qui connaît déjà la route, s'en charge pour tous.
  useEffect(() => {
    const page = ONGLETS.find((o) => actif(o));
    const nom = chemin.startsWith("/demandes/") && !chemin.endsWith("/toutes")
      ? "Intervention"
      : chemin.startsWith("/rendez-vous")
      ? "Nouveau rendez-vous"
      : page?.libelle;
    document.title = nom ? `${nom} · ChantierPilot` : "ChantierPilot";
  }, [chemin]);

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
              <Link key={o.href} href={o.href} className="onglet" data-actif={actif(o)}>
                {o.libelle}
              </Link>
            ))}
          </nav>

          <div className="entete-fin">
            {entreprises && entreprises.length > 0 && (
              <label style={{ display: "inline-flex", alignItems: "center", gap: ".5rem",
                              fontSize: ".8125rem", color: "var(--ink-2)" }}>
                <span style={{ whiteSpace: "nowrap" }}>Client</span>
                <select value={active}
                        onChange={(e) => changerEntreprise(e.target.value)}
                        style={{ minHeight: 40, width: "auto", minWidth: "11rem",
                                 padding: "0 .5rem", fontSize: ".875rem" }}>
                  {entreprises.map((e) => (
                    <option key={e.id} value={e.id}>{e.nom}</option>
                  ))}
                </select>
              </label>
            )}
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
          <Link key={o.href} href={o.href} data-actif={actif(o)}>
            <Icone nom={o.href} />
            {o.libelle}
          </Link>
        ))}
      </nav>
    </>
  );
}
