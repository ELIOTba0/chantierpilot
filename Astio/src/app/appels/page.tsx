"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { filtersFromParams } from "@/lib/call-filters";
import { CallsWorkspace } from "@/components/calls/calls-workspace";

/**
 * Les liens profonds (tableau de bord, notifications) initialisent les filtres.
 * La clé remonte l'espace de travail quand ces paramètres changent, mais pas
 * quand seul le dossier ouvert (?appel=) change.
 */
function CallsRoute() {
  const params = useSearchParams();
  const presets = new URLSearchParams(params.toString());
  presets.delete("appel");
  const key = presets.toString();
  return <CallsWorkspace key={key} initialFilters={filtersFromParams(presets)} />;
}

export default function CallsPage() {
  return (
    <Suspense>
      <CallsRoute />
    </Suspense>
  );
}
