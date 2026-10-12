"use client";

import { useState, useEffect, useCallback } from "react";

export interface CartItem {
  id: string; // `${productId}:${variantId || "default"}`
  productId: string;
  storeId: string;
  storeName?: string;
  storeSlug?: string;
  title: string;
  variantId?: string;
  variantTitle?: string;
  price: number;
  compareAtPrice?: number;
  imageUrl?: string;
  category?: string;
  quantity: number;
  selected: boolean;
}

const STORAGE_KEY = "peebee_marketplace_cart";
const CART_EVENT = "peebee:cart_change";

export function loadCart(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveCart(items: CartItem[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    window.dispatchEvent(new Event(CART_EVENT));
  } catch {
    // ignore local storage errors
  }
}

export function addToCart(
  item: Omit<CartItem, "id" | "quantity" | "selected"> & {
    quantity?: number;
    selected?: boolean;
  }
): void {
  const current = loadCart();
  const id = `${item.productId}:${item.variantId || "default"}`;
  const qtyToAdd = Math.max(1, item.quantity ?? 1);

  const existingIndex = current.findIndex((i) => i.id === id);
  if (existingIndex >= 0) {
    current[existingIndex].quantity += qtyToAdd;
    current[existingIndex].price = item.price; // sync latest price
    if (item.variantTitle) current[existingIndex].variantTitle = item.variantTitle;
    if (item.imageUrl) current[existingIndex].imageUrl = item.imageUrl;
  } else {
    current.push({
      ...item,
      id,
      quantity: qtyToAdd,
      selected: item.selected ?? true,
    });
  }

  saveCart(current);
}

export function updateQuantity(id: string, delta: number): void {
  const current = loadCart();
  const index = current.findIndex((i) => i.id === id);
  if (index === -1) return;

  const nextQty = current[index].quantity + delta;
  if (nextQty <= 0) {
    current.splice(index, 1);
  } else {
    current[index].quantity = nextQty;
  }

  saveCart(current);
}

export function removeItem(id: string): void {
  const current = loadCart().filter((i) => i.id !== id);
  saveCart(current);
}

export function toggleItemSelection(id: string): void {
  const current = loadCart();
  const item = current.find((i) => i.id === id);
  if (item) {
    item.selected = !item.selected;
    saveCart(current);
  }
}

export function selectAll(selected: boolean): void {
  const current = loadCart().map((i) => ({ ...i, selected }));
  saveCart(current);
}

export function clearCart(): void {
  saveCart([]);
}

export function useCart() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [mounted, setMounted] = useState(false);

  const refresh = useCallback(() => {
    setItems(loadCart());
  }, []);

  useEffect(() => {
    setMounted(true);
    refresh();

    const handler = () => refresh();
    window.addEventListener(CART_EVENT, handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener(CART_EVENT, handler);
      window.removeEventListener("storage", handler);
    };
  }, [refresh]);

  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
  const selectedItems = items.filter((i) => i.selected);
  const selectedCount = selectedItems.reduce((sum, item) => sum + item.quantity, 0);

  const subtotal = selectedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const deliveryFee = subtotal > 0 ? (subtotal >= 50000 ? 0 : 3500) : 0;
  const total = subtotal + deliveryFee;

  return {
    items,
    mounted,
    totalQuantity,
    selectedItems,
    selectedCount,
    subtotal,
    deliveryFee,
    total,
    addToCart,
    updateQuantity,
    removeItem,
    toggleItemSelection,
    selectAll,
    clearCart,
  };
}
