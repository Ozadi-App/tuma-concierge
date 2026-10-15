import { Bike, Package, ShoppingBag, ShoppingBasket, Store, UtensilsCrossed } from "lucide-react";
import type { OrderKind } from "../lib/order-feed";

const ICONS = { ride: Bike, parcel: Package, marketplace: Store, food: UtensilsCrossed, shopping: ShoppingBasket } as const;

export function OrderKindIcon({ kind, className = "h-5 w-5" }: { kind: OrderKind | "list"; className?: string }) {
  const Icon = kind === "list" ? ShoppingBag : ICONS[kind];
  return <Icon className={className} strokeWidth={1.8} aria-hidden />;
}
