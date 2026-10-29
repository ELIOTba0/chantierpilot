import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  // Le gabarit évite de réécrire le nom sur chaque page.
  title: {
    default: "ChantierPilot",
    template: "%s · ChantierPilot",
  },
  description:
    "Les demandes prises par votre assistant pendant que vous êtes en intervention.",
  applicationName: "ChantierPilot",
  // Pas d'indexation : l'espace est privé, il n'a rien à faire dans
  // les moteurs de recherche.
  robots: { index: false, follow: false },
  formatDetection: { telephone: true },
  appleWebApp: {
    capable: true,
    title: "ChantierPilot",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // L'écran se consulte souvent à bout de bras, en extérieur.
  maximumScale: 5,
  // Ces valeurs colorent la barre d'adresse sur téléphone : elles
  // doivent être exactement le fond de la feuille de style, sinon
  // une bande d'une autre couleur apparaît en haut de l'écran.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FAFAF8" },
    { media: "(prefers-color-scheme: dark)", color: "#121716" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
