"use client";

import type { ListSummary, OrderRow } from "@peebee/shared";
import { api } from "./api";

/** Every order a customer places (shopping list, parcel, ride, food or
 * marketplace checkout) is backed by a list, so the recent-lists feed is the
 * one place that covers them all. "active" lists have an order in progress;
 * "delivered" ones are finished. Drafts (never sent) are not orders yet. */
export async function loadOrderFeed(limit = 50): Promise<{ inProgress: ListSummary[]; past: ListSummary[] }> {
  const { lists } = await api.getRecentLists(limit);
  const withOrder = lists.filter((list) => !!list.orderId);
  return {
    inProgress: withOrder.filter((list) => list.status === "active"),
    past: withOrder.filter((list) => list.status === "delivered"),
  };
}

export type TrackedOrder = { list: ListSummary; order: OrderRow | null };

/** In-progress orders with their live order row (stage, rider, destination). */
export async function loadTrackedOrders(max = 8): Promise<TrackedOrder[]> {
  const { inProgress } = await loadOrderFeed();
  return Promise.all(
    inProgress.slice(0, max).map(async (list) => {
      try {
        const detail = await api.getOrder(list.orderId as string);
        return { list, order: detail.order };
      } catch {
        return { list, order: null };
      }
    }),
  );
}

export type OrderKind = "ride" | "parcel" | "marketplace" | "food" | "shopping";

export function orderKind(order: OrderRow | null): OrderKind {
  if (!order) return "shopping";
  if (order.is_ride) return "ride";
  if (order.type === "parcel") return "parcel";
  if (order.restaurant_id) return "food";
  if (order.store_id) return "marketplace";
  return "shopping";
}

export const ORDER_KIND_LABEL: Record<OrderKind, string> = {
  ride: "Ride",
  parcel: "Parcel",
  marketplace: "Marketplace",
  food: "Food",
  shopping: "Shopping",
};
