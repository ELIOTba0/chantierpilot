import { CalendarCheck2, MapPin } from "lucide-react";
import type { Appointment } from "@/lib/types";
import { formatDayTime, formatTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import { AppointmentBadge } from "../badges";

/** Rendez-vous confirmé par le professionnel (ou réalisé / annulé). */
export function AppointmentStatus({ appt, now }: { appt: Appointment; now: number }) {
  return (
    <div className="rounded-lg border border-line p-3.5">
      <div className="flex items-start gap-3">
        <CalendarCheck2 aria-hidden className="mt-0.5 size-4 text-ink-muted" />
        <div className="min-w-0 flex-1">
          <p className={cn("text-sm font-medium text-ink", appt.state === "annule" && "line-through")}>
            {formatDayTime(appt.start, now)} – {formatTime(appt.end)}
          </p>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-ink-soft">
            <MapPin aria-hidden className="size-3" /> {appt.address}
          </p>
          {appt.rescheduledFrom && (
            <p className="mt-1 text-xs text-ink-muted">Initialement prévu {formatDayTime(appt.rescheduledFrom, now)}</p>
          )}
        </div>
        <AppointmentBadge state={appt.state} short />
      </div>
    </div>
  );
}
