"use client";

import { useEffect, useState } from "react";

/** True while a re-render of the screen could disturb the person using it. */
function userIsBusy(): boolean {
  if (document.visibilityState !== "visible") return true;
  const el = document.activeElement as HTMLElement | null;
  if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return true;
  return !!document.querySelector('[role="dialog"], [aria-modal="true"]');
}

/**
 * Apps show saved pages and data first (see each app's public/sw.js) and the
 * service worker then checks the server. When the server's copy of some data
 * differs, the worker says so and this reloads the current screen so it shows
 * the new data — but never while the person is typing or has a dialog open.
 */
export function DataRefresh({ children }: { children: unknown }) {
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    function attempt() {
      if (userIsBusy()) {
        timer = setTimeout(attempt, 3000);
        return;
      }
      setVersion((n) => n + 1);
    }
    function onMessage(e: MessageEvent) {
      if (e.data?.type !== "peebee-data-updated") return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(attempt, 1500);
    }
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => {
      navigator.serviceWorker.removeEventListener("message", onMessage);
      if (timer) clearTimeout(timer);
    };
  }, []);

  return <div key={version} style={{ display: "contents" }}>{children as never}</div>;
}
