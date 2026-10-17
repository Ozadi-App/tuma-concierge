"use client";

import { useCallback, useEffect, useState } from "react";
import { currentLocationPlace, type Place } from "./places";
import { getStoredCustomerCoordinates } from "./location";

const KEY = "peebee-bag-delivery-place";
const EVENT = "peebee-bag-delivery-place";

function validPlace(value: unknown): Place | null {
  const p = value as Partial<Place> | null;
  if (!p || typeof p.lat !== "number" || typeof p.lng !== "number" || !Number.isFinite(p.lat) || !Number.isFinite(p.lng)) return null;
  return {
    label: typeof p.label === "string" && p.label.trim() ? p.label : "Delivery location",
    area: typeof p.area === "string" ? p.area : null,
    address: typeof p.address === "string" ? p.address : null,
    lat: p.lat,
    lng: p.lng,
  };
}

/** The last place this device chose for bag deliveries. */
export function readBagDeliveryPlace(): Place | null {
  try {
    return validPlace(JSON.parse(localStorage.getItem(KEY) ?? "null"));
  } catch {
    return null;
  }
}

function saveBagDeliveryPlace(place: Place) {
  try {
    localStorage.setItem(KEY, JSON.stringify(place));
  } catch {}
}

/** The phone's real last position, when known. Never a made-up default. */
function phonePlace(): Place | null {
  const current = currentLocationPlace();
  if (current) return current;
  const coords = getStoredCustomerCoordinates();
  return coords ? { label: "Current location", area: null, address: null, lat: coords.lat, lng: coords.lng } : null;
}

/**
 * Where the bag is delivered: the place last chosen on the map, else the
 * phone's real last position, else nothing (the customer must choose).
 * `ready` is false until the device has been read, so nothing is quoted early.
 */
export function useBagDeliveryPlace() {
  const [place, setPlace] = useState<Place | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setPlace(readBagDeliveryPlace() ?? phonePlace());
    setReady(true);
    // Keep the bag drawer and the cart page on the same place.
    const sync = () => {
      const saved = readBagDeliveryPlace();
      if (saved) setPlace(saved);
    };
    window.addEventListener(EVENT, sync);
    return () => window.removeEventListener(EVENT, sync);
  }, []);

  const choose = useCallback((next: Place) => {
    const valid = validPlace(next);
    if (!valid) return;
    setPlace(valid);
    saveBagDeliveryPlace(valid);
    try {
      window.dispatchEvent(new Event(EVENT));
    } catch {}
  }, []);

  return { place, ready, choose };
}

/** The destination fields a bag checkout sends for a place. */
export function bagDestinationFields(place: Place) {
  return {
    destinationAddress: place.address?.trim() || place.label,
    destinationArea: place.area ?? undefined,
    destinationLat: place.lat as number,
    destinationLng: place.lng as number,
  };
}
