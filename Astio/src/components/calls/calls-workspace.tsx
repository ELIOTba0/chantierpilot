"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PhoneOff } from "lucide-react";
import { useAstio } from "@/lib/app-context";
import { appointmentMap, clientMap, isToPlan, suggestedSlot } from "@/lib/selectors";
import { type CallFilters, EMPTY_FILTERS, filterCalls, sortCalls } from "@/lib/call-filters";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { FilterBar, type CallsMode } from "./filter-bar";
import { KanbanBoard } from "./kanban-board";
import { CallsTable } from "./calls-table";
import { CallPanel } from "./call-panel";
import { CancelAppointmentDialog, ConfirmSlotDialog, DisqualifyDialog } from "./call-dialogs";
import { changeStatus, completeCall, requestDecision } from "./call-actions";
import type { Call, CallStatus } from "@/lib/types";
import { suggestSlots } from "@/lib/slots";

const MODE_STORAGE_KEY = "astio:calls-mode";

function initialMode(): CallsMode {
  try {
    return window.localStorage.getItem(MODE_STORAGE_KEY) === "liste" ? "liste" : "kanban";
  } catch {
    return "kanban";
  }
}

/**
 * Page Appels : filtres partagés entre les vues Kanban et Liste, et panneau
 * de détail synchronisé avec l'URL (?appel=…) pour les liens profonds.
 */
export function CallsWorkspace({ initialFilters }: { initialFilters: CallFilters }) {
  const { state, now } = useAstio();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [filters, setFilters] = useState(initialFilters);
  const [mode, setMode] = useState<CallsMode>(initialMode);
  // Fenêtres ouvertes par un glisser-déposer.
  const [confirmFor, setConfirmFor] = useState<Call | null>(null);
  const [disqualifyFor, setDisqualifyFor] = useState<Call | null>(null);
  const [cancelFor, setCancelFor] = useState<{ call: Call; status: "a_traiter" | "a_confirmer" } | null>(null);

  const selectedId = params.get("appel");
  const clients = clientMap(state);
  const appointments = appointmentMap(state);
  const visible = sortCalls(filterCalls(state.calls, filters, { clients, appointments, now }), filters.sort);
  const selected = state.calls.find((c) => c.id === selectedId);

  const setSelected = (id: string | null) => {
    const next = new URLSearchParams(params.toString());
    if (id) next.set("appel", id);
    else next.delete("appel");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  /** Met le dossier en attente d'un oui / non, avec un créneau suggéré. */
  const askDecision = (call: Call) => {
    const slots = suggestedSlot(call, now, state.appointments)
      ? call.proposedSlots
      : suggestSlots(state, {
          durationMin: call.estimatedDurationMin || state.settings.hours.defaultDurationMin,
          now,
          count: 3,
          excludeAppointmentId: call.appointmentId,
        });
    requestDecision(call, slots);
  };

  /** Conséquences d'un glisser-déposer selon la colonne d'arrivée. */
  const moveCall = (call: Call, target: CallStatus) => {
    const confirmed = call.status === "rdv_confirme" && appointments.get(call.appointmentId ?? "")?.state === "confirme";
    if (target === "rdv_confirme") return setConfirmFor(call);
    if (target === "termine") return completeCall(call);
    if (target === "non_qualifie") return setDisqualifyFor(call);
    // Retirer un rendez-vous confirmé l'annule (le client est prévenu).
    if (confirmed) return setCancelFor({ call, status: target });
    if (target === "a_confirmer") return askDecision(call);
    changeStatus(call, target);
  };

  const changeMode = (m: CallsMode) => {
    setMode(m);
    try {
      window.localStorage.setItem(MODE_STORAGE_KEY, m);
    } catch {
      // Préférence non mémorisée.
    }
  };

  return (
    <div className="mx-auto max-w-[1600px] space-y-5">
      <FilterBar
        filters={filters}
        onChange={setFilters}
        mode={mode}
        onModeChange={changeMode}
        counts={{
          decisions: state.calls.filter((c) => c.decision !== null).length,
          toPlan: state.calls.filter(isToPlan).length,
          results: visible.length,
          total: state.calls.length,
        }}
      />

      {visible.length === 0 ? (
        <div className="rounded-2xl bg-surface shadow-(--shadow-card)">
          <EmptyState
            icon={<PhoneOff className="size-5" />}
            title="Aucun appel ne correspond à ces filtres"
            description="Modifiez la recherche ou retirez un filtre pour afficher d'autres dossiers."
            action={
              <Button size="sm" onClick={() => setFilters({ ...EMPTY_FILTERS, sort: filters.sort })}>
                Effacer les filtres
              </Button>
            }
          />
        </div>
      ) : mode === "kanban" ? (
        <KanbanBoard
          calls={visible}
          statuses={filters.statuses}
          clients={clients}
          appointments={appointments}
          now={now}
          selectedId={selectedId}
          onOpen={setSelected}
          onMove={moveCall}
        />
      ) : (
        <CallsTable
          calls={visible}
          clients={clients}
          appointments={appointments}
          now={now}
          sort={filters.sort}
          onSort={(sort) => setFilters({ ...filters, sort })}
          selectedId={selectedId}
          onOpen={setSelected}
        />
      )}

      <CallPanel call={selected} onClose={() => setSelected(null)} onMove={moveCall} />
      <ConfirmSlotDialog call={confirmFor} onClose={() => setConfirmFor(null)} />
      <DisqualifyDialog call={disqualifyFor} onClose={() => setDisqualifyFor(null)} />
      <CancelAppointmentDialog
        call={cancelFor?.call ?? null}
        status={cancelFor?.status}
        onClose={() => setCancelFor(null)}
        afterCancel={() => {
          // Après annulation, un dossier déplacé vers « À confirmer » reçoit un nouveau créneau suggéré.
          if (cancelFor?.status === "a_confirmer") askDecision({ ...cancelFor.call, appointmentId: undefined });
        }}
      />
    </div>
  );
}
