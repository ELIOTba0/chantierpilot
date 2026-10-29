"use client";

import { ArrowDown, Sparkles } from "lucide-react";
import type { Appointment, Call, Client } from "@/lib/types";
import type { SortKey } from "@/lib/call-filters";
import { DECISION_KIND, PRIORITY } from "@/lib/labels";
import { formatDayTime, formatPhone } from "@/lib/format";
import { cn } from "@/lib/cn";
import { AppointmentBadge, PriorityBadge, StatusBadge } from "./badges";
import { suggestedSlot } from "@/lib/selectors";

interface CallsTableProps {
  calls: Call[];
  clients: Map<string, Client>;
  appointments: Map<string, Appointment>;
  now: number;
  sort: SortKey;
  onSort: (s: SortKey) => void;
  selectedId: string | null;
  onOpen: (id: string) => void;
}

function SortHeader({ label, sortKey, sort, onSort }: { label: string; sortKey: SortKey; sort: SortKey; onSort: (s: SortKey) => void }) {
  const active = sort === sortKey;
  return (
    <th scope="col" aria-sort={active ? (sortKey === "date" ? "descending" : "ascending") : "none"} className="px-3 py-2.5 font-medium">
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn("inline-flex items-center gap-1 hover:text-ink", active && "text-ink")}
      >
        {label}
        <ArrowDown aria-hidden className={cn("size-3", active ? "opacity-100" : "opacity-0")} />
      </button>
    </th>
  );
}

/** Vue liste : plus dense que le Kanban, triable par colonnes. */
export function CallsTable({ calls, clients, appointments, now, sort, onSort, selectedId, onOpen }: CallsTableProps) {
  const apptList = [...appointments.values()];
  return (
    <div className="overflow-hidden rounded-2xl bg-surface shadow-(--shadow-card)">
      {/* Tableau sur écran large */}
      <table className="hidden w-full text-left text-sm md:table">
        <thead className="border-b border-line bg-canvas text-xs text-ink-muted">
          <tr>
            <th scope="col" className="px-4 py-2.5 font-medium">Client</th>
            <th scope="col" className="px-3 py-2.5 font-medium">Motif</th>
            <SortHeader label="Reçu" sortKey="date" sort={sort} onSort={onSort} />
            <SortHeader label="Priorité" sortKey="priorite" sort={sort} onSort={onSort} />
            <SortHeader label="Statut" sortKey="statut" sort={sort} onSort={onSort} />
            <th scope="col" className="px-3 py-2.5 font-medium">Rendez-vous</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {calls.map((call) => {
            const client = clients.get(call.clientId);
            const appt = call.appointmentId ? appointments.get(call.appointmentId) : undefined;
            const sugg = call.status === "a_confirmer" ? suggestedSlot(call, now, apptList) : undefined;
            return (
              <tr
                key={call.id}
                onClick={() => onOpen(call.id)}
                className={cn("cursor-pointer hover:bg-stone-50", call.id === selectedId && "bg-brand-50/60")}
              >
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpen(call.id);
                    }}
                    className="text-left font-medium text-ink hover:underline"
                  >
                    {client?.name ?? "Client inconnu"}
                  </button>
                  <p className="text-xs text-ink-muted tabular-nums">{client && formatPhone(client.phone)}</p>
                </td>
                <td className="max-w-72 px-3 py-3">
                  <p className="truncate text-ink">{call.motif}</p>
                  {call.decision && (
                    <p className="mt-0.5 flex items-center gap-1 text-xs font-medium text-brand-800">
                      <Sparkles aria-hidden className="size-3" />
                      {DECISION_KIND[call.decision.kind].label}
                    </p>
                  )}
                </td>
                <td className="px-3 py-3 whitespace-nowrap text-ink-soft tabular-nums">{formatDayTime(call.receivedAt, now)}</td>
                <td className="px-3 py-3">
                  {/* Seules les priorités notables sont affichées, pour ne pas saturer la liste. */}
                  {call.priority === "urgente" || call.priority === "haute" ? (
                    <PriorityBadge priority={call.priority} />
                  ) : (
                    <span className="text-xs text-ink-muted">{PRIORITY[call.priority].label}</span>
                  )}
                </td>
                <td className="px-3 py-3"><StatusBadge status={call.status} /></td>
                <td className="px-3 py-3 whitespace-nowrap">
                  {sugg ? (
                    <span className="flex flex-col items-start gap-1">
                      <span className="text-xs text-ink-soft tabular-nums">{formatDayTime(sugg.start, now)}</span>
                      <span className="text-xs font-medium text-sky-700">Suggéré, à confirmer</span>
                    </span>
                  ) : appt ? (
                    <span className="flex flex-col items-start gap-1">
                      <span className="text-xs text-ink-soft tabular-nums">{formatDayTime(appt.start, now)}</span>
                      <AppointmentBadge state={appt.state} short />
                    </span>
                  ) : (
                    <span className="text-xs text-ink-muted">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Lignes empilées sur mobile */}
      <ul className="divide-y divide-line md:hidden">
        {calls.map((call) => {
          const client = clients.get(call.clientId);
          const appt = call.appointmentId ? appointments.get(call.appointmentId) : undefined;
          return (
            <li key={call.id}>
              <button
                type="button"
                onClick={() => onOpen(call.id)}
                className={cn("w-full px-4 py-3 text-left hover:bg-stone-50", call.id === selectedId && "bg-brand-50/60")}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-semibold text-ink">{client?.name}</span>
                  <span className="shrink-0 text-xs text-ink-muted tabular-nums">{formatDayTime(call.receivedAt, now)}</span>
                </span>
                <span className="mt-0.5 block truncate text-[13px] text-ink-soft">{call.motif}</span>
                <span className="mt-2 flex flex-wrap items-center gap-1.5">
                  <StatusBadge status={call.status} />
                  {(call.priority === "urgente" || call.priority === "haute") && <PriorityBadge priority={call.priority} />}
                  {appt && <AppointmentBadge state={appt.state} short />}
                  {call.decision && (
                    <span className="flex items-center gap-1 text-xs font-medium text-brand-800">
                      <Sparkles aria-hidden className="size-3" />
                      {DECISION_KIND[call.decision.kind].label}
                    </span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
