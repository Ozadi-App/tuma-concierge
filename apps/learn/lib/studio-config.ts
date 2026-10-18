import { DEFAULT_LEARN_SETTINGS, type LearnSettings } from "@peebee/shared";
import { useEffect, useState } from "react";
import { api } from "./api";

let cache: { at: number; settings: LearnSettings } | null = null;

/** The Studio's limits and switches, as Admin has set them. Falls back to the defaults while loading. */
export function useStudioSettings(): LearnSettings {
  const [settings, setSettings] = useState<LearnSettings>(cache?.settings ?? DEFAULT_LEARN_SETTINGS);
  useEffect(() => {
    if (cache && Date.now() - cache.at < 60_000) return;
    let cancelled = false;
    api
      .studioConfig()
      .then((res) => {
        cache = { at: Date.now(), settings: res.settings };
        if (!cancelled) setSettings(res.settings);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);
  return settings;
}
