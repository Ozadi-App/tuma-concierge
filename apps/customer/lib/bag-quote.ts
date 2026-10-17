"use client";

import { useEffect, useState } from "react";
import type { BagTrip } from "@peebee/shared";
import { api } from "./api";
import type { CartItem } from "./cart";

export type BagDeliveryMode = "rider" | "relay";

export type BagQuote = {
  itemsTotal: number;
  deliveryFee: number;
  total: number;
  /** The way this quote delivers. */
  deliveryMode: BagDeliveryMode;
  /** The delivery fee each way; `relay` is null when no relay is offered. */
  options: { rider: number; relay: number | null };
  stores: Array<{ storeId: string; storeName: string; itemsTotal: number; deliveryFee: number }>;
  /** One rider's whole road trip, store to store and then to the customer. */
  trip: BagTrip | null;
  /** A long trip by matatu relay: the first rider collects from every store. */
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
  meetStage?: string | null;
  legs: Array<{ leg: number; kind: "boda" | "matatu"; fromName: string; toName: string; distanceKm?: number; fee: number }>;
};

export type BagQuoteInput = {
  enabled: boolean;
  /** Where the bag goes. Nothing is quoted without it (never a default place). */
  destination: { lat: number; lng: number } | null;
  /** The customer's choice; undefined lets the server pick (relay when offered). */
  deliveryMode?: BagDeliveryMode;
  relayLastMile?: "door" | "collect" | "meet";
  relayMeetStageId?: string;
};

/**
 * The exact delivery fee the server will charge for these items, to this
 * place, the chosen way. `quote` is null while loading or after an error, so
 * checkout stays off until the fee for the current choices is known (never an estimate).
 */
export function useBagQuote(items: CartItem[], input: BagQuoteInput) {
  const { enabled, destination, deliveryMode, relayLastMile = "door", relayMeetStageId } = input;
  const [quote, setQuote] = useState<{ key: string; base: string; value: BagQuote } | null>(null);
  const [failedKey, setFailedKey] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const lat = destination?.lat;
  const lng = destination?.lng;
  const located = lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng);
  const base = `${located ? `${lat},${lng}` : "none"}|${items.map((it) => `${it.storeId}:${it.productId}:${it.variantId ?? ""}:${it.price}x${it.quantity}`).join(",")}`;
  const meetStageId = relayLastMile === "meet" ? relayMeetStageId : undefined;
  const key = `${deliveryMode ?? "auto"}:${relayLastMile}:${meetStageId ?? ""}|${base}`;
  const active = enabled && located && items.length > 0;

  useEffect(() => {
    if (!active) return;
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
        deliveryMode,
      })
      .then((res) => {
        if (cancelled) return;
        const relay = res.relay ?? null;
        const mode: BagDeliveryMode = res.deliveryMode ?? (relay && deliveryMode !== "rider" ? "relay" : "rider");
        setQuote({
          key,
          base,
          value: {
            itemsTotal: res.itemsTotal,
            deliveryFee: res.deliveryFee,
            total: res.total,
            deliveryMode: mode,
            options: res.options ?? { rider: res.deliveryFee, relay: null },
            stores: res.stores,
            trip: res.trip ?? null,
            relay,
          },
        });
      })
      .catch(() => {
        if (!cancelled) setFailedKey(key);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, active, retry]);

  const current = active && quote?.key === key ? quote.value : null;
  // The latest quote for the same items and place, kept while a new choice loads so the choices don't flicker.
  const previous = active && quote?.base === base ? quote.value : null;
  return {
    quote: current,
    relay: current ? current.relay : previous?.relay ?? null,
    options: current ? current.options : previous?.options ?? null,
    /** One rider's road trip for these items and this place (the same whichever way is chosen). */
    trip: current ? current.trip : previous?.trip ?? null,
    /** The way shown as chosen: the customer's pick, else what the server chose. */
    mode: (deliveryMode ?? current?.deliveryMode ?? previous?.deliveryMode ?? null) as BagDeliveryMode | null,
    /** No delivery place yet: the customer must choose one before anything is priced. */
    needsDestination: enabled && items.length > 0 && !located,
    loading: active && !current && failedKey !== key,
    failed: active && failedKey === key && !current,
    retry: () => setRetry((n) => n + 1),
  };
}
