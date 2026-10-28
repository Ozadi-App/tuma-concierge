"use client";

import { CapacitorUpdater } from "@capgo/capacitor-updater";
import { useEffect } from "react";
import { installNotificationSound } from "@peebee/shared";

// Replaces components/ServiceWorkerRegister in the mobile build: the app
// bundles its own files, so there is no service worker to register.
//
// It also tells the over-the-air updater that this copy of the screens started.
// Without that call, a downloaded copy is treated as broken after a few seconds
// and the app goes back to the last copy that worked, so a bad update cannot
// stick. (Outside the phone app the call does nothing.)
export function ServiceWorkerRegister() {
  useEffect(() => installNotificationSound(), []);
  useEffect(() => {
    void CapacitorUpdater.notifyAppReady().catch(() => undefined);
  }, []);
  return null;
}
