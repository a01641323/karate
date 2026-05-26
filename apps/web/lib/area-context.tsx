"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

const STORAGE_KEY = "karate.currentArea";
const ROLE_STORAGE_KEY = "karate.currentAreaRole";

/**
 * "area"  → the operator referees one competition area. Tabs:
 *           Admin + Private + Public.
 * "admin" → the tournament administrator console. Sits above all
 *           areas. Tabs: Admin + Check-in (always) + Manage. No
 *           private/public scoreboard.
 */
export type AreaRole = "area" | "admin";

interface AreaApi {
  /** Current area index. null = no area selected, or admin role. */
  current: number | null;
  /** What this device's operator is doing. Defaults to "area". */
  role: AreaRole;
  setArea: (idx: number | null, role?: AreaRole) => void;
}

const AreaContext = createContext<AreaApi | null>(null);

export function AreaProvider({ children }: { children: React.ReactNode }) {
  const [current, setCurrent] = useState<number | null>(null);
  const [role, setRole] = useState<AreaRole>("area");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw != null) {
      const n = Number(raw);
      if (Number.isFinite(n) && n >= 0) setCurrent(n);
    }
    const r = window.localStorage.getItem(ROLE_STORAGE_KEY);
    if (r === "admin" || r === "area") setRole(r);
  }, []);

  const setArea = useCallback((idx: number | null, nextRole: AreaRole = "area") => {
    setCurrent(idx);
    setRole(nextRole);
    if (typeof window === "undefined") return;
    if (idx === null) window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, String(idx));
    window.localStorage.setItem(ROLE_STORAGE_KEY, nextRole);
  }, []);

  const api = useMemo(() => ({ current, role, setArea }), [current, role, setArea]);
  return <AreaContext.Provider value={api}>{children}</AreaContext.Provider>;
}

export function useArea(): AreaApi {
  const ctx = useContext(AreaContext);
  if (!ctx) throw new Error("useArea must be used inside <AreaProvider>");
  return ctx;
}
