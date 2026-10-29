"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarCheck2, Search, UserX } from "lucide-react";
import { formatAgo, formatDayTime, formatPhone } from "@/lib/format";
import { normalize } from "@/lib/search";
import { useAstio } from "@/lib/app-context";
import { clientSummaries } from "@/lib/selectors";
import { cn } from "@/lib/cn";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { ClientPanel } from "./client-panel";

/** Page Clients : recherche, liste et fiche latérale synchronisée avec l'URL (?client=…). */
export function ClientsWorkspace() {
  const { state, now } = useAstio();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [query, setQuery] = useState("");
  const selectedId = params.get("client");

  const all = clientSummaries(state, now);
  const q = normalize(query.trim());
  const digits = query.replace(/\D/g, "");
  const rows = all.filter(
    (r) =>
      !q ||
      normalize(`${r.client.name} ${r.client.address ?? ""} ${r.client.zone ?? ""}`).includes(q) ||
      (digits.length >= 2 && r.client.phone.includes(digits)),
  );
  const selected = all.find((r) => r.client.id === selectedId);

  const select = (id: string | null) => {
    router.replace(id ? `${pathname}?client=${id}` : pathname, { scroll: false });
  };

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-0 flex-1 basis-60 sm:max-w-sm">
          <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Nom, téléphone ou adresse"
            aria-label="Rechercher un client par nom, téléphone ou adresse"
            className="h-9 w-full rounded-lg border border-transparent bg-black/[0.05] pr-3 pl-9 text-sm placeholder:text-ink-muted focus:border-brand-500 focus:bg-surface focus:outline-none"
          />
        </div>
        <p className="ml-auto text-xs text-ink-muted" aria-live="polite">
          {rows.length === all.length ? `${all.length} clients` : `${rows.length} sur ${all.length} clients`}
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl bg-surface shadow-(--shadow-card)">
        {rows.length === 0 ? (
          <EmptyState
            icon={<UserX className="size-5" />}
            title="Aucun client trouvé"
            description="Vérifiez l'orthographe ou le numéro saisi."
            action={
              <Button size="sm" onClick={() => setQuery("")}>
                Effacer la recherche
              </Button>
            }
          />
        ) : (
          <>
            <table className="hidden w-full text-left text-sm md:table">
              <thead className="border-b border-line bg-canvas text-xs text-ink-muted">
                <tr>
                  <th scope="col" className="px-4 py-2.5 font-medium">Client</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Téléphone</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Appels</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Rendez-vous</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Dernière interaction</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map(({ client, calls, appointments, upcoming, lastInteraction }) => (
                  <tr
                    key={client.id}
                    onClick={() => select(client.id)}
                    className={cn("cursor-pointer hover:bg-stone-50", client.id === selectedId && "bg-brand-50/60")}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={client.name} />
                        <div className="min-w-0">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              select(client.id);
                            }}
                            className="font-medium text-ink hover:underline"
                          >
                            {client.name}
                          </button>
                          <p className="max-w-64 truncate text-xs text-ink-muted">{client.address ?? "Adresse non communiquée"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-ink-soft tabular-nums">{formatPhone(client.phone)}</td>
                    <td className="px-3 py-3 text-ink-soft tabular-nums">{calls.length}</td>
                    <td className="px-3 py-3">
                      {upcoming ? (
                        <span className="flex items-center gap-1.5 text-xs text-emerald-700">
                          <CalendarCheck2 aria-hidden className="size-3.5" />
                          {formatDayTime(upcoming.start, now)}
                        </span>
                      ) : (
                        <span className="text-xs text-ink-muted">
                          {appointments.length ? `${appointments.length} passé${appointments.length > 1 ? "s" : ""}` : "—"}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-xs text-ink-muted">{formatAgo(lastInteraction, now)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <ul className="divide-y divide-line md:hidden">
              {rows.map(({ client, calls, upcoming, lastInteraction }) => (
                <li key={client.id}>
                  <button
                    type="button"
                    onClick={() => select(client.id)}
                    className={cn("flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-stone-50", client.id === selectedId && "bg-brand-50/60")}
                  >
                    <Avatar name={client.name} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink">{client.name}</span>
                      <span className="block text-xs text-ink-muted tabular-nums">
                        {formatPhone(client.phone)} · {calls.length} appel{calls.length > 1 ? "s" : ""}
                      </span>
                      {upcoming && (
                        <span className="mt-0.5 block text-xs text-emerald-700">RDV {formatDayTime(upcoming.start, now)}</span>
                      )}
                    </span>
                    <span className="shrink-0 text-[11px] text-ink-muted">{formatAgo(lastInteraction, now)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <ClientPanel summary={selected} onClose={() => select(null)} />
    </div>
  );
}
