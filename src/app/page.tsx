"use client";

import { CalendarClock, PhoneIncoming } from "lucide-react";
import { useAstio } from "@/lib/app-context";
import { callsReceivedOn, callsToPlan } from "@/lib/selectors";
import { StatTile } from "@/components/dashboard/stat-tile";
import { Calendar } from "@/components/calendar/calendar";
import { useCalendarNav } from "@/components/calendar/use-calendar-nav";

export default function DashboardPage() {
  const { state, now } = useAstio();
  const received = callsReceivedOn(state, now).length;
  const toPlan = callsToPlan(state).length;
  const nav = useCalendarNav(now);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <StatTile href="/appels?periode=aujourdhui" label="Appels reçus aujourd'hui" value={received} icon={PhoneIncoming} />
        <StatTile
          href="/appels?vue=a-planifier"
          label="Appels à planifier"
          value={toPlan}
          icon={CalendarClock}
          highlight={toPlan > 0}
        />
      </div>
      <Calendar nav={nav} />
    </div>
  );
}
