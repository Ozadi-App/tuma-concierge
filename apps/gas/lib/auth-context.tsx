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
  login: (code: string, name?: string, phone?: string) => Promise<void>;
  logout: () => void;
  selectOutlet: (outletId: string) => void;
  toggleDuty: (onDuty: boolean) => void;
  refreshShift: () => Promise<void>;
  refreshOutlets: () => Promise<void>;
};

const DEFAULT_ATTENDANT: AttendantInfo = {
  id: "fatt_lugogo_1",
  code: "ATT-1001",
  name: "Kato Dennis",
  phone: "+256 701 111 001",
  pump_lane: "Pump 2 (Boda Lane)",
  on_duty: true,
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

  useEffect(() => {
    try {
      const storedAttendant = localStorage.getItem(ATTENDANT_KEY);
      if (storedAttendant) {
        setAttendant(JSON.parse(storedAttendant));
      } else {
        // Default demo attendant for immediate testing
        setAttendant(DEFAULT_ATTENDANT);
        localStorage.setItem(ATTENDANT_KEY, JSON.stringify(DEFAULT_ATTENDANT));
      }

      const storedOutlet = localStorage.getItem(OUTLET_KEY);
      if (storedOutlet) {
        setSelectedOutletId(storedOutlet);
      }
    } finally {
      setReady(true);
    }
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
  }, []);

  const login = useCallback(async (code: string, name?: string, phone?: string) => {
    const info: AttendantInfo = {
      id: `fatt_${code.toLowerCase().replace(/[^a-z0-9]/g, "")}`,
      code: code.trim().toUpperCase(),
      name: name?.trim() || "Station Attendant",
      phone: phone?.trim() || "+256 700 000 000",
      pump_lane: "Pump 1 (Boda Lane)",
      on_duty: true,
    };
    localStorage.setItem(ATTENDANT_KEY, JSON.stringify(info));
    localStorage.setItem(TOKEN_KEY, `gas_tok_${info.id}`);
    setAttendant(info);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(ATTENDANT_KEY);
    setAttendant(null);
  }, []);

  const toggleDuty = useCallback((onDuty: boolean) => {
    setAttendant((prev) => {
      if (!prev) return null;
      const updated = { ...prev, on_duty: onDuty };
      localStorage.setItem(ATTENDANT_KEY, JSON.stringify(updated));
      return updated;
    });
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

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used within AuthProvider");
  return value;
}
