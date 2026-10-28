"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { useAppState } from "@/lib/store";
import { useNow } from "@/lib/use-now";
import { AppProvider } from "@/lib/app-context";
import { Toaster } from "@/components/ui/toast";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

export function AppShell({ children }: { children: ReactNode }) {
  const state = useAppState();
  const now = useNow();
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();

  // Bloque le défilement de la page quand le menu mobile est ouvert.
  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
  }, [menuOpen]);

  if (!state || now === null) return <ShellSkeleton />;

  return (
    <AppProvider value={{ state, now }}>
      <a
        href="#contenu"
        className="sr-only z-50 rounded-md bg-surface px-3 py-2 text-sm focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Aller au contenu
      </a>
      <div className="flex min-h-dvh">
        <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-line bg-surface lg:block">
          <Sidebar state={state} />
        </aside>

        {menuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
            <button
              type="button"
              aria-label="Fermer le menu"
              className="absolute inset-0 bg-ink/30"
              onClick={() => setMenuOpen(false)}
            />
            <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-surface shadow-(--shadow-pop)">
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                className="absolute top-4 right-3 rounded-lg p-1.5 text-ink-muted hover:bg-stone-100"
                aria-label="Fermer le menu"
              >
                <X className="size-5" />
              </button>
              <Sidebar state={state} onNavigate={() => setMenuOpen(false)} />
            </div>
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col lg:pl-64">
          <Topbar state={state} now={now} onOpenMenu={() => setMenuOpen(true)} />
          <main id="contenu" key={pathname} className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            {children}
          </main>
        </div>
      </div>
      <Toaster />
    </AppProvider>
  );
}

function ShellSkeleton() {
  return (
    <div className="flex min-h-dvh" aria-busy="true" aria-label="Chargement d'Astio">
      <div className="hidden w-64 border-r border-line bg-surface lg:block" />
      <div className="flex-1">
        <div className="h-16 border-b border-line bg-surface" />
        <div className="space-y-4 p-8">
          <div className="h-6 w-64 animate-pulse rounded bg-stone-200/70" />
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-28 animate-pulse rounded-xl bg-stone-200/50" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
