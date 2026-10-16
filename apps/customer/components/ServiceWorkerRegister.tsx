"use client";

import { useEffect } from "react";
import { installNotificationSound } from "@peebee/shared";

export function ServiceWorkerRegister() {
  useEffect(() => {
    const stopSound = installNotificationSound();
    // Development chunks reuse URLs; caching them can mix incompatible builds.
    // The native app bundles its own files, so there is nothing for a worker to cache.
    if (process.env.NEXT_PUBLIC_NATIVE !== "1" && process.env.NODE_ENV !== "development" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
    return stopSound;
  }, []);
  return null;
}
