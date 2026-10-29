"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { AppState } from "./types";

interface AppContextValue {
  state: AppState;
  now: number;
}

const AppContext = createContext<AppContextValue | null>(null);

/** Fourni par AppShell une fois l'état local chargé dans le navigateur. */
export function AppProvider({ value, children }: { value: AppContextValue; children: ReactNode }) {
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAstio(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useAstio doit être utilisé à l'intérieur de AppShell");
  return ctx;
}
