"use client";

import { DEFAULT_HOME_MENU, resolveHomeMenu, type HomeMenuSettings } from "@peebee/shared";
import { useEffect, useState } from "react";
import { api } from "./api";

let cached: { at: number; value: HomeMenuSettings } | null = null;
let inflight: Promise<HomeMenuSettings> | null = null;

function load(): Promise<HomeMenuSettings> {
  if (cached && Date.now() - cached.at < 60_000) return Promise.resolve(cached.value);
  inflight ??= api
    .getSettings()
    .then((res) => {
      const value = resolveHomeMenu(res.settings.homeMenu);
      cached = { at: Date.now(), value };
      return value;
    })
    .catch(() => cached?.value ?? DEFAULT_HOME_MENU)
    .finally(() => { inflight = null; });
  return inflight;
}

/** What the main menu calls things and which Hive shortcuts are on. Admin-edited; the built-in names show until it loads or if it can't. */
export function useHomeMenu(): HomeMenuSettings {
  const [menu, setMenu] = useState<HomeMenuSettings>(cached?.value ?? DEFAULT_HOME_MENU);
  useEffect(() => {
    let live = true;
    void load().then((v) => { if (live) setMenu(v); });
    return () => { live = false; };
  }, []);
  return menu;
}

let hireCached: { at: number; value: boolean } | null = null;
let hireInflight: Promise<boolean> | null = null;

function loadHire(): Promise<boolean> {
  if (hireCached && Date.now() - hireCached.at < 60_000) return Promise.resolve(hireCached.value);
  hireInflight ??= api
    .talentConfig()
    .then((cfg) => {
      hireCached = { at: Date.now(), value: Boolean(cfg.enabled) };
      return hireCached.value;
    })
    // Switched off, not set up yet, or the call failed: leave Hire out rather than send people to a dead end.
    .catch(() => false)
    .finally(() => { hireInflight = null; });
  return hireInflight;
}

/** Whether the Hire marketplace is on for customers right now. */
export function useHireAvailable(): boolean {
  const [on, setOn] = useState<boolean>(hireCached?.value ?? false);
  useEffect(() => {
    let live = true;
    void loadHire().then((v) => { if (live) setOn(v); });
    return () => { live = false; };
  }, []);
  return on;
}
