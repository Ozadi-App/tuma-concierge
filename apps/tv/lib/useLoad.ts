"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { TvAuthError } from "./api";
import { useDevice } from "./device";

/** Loads something from the API for a screen, again whenever `deps` change or `reload` is called. A TV that has been unlinked is sent back to pairing. */
export function useLoad<T>(load: (secret: string) => Promise<T>, deps: unknown[]): { data: T | null; error: Error | null; loading: boolean; reload: () => void } {
  const { secret, lost } = useDevice();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);
  const run = useRef(0);
  const loader = useRef(load);
  loader.current = load;

  const fetchNow = useCallback(() => {
    if (!secret) return;
    const mine = ++run.current;
    setLoading(true);
    loader
      .current(secret)
      .then((value) => {
        if (mine !== run.current) return;
        setData(value);
        setError(null);
      })
      .catch((err: unknown) => {
        if (mine !== run.current) return;
        if (err instanceof TvAuthError) return lost();
        setError(err instanceof Error ? err : new Error("Something went wrong."));
      })
      .finally(() => {
        if (mine === run.current) setLoading(false);
      });
  }, [secret, lost]);

  useEffect(() => {
    fetchNow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchNow, ...deps]);

  return { data, error, loading, reload: fetchNow };
}
