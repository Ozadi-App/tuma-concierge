"use client";

import type { TalentConfig, TalentMe } from "@peebee/shared";
import { useCallback, useEffect, useState } from "react";
import { api } from "../../lib/api";
import { jobsFailure, type JobsFailure } from "./jobs-utils";

/** Loads what every Jobs screen needs: the admin's config and who I am here. */
export function useJobsConfig(opts: { needMe?: boolean } = {}) {
  const [config, setConfig] = useState<TalentConfig | null>(null);
  const [me, setMe] = useState<TalentMe | null>(null);
  const [failure, setFailure] = useState<JobsFailure | null>(null);

  const reload = useCallback(async () => {
    try {
      const c = await api.talentConfig();
      setConfig(c);
      if (!c.enabled) {
        setFailure({ message: "Peebee Hire isn't available right now.", topUp: false, pro: false, disabled: true, pending: false });
        return;
      }
      if (opts.needMe !== false) setMe(await api.talentMe());
      setFailure(null);
    } catch (err) {
      setFailure(jobsFailure(err));
    }
  }, [opts.needMe]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { config, me, failure, reload, ready: Boolean(config) && !failure };
}
