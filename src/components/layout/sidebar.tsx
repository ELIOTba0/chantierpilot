"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Settings2 } from "lucide-react";
import { cn } from "@/lib/cn";
import type { AppState } from "@/lib/types";
import { Avatar } from "@/components/ui/avatar";
import { Logo } from "./logo";
import { NAV_ITEMS, isActive } from "./nav";

interface SidebarProps {
  state: AppState;
  onNavigate?: () => void;
}

export function Sidebar({ state, onNavigate }: SidebarProps) {
  const pathname = usePathname();
  const decisions = state.calls.filter((c) => c.decision !== null).length;
  const { profile } = state.settings;

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center px-5">
        <Link href="/" onClick={onNavigate} aria-label="Astio – Vue d'ensemble">
          <Logo />
        </Link>
      </div>

      <nav aria-label="Navigation principale" className="flex-1 px-3 pt-2">
        <ul className="space-y-0.5">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group relative flex h-9 items-center gap-3 rounded-lg px-3 text-[15px] font-medium transition-colors",
                    active ? "bg-black/[0.06] text-ink" : "text-ink-soft hover:bg-black/[0.04] hover:text-ink",
                  )}
                >
                  <Icon
                    aria-hidden
                    className={cn("size-[18px]", active ? "text-brand-700" : "text-ink-muted group-hover:text-ink-soft")}
                  />
                  <span className="flex-1">{label}</span>
                  {href === "/appels" && decisions > 0 && (
                    <span
                      className="rounded-full bg-brand-500 px-1.5 py-px text-[11px] font-semibold text-ink tabular-nums"
                      aria-label={`${decisions} décisions en attente`}
                    >
                      {decisions}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="p-3">
        <div className="flex items-center gap-3 rounded-lg px-2 py-2">
          <Avatar name={profile.name} className="size-9 bg-ink text-white" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-ink">{profile.name}</p>
            <p className="truncate text-xs text-ink-muted">Plombier · {profile.company}</p>
          </div>
          <Link
            href="/reglages"
            onClick={onNavigate}
            className="rounded-md p-1.5 text-ink-muted hover:bg-stone-100 hover:text-ink"
            aria-label="Paramètres du compte"
          >
            <Settings2 className="size-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
