"use client";

import type { MyChannelResponse } from "@peebee/shared";
import { useCallback, useEffect, useState } from "react";
import { api, errorMessage } from "../../lib/api";

/** The signed-in person's channel, their publishing identities, and the current rules. */
export function useMyChannel() {
  const [data, setData] = useState<MyChannelResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    try {
      setData(await api.myChannel());
      setError(null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void reload(); }, [reload]);
  return { data, channel: data?.channel ?? null, config: data?.config ?? null, identities: data?.identities ?? [], error, loading, reload };
}
