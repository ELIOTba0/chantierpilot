"use client";

import Link from "next/link";
import { CalendarDays, MapPin, Phone, PhoneCall, X } from "lucide-react";
import type { ClientSummary } from "@/lib/selectors";
import { formatDate, formatDayTime, formatPhone, formatTime } from "@/lib/format";
import { useAstio } from "@/lib/app-context";
import { cn } from "@/lib/cn";
import { SideSheet } from "@/components/ui/side-sheet";
import { Avatar } from "@/components/ui/avatar";
import { AppointmentBadge, PriorityBadge, StatusBadge } from "@/components/calls/badges";
import { PanelSection } from "@/components/calls/panel/section";

interface ClientPanelProps {
  summary: ClientSummary | undefined;
  onClose: () => void;
}

/** Fiche client : coordonnées, historique des appels et rendez-vous associés. */
export function ClientPanel({ summary, onClose }: ClientPanelProps) {
  return (
    <SideSheet open={Boolean(summary)} onClose={onClose} labelledBy="client-panel-title">
      {summary && <ClientDetail summary={summary} onClose={onClose} />}
    </SideSheet>
  );
}

function ClientDetail({ summary, onClose }: { summary: ClientSummary; onClose: () => void }) {
  const { now } = useAstio();
  const { client, calls, appointments } = summary;
  const upcoming = appointments.filter((a) => a.state === "confirme" && new Date(a.end).getTime() >= now).reverse();
  const past = appointments.filter((a) => !upcoming.includes(a));

  return (
    <>
      <header className="border-b border-line px-5 pt-5 pb-4 sm:px-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar name={client.name} className="size-11 text-sm" />
            <div className="min-w-0">
              <h2 id="client-panel-title" className="truncate text-xl font-semibold tracking-tight text-ink">
                {client.name}
              </h2>
              <p className="text-xs text-ink-muted">Client depuis le {formatDate(client.since)}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="-mr-1 rounded-lg p-1.5 text-ink-muted hover:bg-stone-100 hover:text-ink"
            aria-label="Fermer la fiche client"
          >
            <X className="size-5" />
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <PanelSection title="Coordonnées" id="client-contact">
          <dl className="space-y-2.5 text-sm">
            <div className="flex items-center gap-3">
              <dt className="sr-only">Téléphone</dt>
              <Phone aria-hidden className="size-4 text-ink-muted" />
              <dd>
                <a href={`tel:${client.phone}`} className="text-ink tabular-nums hover:underline">
                  {formatPhone(client.phone)}
                </a>
              </dd>
            </div>
            <div className="flex items-start gap-3">
              <dt className="sr-only">Adresse principale</dt>
              <MapPin aria-hidden className="mt-0.5 size-4 text-ink-muted" />
              <dd className={client.address ? "text-ink" : "text-ink-muted"}>
                {client.address ?? "Adresse non communiquée"}
                {client.zone && <span className="block text-xs text-ink-muted">{client.zone}</span>}
              </dd>
            </div>
          </dl>
        </PanelSection>

        <PanelSection title={`Rendez-vous · ${appointments.length}`} id="client-rdv">
          {appointments.length === 0 ? (
            <p className="text-[13px] text-ink-muted">Aucun rendez-vous pour ce client.</p>
          ) : (
            <ul className="space-y-2">
              {[...upcoming, ...past].map((a) => (
                <li key={a.id} className={cn("flex items-start gap-3 rounded-lg border border-line px-3 py-2.5", !upcoming.includes(a) && "bg-canvas")}>
                  <CalendarDays aria-hidden className="mt-0.5 size-4 text-ink-muted" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-ink">
                      {formatDayTime(a.start, now)} – {formatTime(a.end)}
                    </p>
                    <p className="truncate text-xs text-ink-soft">{a.motif}</p>
                  </div>
                  <AppointmentBadge state={a.state} short />
                </li>
              ))}
            </ul>
          )}
        </PanelSection>

        <PanelSection title={`Historique des appels · ${calls.length}`} id="client-calls">
          {calls.length === 0 ? (
            <p className="text-[13px] text-ink-muted">Aucun appel enregistré.</p>
          ) : (
            <ul className="space-y-2">
              {calls.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/appels?appel=${c.id}`}
                    className="flex items-start gap-3 rounded-lg border border-line px-3 py-2.5 transition hover:border-line-strong hover:bg-stone-50"
                  >
                    <PhoneCall aria-hidden className="mt-0.5 size-4 text-ink-muted" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-ink">{c.motif}</span>
                      <span className="block text-xs text-ink-muted">
                        {formatDayTime(c.receivedAt, now)} · {c.id}
                      </span>
                      <span className="mt-1.5 flex flex-wrap gap-1.5">
                        <StatusBadge status={c.status} />
                        {(c.priority === "urgente" || c.priority === "haute") && <PriorityBadge priority={c.priority} />}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </PanelSection>
      </div>
    </>
  );
}
