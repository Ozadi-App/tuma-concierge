"use client";

import { normalizeStream, type AuthUser, type EducationStream } from "@peebee/shared";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, TOKEN_KEY } from "./api";

const STREAM_KEY = "peebee_learn_stream";

interface LearnAuthContextType {
  user: AuthUser | null;
  /** The stream the educator is working in; remembered between visits. */
  activeStream: EducationStream;
  setActiveStream: (stream: EducationStream) => void;
  ready: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  register: (input: { name: string; phone?: string; email?: string; password: string }) => Promise<void>;
  /** Signs in with an already-issued token (Google sign-in, password reset). */
  setSession: (token: string, user: AuthUser) => Promise<void>;
  /** Swaps in a fresh copy of the user (e.g. after their phone or email is verified). */
  updateUser: (user: AuthUser) => void;
  logout: () => void;
}

const LearnAuthContext = createContext<LearnAuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [activeStream, setStream] = useState<EducationStream>("foundations");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stored = localStorage.getItem(STREAM_KEY);
        // Older builds saved "campus", which is now "compass".
        if (stored && !cancelled) setStream(normalizeStream(stored));
        if (!localStorage.getItem(TOKEN_KEY)) return;
        const me = await api.me();
        if (!cancelled) setUser(me.user);
      } catch {
        /* a bad or expired token is cleared by the client; the shell sends them to sign in */
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setActiveStream = useCallback((stream: EducationStream) => {
    setStream(stream);
    try {
      localStorage.setItem(STREAM_KEY, stream);
    } catch {
      /* private mode */
    }
  }, []);

  const setSession = useCallback(async (token: string, next: AuthUser) => {
    localStorage.setItem(TOKEN_KEY, token);
    setUser(next);
  }, []);

  const login = useCallback(
    async (identifier: string, password: string) => {
      const res = await api.login({ identifier: identifier.trim(), password });
      if (res.user.role === "admin") {
        throw new Error("Staff accounts can't use Peebee Learn. Sign in with a personal account.");
      }
      await setSession(res.token, res.user);
    },
    [setSession],
  );

  const register = useCallback(
    async (input: { name: string; phone?: string; email?: string; password: string }) => {
      const res = await api.register({ ...input, role: "customer" });
      await setSession(res.token, res.user);
    },
    [setSession],
  );

  const logout = useCallback(() => {
    void api.logout().catch(() => undefined);
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* private mode */
    }
    setUser(null);
  }, []);

  const updateUser = useCallback((next: AuthUser) => setUser(next), []);

  const value = useMemo<LearnAuthContextType>(
    () => ({ user, activeStream, setActiveStream, ready, login, register, setSession, updateUser, logout }),
    [user, activeStream, setActiveStream, ready, login, register, setSession, updateUser, logout],
  );
  return <LearnAuthContext.Provider value={value}>{children}</LearnAuthContext.Provider>;
}

export function useLearnAuth() {
  const ctx = useContext(LearnAuthContext);
  if (!ctx) throw new Error("useLearnAuth must be used within an AuthProvider");
  return ctx;
}

/** The name the shared sign-in components expect. */
export const useAuth = useLearnAuth;
