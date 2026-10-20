"use client";

import { useEffect } from "react";

/** Registers the offline-first service worker (see public/sw.js). */
export function ServiceWorkerRegister() {
  useEffect(() => {
    // Development chunks reuse URLs; caching them can mix incompatible builds.
    if (process.env.NODE_ENV === "development" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return null;
}
