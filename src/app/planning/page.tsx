"use client";

import { useAstio } from "@/lib/app-context";
import { Calendar } from "@/components/calendar/calendar";
import { useCalendarNav } from "@/components/calendar/use-calendar-nav";
import { ToPlanPanel } from "@/components/planning/to-plan-panel";

export default function PlanningPage() {
  const { now } = useAstio();
  const nav = useCalendarNav(now);

  return (
    <div className="mx-auto grid max-w-[1600px] grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0">
        <Calendar nav={nav} planning />
      </div>
      <aside>
        <ToPlanPanel onFocusDate={(iso) => nav.setAnchor(new Date(iso))} />
      </aside>
    </div>
  );
}
