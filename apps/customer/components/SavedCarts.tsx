"use client";

import Link from "next/link";
import { ChevronRight, History, ShoppingBag, UtensilsCrossed } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { cartOwnerId, formatCartDate, loadCart, loadEarlierCarts } from "../lib/cart";
import { FOOD_EARLIER_EVENT, listFoodCarts, listFoodEarlierCarts, type FoodCartSummary } from "../lib/food-carts";

type CartRow = { key: string; href: string; kind: "bag" | "food" | "earlier"; title: string; detail: string };

const ugx = (n: number) => `UGX ${n.toLocaleString()}`;
const items = (n: number) => `${n} item${n === 1 ? "" : "s"}`;

/**
 * Every cart on this device, each kept as it was added: the shopping bag, each restaurant's cart and
 * the earlier (set-aside) ones. Listing them changes nothing; each is only ever checked out from its
 * own screen (the bag from /cart, a restaurant's cart from that restaurant's page).
 */
export function loadCartRows(): CartRow[] {
  if (typeof window === "undefined") return [];
  const owner = cartOwnerId();
  const rows: CartRow[] = [];
  const bag = loadCart();
  if (bag.length > 0) {
    const count = bag.reduce((n, i) => n + i.quantity, 0);
    const total = bag.reduce((n, i) => n + i.price * i.quantity, 0);
    rows.push({ key: "bag", href: "/cart", kind: "bag", title: "Shopping bag", detail: `${items(count)} · ${ugx(total)}` });
  }
  const foodName = (cart: FoodCartSummary) => cart.restaurantName || "Restaurant cart";
  for (const cart of listFoodCarts(owner)) {
    rows.push({
      key: `food-${cart.restaurantId}`,
      href: `/restaurants/${cart.restaurantId}`,
      kind: "food",
      title: foodName(cart),
      detail: `${items(cart.count)} · ${ugx(cart.total)} · not ordered`,
    });
  }
  const earlierBags = loadEarlierCarts();
  if (earlierBags.length > 0) {
    rows.push({ key: "bag-earlier", href: "/cart", kind: "earlier", title: "Earlier bags", detail: `${earlierBags.length} saved` });
  }
  for (const cart of listFoodEarlierCarts(owner)) {
    rows.push({
      key: `food-earlier-${cart.id}`,
      href: `/restaurants/${cart.restaurantId}`,
      kind: "earlier",
      title: foodName(cart),
      detail: `Saved ${formatCartDate(cart.updatedAt)} · ${items(cart.count)}`,
    });
  }
  return rows;
}

/** The rows above, read now and again whenever a cart changes (or `refreshKey` does). */
export function useCartRows(refreshKey: unknown = null): CartRow[] {
  const [rows, setRows] = useState<CartRow[]>([]);
  const refresh = useCallback(() => setRows(loadCartRows()), []);
  useEffect(() => {
    refresh();
    window.addEventListener("peebee:cart_change", refresh);
    window.addEventListener(FOOD_EARLIER_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("peebee:cart_change", refresh);
      window.removeEventListener(FOOD_EARLIER_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [refresh, refreshKey]);
  return rows;
}

const ICON = { bag: ShoppingBag, food: UtensilsCrossed, earlier: History } as const;

/** The header menu's list of carts (each opens its own screen; nothing is checked out from here). */
export function SavedCartsList({
  rows,
  onNavigate,
  exclude,
  heading = "Your carts",
  className = "",
}: {
  rows: CartRow[];
  onNavigate?: () => void;
  /** Leave out rows of this kind or key (e.g. the bag on /cart itself). */
  exclude?: (row: CartRow) => boolean;
  heading?: string;
  className?: string;
}) {
  const shown = exclude ? rows.filter((row) => !exclude(row)) : rows;
  if (shown.length === 0) return null;
  return (
    <section aria-label={heading} className={`space-y-1.5 ${className}`}>
      <h2 className="customer-menu-muted px-1 text-[12px] font-bold uppercase tracking-wider">{heading}</h2>
      <ul className="space-y-1.5">
        {shown.map((row) => {
          const Icon = ICON[row.kind];
          return (
            <li key={row.key}>
              <Link href={row.href} onClick={onNavigate} className="customer-menu-row flex items-center gap-3 rounded-2xl px-3 py-2.5">
                <span className="customer-menu-tile-icon flex h-9 w-9 shrink-0 items-center justify-center rounded-xl">
                  <Icon size={18} strokeWidth={1.9} aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-semibold leading-tight">{row.title}</span>
                  <span className="customer-menu-muted block truncate text-[12px]">{row.detail}</span>
                </span>
                <ChevronRight size={18} className="shrink-0 opacity-60" aria-hidden />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
