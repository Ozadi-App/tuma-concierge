"use client";

import { useEffect, useState } from "react";
import { api } from "./api";
import type { CartItem } from "./cart";
import { getCachedCustomerCoordinates } from "./location";

export type BagQuote = {
  deliveryFee: number;
  total: number;
  stores: Array<{ storeId: string; storeName: string; itemsTotal: number; deliveryFee: number }>;
};

/**
 * The exact delivery fee the server will charge for these items: one rider
 * trip through every store in the bag. Null while loading or after an error,
 * so checkout can stay off until the fee is known (never an estimate).
 */
export function useBagQuote(items: CartItem[], enabled: boolean) {
  const [quote, setQuote] = useState<{ key: string; value: BagQuote } | null>(null);
  const [failedKey, setFailedKey] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const coords = getCachedCustomerCoordinates();
  const lat = coords.lat || 0.3353;
  const lng = coords.lng || 32.5857;
  const key = `${lat},${lng}|${items.map((it) => `${it.storeId}:${it.productId}:${it.variantId ?? ""}:${it.price}x${it.quantity}`).join(",")}`;

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
      })
      .then((res) => {
        if (!cancelled) setQuote({ key, value: { deliveryFee: res.deliveryFee, total: res.total, stores: res.stores } });
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
    loading: enabled && items.length > 0 && !current && failedKey !== key,
    failed: failedKey === key && !current,
    retry: () => setRetry((n) => n + 1),
  };
}
