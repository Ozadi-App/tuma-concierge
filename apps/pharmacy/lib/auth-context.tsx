"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  api,
  PHARMACIST_KEY,
  PHARMACY_STORE_KEY,
  TOKEN_KEY,
  errorMessage,
} from "./api";

export interface PharmacistUser {
  id: string;
  name: string;
  phone: string;
  role: "supervising_pharmacist" | "pharmacist" | "dispenser";
  aplNumber: string;
}

export interface PharmacyDetails {
  id: string;
  name: string;
  slug: string;
  address: string;
  phone: string;
  ndaLicenseNumber: string;
  isNdaVerified: boolean;
  isOpen: boolean;
  acceptingPrescriptions: boolean;
  minOrderAmount: number;
}

interface AuthContextType {
  pharmacist: PharmacistUser | null;
  pharmacy: PharmacyDetails | null;
  ready: boolean;
  login: (phone: string, pin: string) => Promise<void>;
  logout: () => void;
  toggleOpen: () => void;
  toggleAcceptingRx: () => void;
}

const DEFAULT_PHARMACIST: PharmacistUser = {
  id: "pharm_sarah",
  name: "Dr. Sarah Namubiru, BPharm, MPS",
  phone: "+256 772 110 220",
  role: "supervising_pharmacist",
  aplNumber: "NDA/APL/2026/0418",
};

const DEFAULT_PHARMACY: PharmacyDetails = {
  id: "store_demo_vine_pharmacy",
  name: "Vine Pharmacy — Acacia Mall",
  slug: "vine-pharmacy-acacia",
  address: "Acacia Mall, Ground Floor, Kisementi, Kololo",
  phone: "+256 772 110 220",
  ndaLicenseNumber: "NDA/PREM/KLA/2026/0418",
  isNdaVerified: true,
  isOpen: true,
  acceptingPrescriptions: true,
  minOrderAmount: 5000,
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: any }) {
  const [pharmacist, setPharmacist] = useState<PharmacistUser | null>(null);
  const [pharmacy, setPharmacy] = useState<PharmacyDetails | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const storedPharmacist = localStorage.getItem(PHARMACIST_KEY);
      const storedPharmacy = localStorage.getItem(PHARMACY_STORE_KEY);

      if (storedPharmacist && storedPharmacy) {
        setPharmacist(JSON.parse(storedPharmacist));
        setPharmacy(JSON.parse(storedPharmacy));
      } else {
        // Default demo session for immediate readiness
        setPharmacist(DEFAULT_PHARMACIST);
        setPharmacy(DEFAULT_PHARMACY);
      }
    } catch {
      setPharmacist(DEFAULT_PHARMACIST);
      setPharmacy(DEFAULT_PHARMACY);
    } finally {
      setReady(true);
    }
  }, []);

  const login = useCallback(async (phone: string, pin: string) => {
    // Demo login implementation
    setPharmacist(DEFAULT_PHARMACIST);
    setPharmacy(DEFAULT_PHARMACY);
    localStorage.setItem(PHARMACIST_KEY, JSON.stringify(DEFAULT_PHARMACIST));
    localStorage.setItem(PHARMACY_STORE_KEY, JSON.stringify(DEFAULT_PHARMACY));
    localStorage.setItem(TOKEN_KEY, "demo_pharmacy_token");
  }, []);

  const logout = useCallback(() => {
    setPharmacist(null);
    setPharmacy(null);
    localStorage.removeItem(PHARMACIST_KEY);
    localStorage.removeItem(PHARMACY_STORE_KEY);
    localStorage.removeItem(TOKEN_KEY);
  }, []);

  const toggleOpen = useCallback(() => {
    setPharmacy((prev) => {
      if (!prev) return null;
      const updated = { ...prev, isOpen: !prev.isOpen };
      localStorage.setItem(PHARMACY_STORE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const toggleAcceptingRx = useCallback(() => {
    setPharmacy((prev) => {
      if (!prev) return null;
      const updated = { ...prev, acceptingPrescriptions: !prev.acceptingPrescriptions };
      localStorage.setItem(PHARMACY_STORE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  return (
    <AuthContext.Provider
      value={{
        pharmacist,
        pharmacy,
        ready,
        login,
        logout,
        toggleOpen,
        toggleAcceptingRx,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
