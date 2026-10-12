"use client";

import type { FuelStationOutlet, FuelShiftSummary } from "@peebee/shared";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, ATTENDANT_KEY, OUTLET_KEY, TOKEN_KEY, errorMessage } from "./api";

export type AttendantInfo = {
  id: string;
  code: string;
  name: string;
  phone: string;
  pump_lane: string;
  on_duty: boolean;
};

type AuthState = {
  attendant: AttendantInfo | null;
  outlet: FuelStationOutlet | null;
  outlets: FuelStationOutlet[];
  shiftSummary: FuelShiftSummary | null;
  ready: boolean;
  error: string | null;
  login: (code: string, pin?: string, outletId?: string) => Promise<void>;
  logout: () => void;
  selectOutlet: (outletId: string) => void;
  toggleDuty: (onDuty: boolean) => Promise<void>;
  refreshShift: () => Promise<void>;
  refreshOutlets: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [attendant, setAttendant] = useState<AttendantInfo | null>(null);
  const [outlets, setOutlets] = useState<FuelStationOutlet[]>([]);
  const [selectedOutletId, setSelectedOutletId] = useState<string | null>(null);
  const [shiftSummary, setShiftSummary] = useState<FuelShiftSummary | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshOutlets = useCallback(async () => {
    try {
      const res = await api.gasStations();
      setOutlets(res.outlets);
      if (!selectedOutletId && res.outlets[0]) {
        setSelectedOutletId(res.outlets[0].id);
        localStorage.setItem(OUTLET_KEY, res.outlets[0].id);
      }
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [selectedOutletId]);

  const refreshShift = useCallback(async () => {
    const outletId = selectedOutletId || "fout_total_lugogo";
    try {
      const res = await api.gasShiftSummary(outletId);
      setShiftSummary(res.summary);
    } catch {
      // Ignore background refresh errors
    }
  }, [selectedOutletId]);

  // Load session from API
  useEffect(() => {
    async function initSession() {
      try {
        const storedToken = localStorage.getItem(TOKEN_KEY);
        const storedOutlet = localStorage.getItem(OUTLET_KEY);
        if (storedOutlet) setSelectedOutletId(storedOutlet);

        if (storedToken) {
          try {
            const meRes = await api.gasMe();
            if (meRes.ok) {
              setAttendant(meRes.attendant);
              if (meRes.outlet?.id) {
                setSelectedOutletId(meRes.outlet.id);
                localStorage.setItem(OUTLET_KEY, meRes.outlet.id);
              }
            }
          } catch {
            // Token expired or invalid
            const storedAttendant = localStorage.getItem(ATTENDANT_KEY);
            if (storedAttendant) {
              setAttendant(JSON.parse(storedAttendant));
            }
          }
        }
      } finally {
        setReady(true);
      }
    }

    void initSession();
  }, []);

  useEffect(() => {
    if (ready) {
      void refreshOutlets();
      void refreshShift();
    }
  }, [ready, refreshOutlets, refreshShift]);

  const selectOutlet = useCallback((outletId: string) => {
    setSelectedOutletId(outletId);
    localStorage.setItem(OUTLET_KEY, outletId);
    void refreshShift();
  }, [refreshShift]);

  const login = useCallback(async (code: string, pin?: string, outletId?: string) => {
    setError(null);
    try {
      const res = await api.gasAttendantLogin(code, pin, outletId);
      if (res.ok) {
        localStorage.setItem(TOKEN_KEY, res.token);
        localStorage.setItem(ATTENDANT_KEY, JSON.stringify(res.attendant));
        if (res.outlet?.id) {
          localStorage.setItem(OUTLET_KEY, res.outlet.id);
          setSelectedOutletId(res.outlet.id);
        }
        setAttendant(res.attendant);
        void refreshShift();
      }
    } catch (e) {
      const msg = errorMessage(e);
      setError(msg);
      throw e;
    }
  }, [refreshShift]);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(ATTENDANT_KEY);
    setAttendant(null);
  }, []);

  const toggleDuty = useCallback(async (onDuty: boolean) => {
    setAttendant((prev) => {
      if (!prev) return null;
      const updated = { ...prev, on_duty: onDuty };
      localStorage.setItem(ATTENDANT_KEY, JSON.stringify(updated));
      return updated;
    });

    try {
      await api.gasToggleDuty(onDuty);
    } catch {}
  }, []);

  const outlet = useMemo(() => {
    return outlets.find((o) => o.id === selectedOutletId) ?? outlets[0] ?? null;
  }, [outlets, selectedOutletId]);

  const value = useMemo(
    () => ({
      attendant,
      outlet,
      outlets,
      shiftSummary,
      ready,
      error,
      login,
      logout,
      selectOutlet,
      toggleDuty,
      refreshShift,
      refreshOutlets,
    }),
    [
      attendant,
      outlet,
      outlets,
      shiftSummary,
      ready,
      error,
      login,
      logout,
      selectOutlet,
      toggleDuty,
      refreshShift,
      refreshOutlets,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
