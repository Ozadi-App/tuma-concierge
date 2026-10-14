"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { isModuleOn, isPathHidden, type ModuleKey, type ModuleSwitches } from "@peebee/shared";
import { api } from "./api";

type Ctx = {
  /** Null until the first answer arrives — treated as "everything on". */
  switches: ModuleSwitches | null;
  isOn: (key: ModuleKey) => boolean;
  isHidden: (pathname: string) => boolean;
};

const ModulesContext = createContext<Ctx>({ switches: null, isOn: () => true, isHidden: () => false });

const REFRESH_MS = 5 * 60 * 1000;

/** Which modules an admin has switched off (Admin → Settings → Modules), shared by the nav, home and page gate. */
export function ModulesProvider({ children }: { children: React.ReactNode }) {
  const [switches, setSwitches] = useState<ModuleSwitches | null>(null);
  useEffect(() => {
    let cancelled = false;
    const load = () =>
      api
        .getSettings()
        .then(({ settings }) => {
          if (!cancelled && settings.modules) setSwitches(settings.modules);
        })
        .catch(() => {});
    void load();
    const timer = setInterval(load, REFRESH_MS);
    const onVisible = () => document.visibilityState === "visible" && void load();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
  const value = useMemo<Ctx>(
    () => ({ switches, isOn: (key) => isModuleOn(switches, key), isHidden: (pathname) => isPathHidden(switches, pathname) }),
    [switches],
  );
  return <ModulesContext.Provider value={value}>{children}</ModulesContext.Provider>;
}

export function useModules() {
  return useContext(ModulesContext);
}
