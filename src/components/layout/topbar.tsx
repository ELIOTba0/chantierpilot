"use client";

import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import type { AppState } from "@/lib/types";
import { formatLongDay } from "@/lib/format";
import { GlobalSearch } from "./global-search";
import { Notifications } from "./notifications";
import { pageTitle } from "./nav";

interface TopbarProps {
  state: AppState;
  now: number;
  onOpenMenu: () => void;
}

export function Topbar({ state, now, onOpenMenu }: TopbarProps) {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-30 border-b border-line/70 bg-canvas/80 backdrop-blur-xl">
      <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={onOpenMenu}
          className="-ml-1 rounded-lg p-2 text-ink-soft hover:bg-stone-100 lg:hidden"
          aria-label="Ouvrir le menu"
        >
          <Menu className="size-5" />
        </button>

        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[17px] font-semibold tracking-tight text-ink">{pageTitle(pathname)}</h1>
          <p className="hidden text-xs text-ink-muted sm:block">
            <time dateTime={new Date(now).toISOString()}>{formatLongDay(new Date(now))}</time>
          </p>
        </div>

        <div className="hidden flex-1 justify-end md:flex">
          <GlobalSearch state={state} />
        </div>
        <Notifications state={state} />
      </div>
      <div className="px-4 pb-3 md:hidden">
        <GlobalSearch state={state} />
      </div>
    </header>
  );
}
