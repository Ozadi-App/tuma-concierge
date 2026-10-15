"use client";

import { ApiError, type AuthUser, type WorkProviderProfile } from "@peebee/shared";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, TOKEN_KEY } from "./api";

interface AuthContextType {
  user: AuthUser | null;
  /** null when the account hasn't registered as a provider yet. */
  provider: WorkProviderProfile | null;
  canWork: boolean;
  /** True for the account owner; company staff only see jobs assigned to them. */
  isOwner: boolean;
  ready: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  signUp: (input: { name: string; phone?: string; email?: string; password: string }) => Promise<void>;
  /** Same as signUp — the name the shared login screen uses. */
  register: (input: { name: string; phone?: string; email?: string; password: string }) => Promise<void>;
  /** Signs in with an already-issued token (Google sign-in, password reset). */
  setSession: (token: string, user: AuthUser) => Promise<void>;
  /** Swaps in a fresh copy of the user (e.g. after their phone or email is verified). */
  updateUser: (user: AuthUser) => void;
  refreshProvider: () => Promise<void>;
  setProvider: (p: WorkProviderProfile) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [provider, setProviderState] = useState<WorkProviderProfile | null>(null);
  const [canWork, setCanWork] = useState(false);
  const [ready, setReady] = useState(false);

  const loadProvider = useCallback(async () => {
    try {
      const res = await api.workProviderMe();
      setProviderState(res.provider);
      setCanWork(res.canWork);
    } catch (err) {
      // "Not a provider yet" is a normal state, not an error.
      if (err instanceof ApiError && err.status === 404) {
        setProviderState(null);
        setCanWork(false);
      } else {
        throw err;
      }
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!localStorage.getItem(TOKEN_KEY)) return;
        const me = await api.me();
        if (cancelled) return;
        setUser(me.user);
        await loadProvider();
      } catch {
        /* a bad or expired token is cleared by the client; the shell sends them to sign in */
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadProvider]);

  const finishSignIn = useCallback(
    async (token: string, next: AuthUser) => {
      localStorage.setItem(TOKEN_KEY, token);
      // Provider first, then the user: the shell routes on both, and setting
      // the user alone would bounce a returning provider through /onboard.
      try {
        await loadProvider();
      } finally {
        setUser(next);
      }
    },
    [loadProvider],
  );

  const login = useCallback(
    async (identifier: string, password: string) => {
      const res = await api.login({ identifier: identifier.trim(), password });
      if (res.user.role === "admin") {
        throw new Error("Staff accounts can't use Peebee Work. Sign in with a provider account.");
      }
      await finishSignIn(res.token, res.user);
    },
    [finishSignIn],
  );

  const signUp = useCallback(
    async (input: { name: string; phone?: string; email?: string; password: string }) => {
      const res = await api.register({ ...input, role: "customer" });
      await finishSignIn(res.token, res.user);
    },
    [finishSignIn],
  );

  const logout = useCallback(() => {
    void api.logout().catch(() => undefined);
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* private mode */
    }
    setUser(null);
    setProviderState(null);
    setCanWork(false);
  }, []);

  const updateUser = useCallback((next: AuthUser) => setUser(next), []);

  const setProvider = useCallback((p: WorkProviderProfile) => setProviderState(p), []);

  const value = useMemo<AuthContextType>(
    () => ({
      user, provider, canWork, isOwner: provider?.role === "owner", ready, login, signUp, register: signUp,
      setSession: finishSignIn, updateUser, refreshProvider: loadProvider, setProvider, logout,
    }),
    [user, provider, canWork, ready, login, signUp, finishSignIn, updateUser, loadProvider, setProvider, logout],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used within AuthProvider");
  return value;
}
