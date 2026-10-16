"use client";

import { useEffect, useState } from "react";
import { api } from "./api";
import type { CartItem } from "./cart";
import { getCachedCustomerCoordinates } from "./location";

export type BagQuote = {
  deliveryFee: number;
  total: number;
  stores: Array<{ storeId: string; storeName: string; itemsTotal: number; deliveryFee: number }>;
  /** A long delivery from one store, relayed by matatu. */
  relay: BagRelay | null;
};

export type BagRelay = {
  routeName: string;
  dropMode: "stage" | "station";
  station: string | null;
  lastMile: "door" | "collect" | "pending";
  doorTotal: number;
  collectTotal: number | null;
  choiceAtOrder: boolean;
  /** Stages on the matatu's route where the customer may meet it instead (priced like collecting). */
  meetStages?: Array<{ id: string; name: string; distanceKm: number; isStation: boolean }>;
  legs: Array<{ leg: number; kind: "boda" | "matatu"; fromName: string; toName: string; fee: number }>;
};

/**
 * The exact delivery fee the server will charge for these items: one rider
 * trip through every store in the bag. Null while loading or after an error,
 * so checkout can stay off until the fee is known (never an estimate).
 */
export function useBagQuote(
  items: CartItem[],
  enabled: boolean,
  relayLastMile: "door" | "collect" | "meet" = "door",
  relayMeetStageId?: string,
) {
  const [quote, setQuote] = useState<{ key: string; base: string; value: BagQuote } | null>(null);
  const [failedKey, setFailedKey] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const coords = getCachedCustomerCoordinates();
  const lat = coords.lat || 0.3353;
  const lng = coords.lng || 32.5857;
  const base = `${lat},${lng}|${items.map((it) => `${it.storeId}:${it.productId}:${it.variantId ?? ""}:${it.price}x${it.quantity}`).join(",")}`;
  const meetStageId = relayLastMile === "meet" ? relayMeetStageId : undefined;
  const key = `${relayLastMile}:${meetStageId ?? ""}|${base}`;

  useEffect(() => {
    if (!enabled || items.length === 0) return;
    let cancelled = false;
    setFailedKey(null);
    api
      .quoteMarketplaceCheckout({
        items: items.map((it) => ({
          productId: it.productId, storeId: it.storeId, title: it.title, price: it.price, quantity: it.quantity,
          variantId: it.variantId, variantTitle: it.variantTitle,
        })),
        destinationLat: lat,
        destinationLng: lng,
        relayLastMile,
        relayMeetStageId: meetStageId,
      })
      .then((res) => {
        if (!cancelled) setQuote({ key, base, value: { deliveryFee: res.deliveryFee, total: res.total, stores: res.stores, relay: res.relay ?? null } });
      })
      .catch(() => {
        if (!cancelled) setFailedKey(key);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled, retry]);

  const current = quote?.key === key ? quote.value : null;
  return {
    quote: current,
    /** The latest relay plan, kept while a new door/collect quote loads so the choice doesn't flicker. */
    relay: current ? current.relay : quote?.base === base ? quote.value.relay : null,
    loading: enabled && items.length > 0 && !current && failedKey !== key,
    failed: failedKey === key && !current,
    retry: () => setRetry((n) => n + 1),
  };
}
