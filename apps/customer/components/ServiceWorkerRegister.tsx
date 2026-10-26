"use client";

import { useEffect } from "react";
import { installNotificationSound } from "@peebee/shared";

export function ServiceWorkerRegister() {
  useEffect(() => {
    const stopSound = installNotificationSound();
    // Development chunks reuse URLs; caching them can mix incompatible builds.
    if (process.env.NODE_ENV !== "development" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
    // The service worker shows saved data instantly and checks the server in
    // the background; when the server copy differs it says so here, and live
    // screens (see useLivePolling) reload that one piece of data.
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === "peebee-data-updated") window.dispatchEvent(new CustomEvent("peebee:data-updated"));
    };
    navigator.serviceWorker?.addEventListener("message", onMessage);
    // A new version of the app took over while this screen was open: reload once so the screen and its code are the same build.
    const hadController = Boolean(navigator.serviceWorker?.controller);
    const onController = () => {
      if (!hadController) return;
      try {
        if (window.sessionStorage.getItem("peebee-sw-reloaded") === "1") return;
        window.sessionStorage.setItem("peebee-sw-reloaded", "1");
      } catch { /* storage blocked: reload anyway, once, because the listener is removed below */ }
      navigator.serviceWorker?.removeEventListener("controllerchange", onController);
      window.location.reload();
    };
    navigator.serviceWorker?.addEventListener("controllerchange", onController);
    return () => {
      stopSound();
      navigator.serviceWorker?.removeEventListener("message", onMessage);
      navigator.serviceWorker?.removeEventListener("controllerchange", onController);
    };
  }, []);
  return null;
}
