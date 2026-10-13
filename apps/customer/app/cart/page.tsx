"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  CreditCard,
  MapPin,
  Minus,
  Plus,
  ShoppingBag,
  Sparkles,
  Trash2,
  Truck,
  Wallet,
} from "lucide-react";
import { useCart, CartItem } from "../../lib/cart";
import { ProductImage } from "../../components/ProductImage";
import { api, errorMessage } from "../../lib/api";
import { getCachedCustomerCoordinates } from "../../lib/location";

export default function CartPage() {
  const router = useRouter();
  const {
    items,
    mounted,
    totalQuantity,
    selectedItems,
    selectedCount,
    subtotal,
    deliveryFee,
    total,
    updateQuantity,
    removeItem,
    toggleItemSelection,
    selectAll,
    clearCart,
  } = useCart();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const handleCheckout = async () => {
    if (selectedItems.length === 0 || isSubmitting) return;
    setIsSubmitting(true);
    setCheckoutError(null);

    const cached = getCachedCustomerCoordinates();

    try {
      const res = await api.checkoutMarketplace({
        items: selectedItems.map((it) => ({
          productId: it.productId,
          storeId: it.storeId,
          title: it.title,
          price: it.price,
          quantity: it.quantity,
          variantId: it.variantId,
          variantTitle: it.variantTitle,
          imageUrl: it.imageUrl,
        })),
        paymentRail: "escrow",
        destinationAddress: cached.label || "Kampala",
        destinationArea: "Kampala",
        destinationLat: cached.lat || 0.3353,
        destinationLng: cached.lng || 32.5857,
      });

      const firstOrder = res.order ?? res.orders?.[0];
      clearCart();
      setIsSubmitting(false);

      if (firstOrder?.id) {
        router.push(`/orders/${firstOrder.id}/pay`);
      } else {
        router.push("/orders");
      }
    } catch (err) {
      setCheckoutError(errorMessage(err));
      setIsSubmitting(false);
    }
  };

  const allSelected = items.length > 0 && items.every((i) => i.selected);

  if (!mounted) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center p-4">
        <div className="h-9 w-9 animate-spin rounded-full border-3 border-gold border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[rgb(var(--color-bg))] pb-36 text-ink">
      <div className="mx-auto max-w-md px-4 pt-3 space-y-4">
        {/* =========================================================================
            SCREEN 3: HEADER (Back button, Cart Title, Clear / Shapes toggle)
        ========================================================================= */}
        <header className="flex items-center justify-between py-2">
          <button
            type="button"
            onClick={() => router.back()}
            aria-label="Back"
            className="w-10 h-10 rounded-2xl bg-surface-subtle border border-surface-border flex items-center justify-center text-ink active:scale-95 transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <h1 className="text-lg font-black text-ink tracking-tight">Shopping Bag</h1>

          <div className="flex items-center gap-1.5">
            {items.length > 0 && (
              <button
                type="button"
                onClick={clearCart}
                aria-label="Clear Bag"
                className="w-9 h-9 rounded-2xl text-ink-500 hover:text-red-500 flex items-center justify-center transition"
                title="Clear bag"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </header>

        {/* Empty State */}
        {items.length === 0 ? (
          <div className="rounded-3xl border border-surface-border bg-surface-card p-10 text-center space-y-4 mt-6 shadow-sm">
            <div className="w-20 h-20 mx-auto rounded-full bg-gold/15 text-gold flex items-center justify-center">
              <ShoppingBag className="w-10 h-10" />
            </div>
            <h2 className="text-xl font-black text-ink">Your bag is empty</h2>
            <p className="text-xs text-ink-500 leading-relaxed max-w-xs mx-auto">
              Explore groceries, fashion, bakery treats, electronics & local products from Kampala&apos;s finest stores.
            </p>
            <Link
              href="/stores"
              className="inline-block rounded-full bg-gold px-7 py-3.5 text-xs font-black uppercase tracking-wider text-ink-gold shadow-md hover:bg-gold/90 active:scale-98 transition"
            >
              Explore Stores
            </Link>
          </div>
        ) : (
          <>
            {/* Select All Row */}
            <div className="flex items-center justify-between px-1 text-xs font-semibold text-ink-500">
              <button
                type="button"
                onClick={() => selectAll(!allSelected)}
                className="flex items-center gap-2 hover:text-ink transition"
              >
                <div
                  className={`w-5 h-5 rounded-md flex items-center justify-center border transition ${
                    allSelected
                      ? "bg-gold border-gold text-ink-gold"
                      : "border-surface-border bg-surface-subtle"
                  }`}
                >
                  {allSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                </div>
                <span>Select all ({items.length} items)</span>
              </button>

              <span>
                {selectedCount} item{selectedCount === 1 ? "" : "s"} chosen
              </span>
            </div>

            {/* =========================================================================
                SCREEN 3: STACKED ITEM CARDS
            ========================================================================= */}
            <div className="space-y-3">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="rounded-3xl border border-surface-border bg-surface-card p-3 shadow-xs flex items-center gap-3 transition-shadow hover:shadow-md"
                >
                  {/* Item Selection Checkbox */}
                  <button
                    type="button"
                    onClick={() => toggleItemSelection(item.id)}
                    aria-label="Select item"
                    className={`w-5 h-5 rounded-md shrink-0 flex items-center justify-center border transition ${
                      item.selected
                        ? "bg-gold border-gold text-ink-gold"
                        : "border-surface-border bg-surface-subtle hover:border-ink/40"
                    }`}
                  >
                    {item.selected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                  </button>

                  {/* Square Thumbnail */}
                  <div className="relative w-20 h-20 rounded-2xl overflow-hidden shrink-0 bg-surface-subtle border border-surface-border/60">
                    <ProductImage
                      src={item.imageUrl}
                      alt={item.title}
                      category={item.category}
                      aspectRatio="square"
                      className="w-full h-full object-cover"
                    />
                  </div>

                  {/* Item Meta & Details */}
                  <div className="flex-1 min-w-0 pr-1">
                    <Link
                      href={`/product/${item.productId}`}
                      className="font-bold text-sm text-ink hover:text-gold transition-colors line-clamp-1 block"
                    >
                      {item.title}
                    </Link>

                    {item.variantTitle && (
                      <span className="inline-block text-[10px] font-semibold text-ink-500 bg-surface-subtle px-2 py-0.5 rounded-full mt-0.5 border border-surface-border/50">
                        {item.variantTitle}
                      </span>
                    )}

                    <div className="mt-1.5 flex items-baseline gap-2">
                      <span className="font-black text-sm text-ink">
                        UGX {item.price.toLocaleString()}
                      </span>
                      {item.compareAtPrice && item.compareAtPrice > item.price && (
                        <span className="text-[10px] text-ink-500 line-through">
                          UGX {item.compareAtPrice.toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Quantity Stepper Controls (Screen 3: - 1 +) */}
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <div className="inline-flex items-center gap-2 bg-surface-subtle border border-surface-border rounded-full p-1 shadow-2xs">
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.id, -1)}
                        className="w-6 h-6 rounded-full flex items-center justify-center text-ink hover:bg-surface-card active:scale-90 transition"
                        aria-label="Decrease quantity"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="text-xs font-black w-4 text-center">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.id, 1)}
                        className="w-6 h-6 rounded-full flex items-center justify-center text-ink hover:bg-surface-card active:scale-90 transition"
                        aria-label="Increase quantity"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      className="text-[10px] font-bold text-ink-500 hover:text-red-500 px-1 py-0.5 transition"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* =========================================================================
                ORDER SUMMARY CARD
            ========================================================================= */}
            <div className="rounded-3xl border border-surface-border bg-surface-card p-4 space-y-2.5 shadow-xs">
              <h3 className="text-xs font-bold uppercase tracking-wider text-ink-500">
                Order Summary
              </h3>

              <div className="flex justify-between text-xs text-ink-700">
                <span>Subtotal ({selectedCount} items)</span>
                <span className="font-bold text-ink">UGX {subtotal.toLocaleString()}</span>
              </div>

              <div className="flex justify-between text-xs text-ink-700">
                <span className="flex items-center gap-1">
                  <Truck className="w-3.5 h-3.5 text-gold" />
                  <span>Delivery Fee</span>
                </span>
                <span className="font-bold text-ink">
                  {subtotal > 0 ? (
                    deliveryFee === 0 ? (
                      <span className="text-emerald-600 uppercase font-black text-[10px]">Free</span>
                    ) : (
                      `UGX ${deliveryFee.toLocaleString()}`
                    )
                  ) : (
                    "UGX 0"
                  )}
                </span>
              </div>

              {subtotal > 0 && subtotal < 50000 && (
                <div className="text-[10px] text-ink-500 bg-surface-subtle p-2 rounded-xl flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-gold shrink-0" />
                  <span>
                    Add <b>UGX {(50000 - subtotal).toLocaleString()}</b> more for free delivery!
                  </span>
                </div>
              )}

              <div className="pt-2 border-t border-surface-border flex justify-between items-baseline">
                <span className="font-bold text-sm text-ink">Total</span>
                <span className="font-black text-lg text-gold">UGX {total.toLocaleString()}</span>
              </div>
            </div>
          </>
        )}

        {/* =========================================================================
            BOTTOM FIXED ACTION: "Pay Now" / "Proceed to Checkout"
        ========================================================================= */}
        {items.length > 0 && (
          <div className="fixed bottom-0 inset-x-0 z-40 bg-[rgb(var(--color-bg))]/90 backdrop-blur-md border-t border-surface-border p-4">
            <div className="mx-auto max-w-md space-y-2">
              {checkoutError && (
                <div className="rounded-2xl bg-red-500/10 border border-red-500/20 p-2.5 text-xs font-semibold text-red-600 text-center">
                  {checkoutError}
                </div>
              )}
              <button
                type="button"
                disabled={selectedCount === 0 || isSubmitting}
                onClick={handleCheckout}
                className="w-full py-4 px-6 rounded-full bg-ink text-cream hover:bg-ink/90 disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98] transition font-bold text-sm sm:text-base shadow-xl flex items-center justify-between"
              >
                <span>{isSubmitting ? "Creating Order…" : "Next: Payment"}</span>
                <span className="font-black text-gold">
                  UGX {total.toLocaleString()}
                </span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
