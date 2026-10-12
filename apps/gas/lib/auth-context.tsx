"use client";

import type {
  FuelStationOutlet,
  FuelShiftSummary,
  FuelStationManager,
  FuelStationSalesSummary,
} from "@peebee/shared";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  api,
  ATTENDANT_KEY,
  MANAGER_KEY,
  MODE_KEY,
  OUTLET_KEY,
  ROLE_KEY,
  TOKEN_KEY,
  errorMessage,
} from "./api";

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
  manager: FuelStationManager | null;
  outlet: FuelStationOutlet | null;
  outlets: FuelStationOutlet[];
  shiftSummary: FuelShiftSummary | null;
  salesSummary: FuelStationSalesSummary | null;
  role: "attendant" | "manager" | null;
  activeMode: "attendant" | "manager";
  isManager: boolean;
  ready: boolean;
  error: string | null;
  login: (code: string, pin?: string, outletId?: string) => Promise<void>;
  loginManager: (code?: string, pin?: string, outletId?: string) => Promise<void>;
  switchToPumpMode: () => void;
  switchToManagerMode: () => void;
  logout: () => void;
  selectOutlet: (outletId: string) => void;
  toggleDuty: (onDuty: boolean) => Promise<void>;
  refreshShift: () => Promise<void>;
  refreshSales: (period?: string) => Promise<void>;
  refreshOutlets: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [attendant, setAttendant] = useState<AttendantInfo | null>(null);
  const [manager, setManager] = useState<FuelStationManager | null>(null);
  const [role, setRole] = useState<"attendant" | "manager" | null>(null);
  const [activeMode, setActiveMode] = useState<"attendant" | "manager">("attendant");
  const [outlets, setOutlets] = useState<FuelStationOutlet[]>([]);
  const [selectedOutletId, setSelectedOutletId] = useState<string | null>(null);
  const [shiftSummary, setShiftSummary] = useState<FuelShiftSummary | null>(null);
  const [salesSummary, setSalesSummary] = useState<FuelStationSalesSummary | null>(null);
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

  const refreshSales = useCallback(
    async (period = "today") => {
      const outletId = selectedOutletId || "fout_total_lugogo";
      try {
        const res = await api.gasManagerSalesSummary(outletId, period);
        if (res.ok) {
          setSalesSummary(res.summary);
        }
      } catch {
        // Ignore background refresh errors
      }
    },
    [selectedOutletId],
  );

  // Load session from API
  useEffect(() => {
    async function initSession() {
      try {
        const storedToken = localStorage.getItem(TOKEN_KEY);
        const storedOutlet = localStorage.getItem(OUTLET_KEY);
        const storedRole = localStorage.getItem(ROLE_KEY) as "attendant" | "manager" | null;
        const storedMode = localStorage.getItem(MODE_KEY) as "attendant" | "manager" | null;

        if (storedOutlet) setSelectedOutletId(storedOutlet);
        if (storedRole) setRole(storedRole);
        if (storedMode) setActiveMode(storedMode);

        if (storedToken) {
          if (storedRole === "manager") {
            try {
              const mgrRes = await api.gasManagerMe();
              if (mgrRes.ok) {
                setManager(mgrRes.manager);
                setRole("manager");
                if (!storedMode) setActiveMode("manager");
                if (mgrRes.outlet?.id) {
                  setSelectedOutletId(mgrRes.outlet.id);
                  localStorage.setItem(OUTLET_KEY, mgrRes.outlet.id);
                }
              }
            } catch {
              const cached = localStorage.getItem(MANAGER_KEY);
              if (cached) setManager(JSON.parse(cached));
            }
          } else {
            try {
              const meRes = await api.gasMe();
              if (meRes.ok) {
                setAttendant(meRes.attendant);
                setRole("attendant");
                setActiveMode("attendant");
                if (meRes.outlet?.id) {
                  setSelectedOutletId(meRes.outlet.id);
                  localStorage.setItem(OUTLET_KEY, meRes.outlet.id);
                }
              }
            } catch {
              const storedAttendant = localStorage.getItem(ATTENDANT_KEY);
              if (storedAttendant) {
                setAttendant(JSON.parse(storedAttendant));
                setRole("attendant");
              }
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
      if (role === "manager") {
        void refreshSales();
      }
    }
  }, [ready, role, refreshOutlets, refreshShift, refreshSales]);

  const selectOutlet = useCallback(
    (outletId: string) => {
      setSelectedOutletId(outletId);
      localStorage.setItem(OUTLET_KEY, outletId);
      void refreshShift();
      if (role === "manager") {
        void refreshSales();
      }
    },
    [refreshShift, refreshSales, role],
  );

  const login = useCallback(
    async (code: string, pin?: string, outletId?: string) => {
      setError(null);
      try {
        const res = await api.gasAttendantLogin(code, pin, outletId);
        if (res.ok) {
          localStorage.setItem(TOKEN_KEY, res.token);
          localStorage.setItem(ATTENDANT_KEY, JSON.stringify(res.attendant));
          localStorage.setItem(ROLE_KEY, "attendant");
          localStorage.setItem(MODE_KEY, "attendant");
          if (res.outlet?.id) {
            localStorage.setItem(OUTLET_KEY, res.outlet.id);
            setSelectedOutletId(res.outlet.id);
          }
          setAttendant(res.attendant);
          setRole("attendant");
          setActiveMode("attendant");
          setManager(null);
          void refreshShift();
        }
      } catch (e) {
        const msg = errorMessage(e);
        setError(msg);
        throw e;
      }
    },
    [refreshShift],
  );

  const loginManager = useCallback(
    async (code?: string, pin?: string, outletId?: string) => {
      setError(null);
      try {
        const res = await api.gasManagerLogin(code, pin, outletId);
        if (res.ok) {
          localStorage.setItem(TOKEN_KEY, res.token);
          localStorage.setItem(MANAGER_KEY, JSON.stringify(res.manager));
          localStorage.setItem(ROLE_KEY, "manager");
          localStorage.setItem(MODE_KEY, "manager");
          if (res.outlet?.id) {
            localStorage.setItem(OUTLET_KEY, res.outlet.id);
            setSelectedOutletId(res.outlet.id);
          }
          setManager(res.manager);
          setRole("manager");
          setActiveMode("manager");
          setAttendant(null);
          void refreshSales();
          void refreshShift();
        }
      } catch (e) {
        const msg = errorMessage(e);
        setError(msg);
        throw e;
      }
    },
    [refreshSales, refreshShift],
  );

  const switchToPumpMode = useCallback(() => {
    setActiveMode("attendant");
    localStorage.setItem(MODE_KEY, "attendant");
  }, []);

  const switchToManagerMode = useCallback(() => {
    setActiveMode("manager");
    localStorage.setItem(MODE_KEY, "manager");
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(ATTENDANT_KEY);
    localStorage.removeItem(MANAGER_KEY);
    localStorage.removeItem(ROLE_KEY);
    localStorage.removeItem(MODE_KEY);
    setAttendant(null);
    setManager(null);
    setRole(null);
    setActiveMode("attendant");
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

  // When manager is signed in, provide an effective attendant profile so they can pump fuel
  const effectiveAttendant: AttendantInfo | null = useMemo(() => {
    if (attendant) return attendant;
    if (manager) {
      return {
        id: manager.id,
        code: manager.manager_code,
        name: `${manager.full_name} (Manager)`,
        phone: manager.phone,
        pump_lane: "Pump 1 (Manager)",
        on_duty: true,
      };
    }
    return null;
  }, [attendant, manager]);

  const value = useMemo(
    () => ({
      attendant: effectiveAttendant,
      manager,
      outlet,
      outlets,
      shiftSummary,
      salesSummary,
      role,
      activeMode,
      isManager: Boolean(manager),
      ready,
      error,
      login,
      loginManager,
      switchToPumpMode,
      switchToManagerMode,
      logout,
      selectOutlet,
      toggleDuty,
      refreshShift,
      refreshSales,
      refreshOutlets,
    }),
    [
      effectiveAttendant,
      manager,
      outlet,
      outlets,
      shiftSummary,
      salesSummary,
      role,
      activeMode,
      ready,
      error,
      login,
      loginManager,
      switchToPumpMode,
      switchToManagerMode,
      logout,
      selectOutlet,
      toggleDuty,
      refreshShift,
      refreshSales,
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
