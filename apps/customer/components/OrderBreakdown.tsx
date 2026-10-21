import type { CheckoutDelivery, CheckoutDeliveryLeg, CheckoutItem } from "@peebee/shared";
import { deliverySectionTitle } from "../lib/delivery-modes";
import { formatUgx } from "../lib/order-display";

const km = (value: number | null | undefined) =>
  value != null && Number.isFinite(value) ? ` · ${Number(value.toFixed(1))} km` : "";

/** "A, B" (the stores or restaurants a rider collects from). */
export const pickupList = (names: string[]) => names.map((name) => name.replace(/\.+$/, "")).join(", ");

/**
 * The label of one relay leg, as charged: the first boda names every pickup, the matatu leg is just
 * from → to, and the last boda (when it brings the parcel to the door) reads "Boda to you".
 */
export function relayLegLabel(leg: CheckoutDeliveryLeg, index: number, count: number, pickups: string[], toDoor: boolean): string {
  if (leg.kind === "matatu") {
    return `${leg.fromName ?? "Stage"} → ${leg.toName ?? "Stage"}${km(leg.distanceKm)}`;
  }
  if (toDoor && index > 0 && index === count - 1) return `Boda to you${km(leg.distanceKm)}`;
  const from = index === 0 && pickups.length > 1 ? pickupList(pickups) : leg.fromName ?? "Pickup";
  return `Boda: ${from} → ${leg.toName ?? "Stage"}${km(leg.distanceKm)}`;
}

/** The faint lines under "Delivery": each relay leg, or which pickups one rider collects. */
export function DeliveryLines({ delivery }: { delivery: Pick<CheckoutDelivery, "mode" | "pickups" | "legs" | "lastMile" | "station"> }) {
  const legs = delivery.mode === "relay" ? delivery.legs ?? [] : [];
  // Collected at a petrol station: the last boda isn't bought, the station is the last line.
  const collect = legs.length > 0 && delivery.lastMile === "collect";
  const lines: Array<{ key: string; label: string; fee?: number }> = legs.map((leg, i) => ({
    key: `leg-${leg.leg ?? i}`,
    label: relayLegLabel(leg, i, legs.length, delivery.pickups, !collect),
    fee: leg.fee,
  }));
  if (collect) lines.push({ key: "collect", label: `Collect at ${delivery.station ?? "the petrol station"}` });
  if (!legs.length && delivery.pickups.length > 1) {
    lines.push({ key: "rider", label: `One rider collects from ${pickupList(delivery.pickups)} and brings them to you` });
  }
  if (!lines.length) return null;
  return (
    <ul className="space-y-0.5 pl-3 text-xs text-ink-500">
      {lines.map((line) => (
        <li key={line.key} className="flex justify-between gap-3">
          <span className="min-w-0">{line.label}</span>
          {line.fee != null && <span className="shrink-0">{formatUgx(line.fee)}</span>}
        </li>
      ))}
    </ul>
  );
}

/** Items (by store when there are several), their subtotal, then the delivery. */
export function ItemsBreakdown({ items, itemsSubtotal }: { items: Array<Pick<CheckoutItem, "storeName" | "name" | "quantity" | "price"> & { key?: string; note?: string | null; detail?: string | null }>; itemsSubtotal: number }) {
  const stores = [...new Set(items.map((item) => item.storeName ?? ""))];
  const byStore = stores.length > 1;
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-bold text-ink">Items</p>
      {stores.map((store) => (
        <div key={store || "items"} className="space-y-1">
          {byStore && store && <p className="text-xs font-semibold text-ink-500">{store}</p>}
          <ul className={`space-y-1 ${byStore ? "pl-3" : ""}`}>
            {items.filter((item) => (item.storeName ?? "") === store).map((item, i) => (
              <li key={item.key ?? `${store}-${i}`} className="flex justify-between gap-3 text-sm text-ink">
                <span className="min-w-0">
                  {item.name}{item.quantity > 0 ? ` × ${item.quantity}` : ""}
                  {item.detail && <span className="text-ink-500"> · {item.detail}</span>}
                  {item.note && <span className="block text-xs text-ink-500">{item.note}</span>}
                </span>
                {item.price != null && <span className="shrink-0">{formatUgx(item.price)}</span>}
              </li>
            ))}
          </ul>
        </div>
      ))}
      <div className="flex justify-between gap-3 text-sm font-semibold text-ink">
        <span>Items subtotal</span>
        <span>{formatUgx(itemsSubtotal)}</span>
      </div>
    </div>
  );
}

/**
 * What the customer pays: the items and their subtotal, a faint line, the
 * delivery with its breakdown (and any payment fees), a faint line, the total.
 */
export function OrderBreakdown({
  items,
  itemsSubtotal,
  delivery,
  fees = 0,
  total,
  deliveryLabel,
  showDeliveryLines = true,
}: {
  items: CheckoutItem[];
  itemsSubtotal: number;
  delivery: CheckoutDelivery;
  /** Payment and service fees, shown only when above zero. */
  fees?: number;
  /** The amount to pay; null while it's loading. */
  total: number | null;
  /** Defaults to "Delivery", or "Delivery · Relay" / "Delivery · Direct" where the customer chose. */
  deliveryLabel?: string;
  /** The faint lines under Delivery (each leg, who collects). Off where the delivery was already chosen on its own step. */
  showDeliveryLines?: boolean;
}) {
  const hasItems = items.length > 0 || itemsSubtotal > 0;
  return (
    <div className="space-y-3">
      {hasItems && (
        <>
          <ItemsBreakdown items={items} itemsSubtotal={itemsSubtotal} />
          <hr className="border-[var(--border-faint)]" />
        </>
      )}
      <div className="space-y-1">
        <div className="flex justify-between gap-3 text-sm text-ink">
          <span>{deliveryLabel ?? deliverySectionTitle(delivery)}</span>
          <span>{formatUgx(delivery.total)}</span>
        </div>
        {showDeliveryLines && <DeliveryLines delivery={delivery} />}
      </div>
      {fees > 0 && (
        <div className="flex justify-between gap-3 text-sm text-ink-500">
          <span>Payment and service fees</span>
          <span>{formatUgx(fees)}</span>
        </div>
      )}
      <hr className="border-[var(--border-faint)]" />
      <div className="flex justify-between gap-3 text-lg font-bold text-ink">
        <span>Total</span>
        <span>{total == null ? "Loading…" : formatUgx(total)}</span>
      </div>
    </div>
  );
}
