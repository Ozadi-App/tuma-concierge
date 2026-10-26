"use client";

import { useEffect, useState, type ReactNode } from "react";
import StorefrontClient from "./storefront/StorefrontClient";

const RESERVED_SUBDOMAINS = new Set([
  "www",
  "app",
  "customer",
  "rider",
  "merchant",
  "admin",
  "api",
  "food",
  "gas",
  "pharmacy",
  "partner",
  "sales",
  "work",
  "learn",
  "tv",
  "preview",
  "stores",
  "portal",
]);

/**
 * Detects when `apps/web` is accessed on a merchant's dedicated subdomain
 * (`[store-name].peebee.online`) or a custom merchant domain (e.g. `shop.brand.ug`)
 * and renders that store's Dedicated Storefront 2.0 experience.
 * On `peebee.online` / `www.peebee.online`, renders the normal Peebee marketing home.
 */
export function StorefrontHostGateway({ children }: { children: ReactNode }) {
  const [storeHostSlug, setStoreHostSlug] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const host = window.location.hostname.toLowerCase();
    const params = new URLSearchParams(window.location.search);
    const queryStore = params.get("storefront");
    if (queryStore) {
      setStoreHostSlug(queryStore);
      return;
    }
    if (host === "stores.peebee.online") {
      // The merchant sign-up site. The server normally rewrites this host to /portal; this covers the case where it didn't.
      window.location.replace("/portal");
      return;
    }
    if (host === "localhost" || host === "127.0.0.1" || host === "peebee.online" || host === "www.peebee.online") {
      return;
    }
    if (host.endsWith(".peebee.online")) {
      const sub = host.slice(0, -".peebee.online".length);
      if (sub && !sub.includes(".") && !RESERVED_SUBDOMAINS.has(sub)) {
        setStoreHostSlug(sub);
      }
      return;
    }
    if (!host.endsWith(".workers.dev") && !host.endsWith(".pages.dev")) {
      // Custom domain connected by an Elite merchant (e.g., shop.kampalaboutique.ug)
      setStoreHostSlug(host);
    }
  }, []);

  if (storeHostSlug) {
    return <StorefrontClient overrideSlug={storeHostSlug} />;
  }

  return <>{children}</>;
}
