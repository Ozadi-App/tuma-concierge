"use client";

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import type { AuthUser, EducationStream } from "@peebee/shared";
import { api, TOKEN_KEY } from "./api";

interface LearnAuthContextType {
  user: AuthUser | null;
  activeStream: EducationStream;
  setActiveStream: (stream: EducationStream) => void;
  ready: boolean;
  login: (token: string, user: AuthUser) => void;
  logout: () => void;
}

const DEFAULT_DEMO_USER: AuthUser = {
  id: "usr_student_demo",
  accountCode: "PB-STU-001",
  name: "Denis Kigozi",
  email: "denis.kigozi@peebee.online",
  phone: "+256 701 234 567",
  role: "customer",
  status: "active",
  emailVerifiedAt: "2026-01-01T00:00:00.000Z",
  phoneVerifiedAt: "2026-01-01T00:00:00.000Z",
  defaultMatchingMode: "first_to_claim",
  passwordSet: true,
  adminRole: null,
  forcePasswordChange: false,
  hasProfilePhoto: false,
};

const LearnAuthContext = createContext<LearnAuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(DEFAULT_DEMO_USER);
  const [activeStream, setActiveStream] = useState<EducationStream>("campus");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const storedToken = localStorage.getItem(TOKEN_KEY);
      const storedStream = localStorage.getItem("peebee_learn_stream") as EducationStream;
      if (storedStream) {
        setActiveStream(storedStream);
      }
      if (storedToken) {
        api.me().then((res) => {
          if (res?.user) setUser(res.user);
        }).catch(() => {
          // Keep demo user
        });
      }
    } catch {
      // Ignore
    } finally {
      setReady(true);
    }
  }, []);

  const handleSetStream = (stream: EducationStream) => {
    setActiveStream(stream);
    try {
      localStorage.setItem("peebee_learn_stream", stream);
    } catch {}
  };

  const login = (token: string, newUser: AuthUser) => {
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {}
    setUser(newUser);
  };

  const logout = () => {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {}
    setUser(DEFAULT_DEMO_USER);
  };

  return (
    <LearnAuthContext.Provider
      value={{
        user,
        activeStream,
        setActiveStream: handleSetStream,
        ready,
        login,
        logout,
      }}
    >
      {children}
    </LearnAuthContext.Provider>
  );
}

export function useLearnAuth() {
  const ctx = useContext(LearnAuthContext);
  if (!ctx) throw new Error("useLearnAuth must be used within an AuthProvider");
  return ctx;
}
