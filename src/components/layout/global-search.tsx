"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { PhoneCall, Search, User } from "lucide-react";
import type { AppState } from "@/lib/types";
import { cn } from "@/lib/cn";
import { formatPhone } from "@/lib/format";
import { clientMap } from "@/lib/selectors";
import { normalize } from "@/lib/search";
import { useDismiss } from "@/lib/use-dismiss";

interface Result {
  key: string;
  href: string;
  kind: "appel" | "client";
  title: string;
  subtitle: string;
}

/** Recherche globale sur les appels et les clients (données locales). */
export function GlobalSearch({ state }: { state: AppState }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const close = useCallback(() => setOpen(false), []);
  useDismiss(rootRef, open, close);

  // Raccourci « / » pour placer le focus dans la recherche.
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (e.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const results = useMemo<Result[]>(() => {
    const q = normalize(query.trim());
    if (q.length < 2) return [];
    const clients = clientMap(state);
    const digits = query.replace(/\D/g, "");
    const calls = state.calls
      .filter((c) => {
        const client = clients.get(c.clientId);
        return (
          normalize(`${client?.name ?? ""} ${c.motif} ${c.id}`).includes(q) ||
          (digits.length >= 3 && client?.phone.includes(digits))
        );
      })
      .slice(0, 5)
      .map<Result>((c) => ({
        key: c.id,
        href: `/appels?appel=${c.id}`,
        kind: "appel",
        title: c.motif,
        subtitle: `${clients.get(c.clientId)?.name ?? "Client"} · ${c.id}`,
      }));
    const people = state.clients
      .filter((c) => normalize(c.name).includes(q) || (digits.length >= 3 && c.phone.includes(digits)))
      .slice(0, 4)
      .map<Result>((c) => ({
        key: c.id,
        href: `/clients?client=${c.id}`,
        kind: "client",
        title: c.name,
        subtitle: formatPhone(c.phone),
      }));
    return [...calls, ...people];
  }, [query, state]);

  const go = (r: Result) => {
    router.push(r.href);
    setOpen(false);
    setQuery("");
    (document.activeElement as HTMLElement | null)?.blur();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && results[active]) {
      e.preventDefault();
      go(results[active]);
    }
  };

  const showPanel = open && query.trim().length >= 2;

  return (
    <div ref={rootRef} className="relative w-full max-w-sm">
      <label htmlFor="global-search" className="sr-only">
        Rechercher un appel ou un client
      </label>
      <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted" />
      <input
        ref={inputRef}
        id="global-search"
        type="search"
        autoComplete="off"
        placeholder="Rechercher un client, un appel, un numéro…"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        role="combobox"
        aria-expanded={showPanel}
        aria-controls="global-search-results"
        aria-autocomplete="list"
        className="h-9 w-full rounded-lg border border-line bg-canvas pr-10 pl-9 text-sm text-ink placeholder:text-ink-muted focus:border-brand-500 focus:bg-surface focus:outline-none"
      />
      <kbd className="pointer-events-none absolute top-1/2 right-2.5 hidden -translate-y-1/2 rounded border border-line bg-surface px-1.5 text-[11px] text-ink-muted sm:block">
        /
      </kbd>

      {showPanel && (
        <div
          id="global-search-results"
          role="listbox"
          className="absolute top-11 right-0 left-0 z-40 overflow-hidden rounded-xl border border-line bg-surface py-1 shadow-(--shadow-pop)"
        >
          {results.length === 0 ? (
            <p className="px-4 py-6 text-center text-[13px] text-ink-muted">Aucun résultat pour « {query} »</p>
          ) : (
            results.map((r, i) => {
              const Icon = r.kind === "appel" ? PhoneCall : User;
              return (
                <button
                  key={`${r.kind}-${r.key}`}
                  type="button"
                  role="option"
                  aria-selected={i === active}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => go(r)}
                  className={cn(
                    "flex w-full items-center gap-3 px-3 py-2 text-left",
                    i === active ? "bg-stone-100" : "hover:bg-stone-50",
                  )}
                >
                  <Icon aria-hidden className="size-4 shrink-0 text-ink-muted" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-ink">{r.title}</span>
                    <span className="block truncate text-xs text-ink-muted">{r.subtitle}</span>
                  </span>
                  <span className="text-[11px] text-ink-muted">{r.kind === "appel" ? "Appel" : "Client"}</span>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
