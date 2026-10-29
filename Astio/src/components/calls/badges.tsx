import { AlertTriangle, ArrowUp, Minus, ArrowDown } from "lucide-react";
import type { AppointmentState, CallStatus, Priority } from "@/lib/types";
import { APPOINTMENT_STATE, CALL_STATUS, PRIORITY } from "@/lib/labels";
import { Badge } from "@/components/ui/badge";

const PRIORITY_ICONS: Record<Priority, typeof AlertTriangle> = {
  urgente: AlertTriangle,
  haute: ArrowUp,
  normale: Minus,
  basse: ArrowDown,
};

/** Priorité : icône + libellé, pour ne pas dépendre uniquement de la couleur. */
export function PriorityBadge({ priority }: { priority: Priority }) {
  const Icon = PRIORITY_ICONS[priority];
  return (
    <Badge tone={PRIORITY[priority].tone} icon={<Icon aria-hidden className="size-3" strokeWidth={2.5} />}>
      {PRIORITY[priority].label}
    </Badge>
  );
}

export function StatusBadge({ status }: { status: CallStatus }) {
  return (
    <Badge tone={CALL_STATUS[status].tone} dot>
      {CALL_STATUS[status].label}
    </Badge>
  );
}

export function AppointmentBadge({ state, short }: { state: AppointmentState; short?: boolean }) {
  const def = APPOINTMENT_STATE[state];
  return (
    <Badge tone={def.tone} dot>
      {short ? def.short : def.label}
    </Badge>
  );
}
