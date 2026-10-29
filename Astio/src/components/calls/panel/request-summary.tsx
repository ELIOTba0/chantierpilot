import type { ReactNode } from "react";
import { AlertCircle } from "lucide-react";
import type { Call } from "@/lib/types";
import { formatDuration } from "@/lib/format";
import { PriorityBadge } from "../badges";

function Item({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <dt className="text-xs text-ink-muted">{label}</dt>
      <dd className="mt-0.5 text-[13px] leading-relaxed text-ink">{children}</dd>
    </div>
  );
}

/** Résumé de la demande, tel que recueilli par Astio. */
export function RequestSummary({ call }: { call: Call }) {
  return (
    <div className="space-y-4">
      <dl className="grid gap-x-6 gap-y-3.5 sm:grid-cols-2">
        <Item label="Motif de l'appel" wide>
          <span className="font-medium">{call.motif}</span>
        </Item>
        <Item label="Description du problème" wide>
          {call.description}
        </Item>
        <Item label="Type d'intervention">{call.interventionType}</Item>
        <Item label="Durée estimée">
          {call.estimatedDurationMin > 0 ? formatDuration(call.estimatedDurationMin) : "Sans objet"}
        </Item>
        <Item label="Adresse du chantier" wide>
          {call.address ?? <span className="text-ink-muted">Non communiquée</span>}
        </Item>
        <Item label="Disponibilités du client" wide>
          {call.clientAvailability.length ? (
            call.clientAvailability.join(" · ")
          ) : (
            <span className="text-ink-muted">Non recueillies</span>
          )}
        </Item>
        <Item label="Urgence estimée" wide>
          <span className="flex flex-wrap items-start gap-2">
            <PriorityBadge priority={call.priority} />
            <span className="text-ink-soft">{call.urgencyNote}</span>
          </span>
        </Item>
      </dl>

      {call.missingInfo.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2.5">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-900">
            <AlertCircle aria-hidden className="size-3.5" />
            Informations manquantes
          </p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-[13px] text-amber-900">
            {call.missingInfo.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-[11px] text-ink-muted">
        L&apos;urgence est une estimation d&apos;Astio d&apos;après les propos du client, pas un diagnostic technique.
      </p>
    </div>
  );
}
