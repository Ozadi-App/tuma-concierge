"use client";

import { useEffect } from "react";
import { installNotificationSound } from "@peebee/shared";

// Replaces components/ServiceWorkerRegister in the mobile build: the app
// bundles its own files, so there is no service worker to register.
export function ServiceWorkerRegister() {
  useEffect(() => installNotificationSound(), []);
  return null;
}
