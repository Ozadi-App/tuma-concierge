import type { LearnProStatus } from "@peebee/shared";
import { useCallback, useEffect, useState } from "react";
import { api } from "./api";

/** The signed-in educator's access to the TV classroom: free for everyone, or Pro only, as Admin has set it. */
export function useTvAccess(): { status: LearnProStatus | null; allowed: boolean; reload: () => Promise<void> } {
  const [status, setStatus] = useState<LearnProStatus | null>(null);
  const reload = useCallback(async () => {
    try {
      setStatus(await api.proStatus());
    } catch {
      /* not signed in, or the service is busy: leave the TV controls as they were */
    }
  }, []);
  useEffect(() => {
    void reload();
  }, [reload]);
  // Until we know, don't lock anything: the server is what actually enforces it.
  return { status, allowed: status ? status.tv.allowed : true, reload };
}
