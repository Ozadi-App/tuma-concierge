"use client";

import { ApiError } from "@peebee/shared";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api, PHARMACIST_KEY, PHARMACY_STORE_KEY, TOKEN_KEY } from "./api";

export interface PharmacistUser {
  id: string;
  name: string;
  /** Their role at the pharmacy: owner or manager. */
  role: string;
}

export interface PharmacyDetails {
  id: string;
  name: string;
  address: string;
  phone: string;
  /** The premises licence Peebee staff recorded when they approved this pharmacy. */
  ndaLicenseNumber: string;
  isOpen: boolean;
  acceptingPrescriptions: boolean;
}

interface AuthContextType {
  pharmacist: PharmacistUser | null;
  pharmacy: PharmacyDetails | null;
  ready: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  logout: () => void;
  toggleOpen: () => void;
  toggleAcceptingRx: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function clearSession() {
  navigator.serviceWorker?.controller?.postMessage("clear-runtime-cache");
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(PHARMACIST_KEY);
  localStorage.removeItem(PHARMACY_STORE_KEY);
}

/** Resolves the signed-in account to its approved pharmacy. Throws if the account isn't linked to one. */
async function resolveSession() {
  const me = await api.pharmacyMe();
  const pharmacist: PharmacistUser = { id: me.pharmacist.id, name: me.pharmacist.name, role: me.pharmacist.role };
  const pharmacy: PharmacyDetails = {
    id: me.pharmacy.id,
    name: me.pharmacy.name,
    address: me.pharmacy.address,
    phone: me.pharmacy.phone,
    ndaLicenseNumber: me.pharmacy.licenceNumber,
    isOpen: true,
    acceptingPrescriptions: true,
  };
  return { pharmacist, pharmacy };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [pharmacist, setPharmacist] = useState<PharmacistUser | null>(null);
  const [pharmacy, setPharmacy] = useState<PharmacyDetails | null>(null);
  const [ready, setReady] = useState(false);

  // On load, trust only the server: a stored token is checked, never a stored profile.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!localStorage.getItem(TOKEN_KEY)) return;
        const session = await resolveSession();
        if (cancelled) return;
        setPharmacist(session.pharmacist);
        setPharmacy(session.pharmacy);
      } catch (err) {
        // Signed out or not a pharmacy account: back to the sign-in screen.
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) clearSession();
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (identifier: string, password: string) => {
    const result = await api.login({ identifier: identifier.trim(), password });
    localStorage.setItem(TOKEN_KEY, result.token);
    try {
      const session = await resolveSession();
      setPharmacist(session.pharmacist);
      setPharmacy(session.pharmacy);
    } catch (err) {
      clearSession();
      if (err instanceof ApiError && err.status === 403) {
        throw new Error("This account isn't linked to an approved pharmacy. Ask Peebee support to link yours.");
      }
      throw err;
    }
  }, []);

  const logout = useCallback(() => {
    void api.logout().catch(() => undefined);
    clearSession();
    setPharmacist(null);
    setPharmacy(null);
  }, []);

  // Display-only for now: these are not yet sent to the server or applied to customers.
  const toggleOpen = useCallback(() => setPharmacy((prev) => (prev ? { ...prev, isOpen: !prev.isOpen } : prev)), []);
  const toggleAcceptingRx = useCallback(() => setPharmacy((prev) => (prev ? { ...prev, acceptingPrescriptions: !prev.acceptingPrescriptions } : prev)), []);

  return (
    <AuthContext.Provider value={{ pharmacist, pharmacy, ready, login, logout, toggleOpen, toggleAcceptingRx }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used within AuthProvider");
  return value;
}
