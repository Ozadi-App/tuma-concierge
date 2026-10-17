"use client";

import { useEffect, useState } from "react";
import { haversineKm } from "@peebee/shared";

export { haversineKm };

export const KAMPALA_DEFAULT_COORDINATES = {
  lat: 0.3353,
  lng: 32.5857,
  label: "Kololo / Kampala",
};

const CACHE_KEY = "peebee-customer-coordinates";
const LOCATION_LABEL_CACHE = "peebee-location-label";

export interface CustomerCoordinates {
  lat: number;
  lng: number;
  label?: string;
}

export function getCachedCustomerCoordinates(): CustomerCoordinates {
  if (typeof window === "undefined") {
    return KAMPALA_DEFAULT_COORDINATES;
  }
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed?.lat === "number" && typeof parsed?.lng === "number") {
        return parsed;
      }
    }
    const labelRaw = localStorage.getItem(LOCATION_LABEL_CACHE);
    if (labelRaw) {
      const parsedLabel = JSON.parse(labelRaw);
      if (typeof parsedLabel?.lat === "number" && typeof parsedLabel?.lng === "number") {
        return {
          lat: parsedLabel.lat,
          lng: parsedLabel.lng,
          label: parsedLabel.label || KAMPALA_DEFAULT_COORDINATES.label,
        };
      }
    }
  } catch {}
  return KAMPALA_DEFAULT_COORDINATES;
}

/**
 * Where the phone really last put the customer, or null when nothing is known.
 * Unlike getCachedCustomerCoordinates there is no Kololo fallback, so a price
 * can never be worked out for a place the customer isn't.
 */
export function getStoredCustomerCoordinates(): { lat: number; lng: number } | null {
  if (typeof window === "undefined") return null;
  for (const key of [LOCATION_LABEL_CACHE, CACHE_KEY]) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key) ?? "null");
      if (typeof parsed?.lat === "number" && typeof parsed?.lng === "number" && Number.isFinite(parsed.lat) && Number.isFinite(parsed.lng)) {
        return { lat: parsed.lat, lng: parsed.lng };
      }
    } catch {}
  }
  return null;
}

export function setCachedCustomerCoordinates(coords: CustomerCoordinates): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(coords));
  } catch {}
}

export function formatDistanceKm(km: number | null | undefined): string {
  if (km == null || isNaN(km)) return "";
  if (km < 1) {
    const meters = Math.max(50, Math.round(km * 1000));
    return `${meters} m away`;
  }
  return `${km.toFixed(1)} km away`;
}

export function useCustomerLocation() {
  const [coords, setCoords] = useState<CustomerCoordinates>(getCachedCustomerCoordinates);
  const [isLocating, setIsLocating] = useState(false);

  useEffect(() => {
    // Initial sync with cache
    const initial = getCachedCustomerCoordinates();
    setCoords(initial);

    if (typeof window === "undefined" || !navigator.geolocation) {
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next: CustomerCoordinates = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          label: initial.label || KAMPALA_DEFAULT_COORDINATES.label,
        };
        setCoords(next);
        setCachedCustomerCoordinates(next);
        setIsLocating(false);
      },
      () => {
        setIsLocating(false);
      },
      { timeout: 8000, maximumAge: 300000 },
    );
  }, []);

  return {
    lat: coords.lat,
    lng: coords.lng,
    label: coords.label || "Kampala",
    isLocating,
  };
}
