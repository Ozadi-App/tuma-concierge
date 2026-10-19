"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { SECRET_KEY, TvAuthError, tvApi } from "./api";

export type DeviceState =
  | { phase: "starting" }
  | { phase: "pairing"; code: string | null; expiresInSeconds: number }
  | { phase: "paired"; name: string; ownerName: string };

type Ctx = {
  state: DeviceState;
  secret: string | null;
  /** True while the TV can't reach Peebee. It keeps trying by itself. */
  offline: boolean;
  pollSeconds: number;
  /** Forget this TV and show a fresh pairing code. */
  unpair: () => Promise<void>;
  /** A page that learns the TV is no longer registered calls this. */
  lost: () => void;
};

const DeviceContext = createContext<Ctx | null>(null);

const read = () => {
  try {
    return window.localStorage.getItem(SECRET_KEY);
  } catch {
    return null;
  }
};
const write = (value: string | null) => {
  try {
    if (value) window.localStorage.setItem(SECRET_KEY, value);
    else window.localStorage.removeItem(SECRET_KEY);
  } catch {
    /* private mode: the TV just pairs again next time */
  }
};

/** Owns the TV's identity: gets a pairing code on first run, then waits to be claimed, then stays paired. */
export function DeviceProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DeviceState>({ phase: "starting" });
  const [secret, setSecret] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [pollSeconds, setPollSeconds] = useState(3);
  const secretRef = useRef<string | null>(null);

  const reset = useCallback(() => {
    write(null);
    secretRef.current = null;
    setSecret(null);
    setState({ phase: "starting" });
  }, []);

  // Get an identity if there isn't one.
  useEffect(() => {
    if (secret) return;
    let cancelled = false;
    const existing = read();
    if (existing) {
      secretRef.current = existing;
      setSecret(existing);
      return;
    }
    const attempt = async () => {
      try {
        const started = await tvApi.start();
        if (cancelled) return;
        write(started.secret);
        secretRef.current = started.secret;
        setSecret(started.secret);
        setPollSeconds(started.pollSeconds);
        setState({ phase: "pairing", code: started.code, expiresInSeconds: started.expiresInSeconds });
        setOffline(false);
      } catch {
        if (cancelled) return;
        setOffline(true);
        setTimeout(attempt, 4000);
      }
    };
    void attempt();
    return () => {
      cancelled = true;
    };
  }, [secret]);

  // Ask who we are, again and again: this is how the TV notices it has been paired.
  useEffect(() => {
    if (!secret) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      try {
        const me = await tvApi.me(secret);
        if (cancelled) return;
        setOffline(false);
        setPollSeconds(me.pollSeconds);
        setState(me.status === "paired" ? { phase: "paired", name: me.name, ownerName: me.ownerName } : { phase: "pairing", code: me.code, expiresInSeconds: me.expiresInSeconds });
        timer = setTimeout(tick, Math.max(2, me.pollSeconds) * 1000);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof TvAuthError) return reset();
        setOffline(true);
        timer = setTimeout(tick, 4000);
      }
    };
    void tick();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [secret, reset]);

  const unpair = useCallback(async () => {
    const current = secretRef.current;
    if (current) await tvApi.unpair(current).catch(() => undefined);
    reset();
  }, [reset]);

  const value = useMemo<Ctx>(() => ({ state, secret, offline, pollSeconds, unpair, lost: reset }), [state, secret, offline, pollSeconds, unpair, reset]);
  return <DeviceContext.Provider value={value}>{children}</DeviceContext.Provider>;
}

export function useDevice(): Ctx {
  const ctx = useContext(DeviceContext);
  if (!ctx) throw new Error("useDevice must be used inside DeviceProvider");
  return ctx;
}
