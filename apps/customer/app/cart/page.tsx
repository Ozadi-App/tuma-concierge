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
import { RoundCheck } from "../../components/marketplace/MarketplaceUI";
import { api, errorMessage } from "../../lib/api";
import { useBagQuote, type BagDeliveryMode } from "../../lib/bag-quote";
import { bagDestinationFields, useBagDeliveryPlace } from "../../lib/bag-place";
import { bagRelayLastMileInput } from "../../components/BagRelayDetails";
import { BagDeliveryBreakdown, BagDestinationCard } from "../../components/BagDeliveryBreakdown";
import { PlaceFlow } from "../../components/PlaceFlow";
import type { LastMileChoiceValue } from "../../components/LastMileChoice";
import { useRegisterNavPrimaryAction, useRegisterNavBack, goBackOr } from "../../lib/nav-primary-action";

export default function CartPage() {
  const router = useRouter();
  const {
    items,
    mounted,
    totalQuantity,
    selectedItems,
    selectedCount,
    subtotal,
    updateQuantity,
    removeItem,
    toggleItemSelection,
    selectAll,
    clearCart,
  } = useCart();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  // Where the bag goes: chosen on the map and remembered on this device. Never a default place.
  const delivery = useBagDeliveryPlace();
  const [choosingPlace, setChoosingPlace] = useState(false);
  // The delivery fee is the server's, for this place and the chosen way. Checkout waits for it.
  const [deliveryMode, setDeliveryMode] = useState<BagDeliveryMode | undefined>(undefined);
  const [relayLastMile, setRelayLastMile] = useState<LastMileChoiceValue>("door");
  const [relayMeetStageId, setRelayMeetStageId] = useState<string | null>(null);
  const destination =
    delivery.place?.lat != null && delivery.place.lng != null ? { lat: delivery.place.lat, lng: delivery.place.lng } : null;
  const bagQuote = useBagQuote(selectedItems, {
    enabled: mounted && delivery.ready,
    destination,
    deliveryMode,
    relayLastMile,
    relayMeetStageId: relayMeetStageId ?? undefined,
  });
  const total = bagQuote.quote?.total ?? null;
  const storeCount = new Set(selectedItems.map((it) => it.storeId)).size;

  const handleCheckout = async () => {
    const quote = bagQuote.quote;
    if (selectedItems.length === 0 || isSubmitting || total == null || !quote || !delivery.place) return;
    setIsSubmitting(true);
    setCheckoutError(null);

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
        ...bagDestinationFields(delivery.place),
        // The way this quote priced, so the order is charged what was shown.
        deliveryMode: quote.deliveryMode,
        ...(quote.deliveryMode === "relay" ? bagRelayLastMileInput(quote.relay, relayLastMile, relayMeetStageId) : {}),
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

  // Checkout lives in the bottom nav (gold button replacing its right capsule)
  // instead of a floating pay bar on top of the nav. Same handler, same states.
  // On /cart the nav's Home is Back: return to the shopping screen they came from.
  useRegisterNavBack(true, () => goBackOr(router, "/shopping"));
  useRegisterNavPrimaryAction(
    mounted && items.length > 0 && bagQuote.needsDestination
      ? { label: "Choose location", disabled: selectedCount === 0, onClick: () => setChoosingPlace(true) }
      : mounted && items.length > 0
      ? {
          label: isSubmitting ? "Creating order…" : total == null ? "Please wait…" : "Checkout",
          detail: total == null ? undefined : `UGX ${total.toLocaleString()}`,
          disabled: selectedCount === 0 || isSubmitting || total == null,
          busy: isSubmitting,
          onClick: handleCheckout,
        }
      : null,
  );

  if (!mounted) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center p-4">
        <div className="h-9 w-9 animate-spin rounded-full border-3 border-gold border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-6 text-ink">
      <div className="mx-auto max-w-md px-4 pt-3 space-y-5">
        {/* =========================================================================
            SCREEN 3: HEADER (Back button, Cart Title, Clear / Shapes toggle)
        ========================================================================= */}
        <header className="flex items-center justify-between py-2">
          <button
            type="button"
            onClick={() => router.back()}
            aria-label="Back"
            className="w-11 h-11 rounded-full bg-[rgb(var(--surface-card))] border border-[var(--border-faint)] shadow-[var(--shadow-card)] flex items-center justify-center text-ink active:scale-95 transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <h1 className="text-lg font-bold text-ink tracking-tight">Cart</h1>

          <div className="flex w-11 items-center justify-end">
            {items.length > 0 && (
              <button
                type="button"
                onClick={clearCart}
                aria-label="Clear Bag"
                className="w-11 h-11 rounded-full text-ink-500 hover:text-red-500 flex items-center justify-center transition"
                title="Clear bag"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </header>

        {/* Empty State */}
        {items.length === 0 ? (
          <div className="rounded-[24px] border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-10 text-center space-y-4 mt-6 shadow-[var(--shadow-card)]">
            <div className="w-20 h-20 mx-auto rounded-full bg-gold/15 text-gold flex items-center justify-center">
              <ShoppingBag className="w-10 h-10" />
            </div>
            <h2 className="text-xl font-bold text-ink">Your cart is empty</h2>
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
                  className={`w-6 h-6 rounded-[8px] flex items-center justify-center border transition ${
                    allSelected
                      ? "bg-gold border-gold text-ink-gold"
                      : "border-[var(--border-faint)] bg-[rgb(var(--surface-muted))]"
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
            <ul className="space-y-3">
              {items.map((item) => (
                <li
                  key={item.id}
                  className="rounded-[24px] border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-3 shadow-[var(--shadow-card)] flex items-center gap-3.5"
                >
                  {/* Thumbnail */}
                  <Link
                    href={`/product/${item.productId}`}
                    className="relative w-[84px] h-[84px] rounded-[18px] overflow-hidden shrink-0 bg-[rgb(var(--surface-muted))]"
                    aria-label={item.title}
                  >
                    <ProductImage
                      src={item.imageUrl}
                      alt={item.title}
                      category={item.category}
                      aspectRatio="square"
                      className="w-full h-full object-cover"
                    />
                  </Link>

                  {/* Name, subtitle, price, stepper */}
                  <div className="flex-1 min-w-0 self-stretch flex flex-col justify-between py-0.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <Link
                          href={`/product/${item.productId}`}
                          className="font-semibold text-sm text-ink hover:text-gold transition-colors line-clamp-1 block"
                        >
                          {item.title}
                        </Link>
                        <p className="text-[11px] text-ink-500 line-clamp-1 mt-0.5">
                          {item.variantTitle || item.storeName}
                        </p>
                      </div>
                      <RoundCheck
                        checked={!!item.selected}
                        onToggle={() => toggleItemSelection(item.id)}
                        label={`Select ${item.title}`}
                      />
                    </div>

                    <div className="mt-2 flex items-end justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-bold text-base text-ink leading-none">
                          UGX {item.price.toLocaleString()}
                        </div>
                        {item.compareAtPrice && item.compareAtPrice > item.price && (
                          <div className="text-[10px] text-ink-500 line-through mt-0.5">
                            UGX {item.compareAtPrice.toLocaleString()}
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => removeItem(item.id)}
                          className="text-[11px] font-semibold text-ink-500 hover:text-red-500 mt-1 transition"
                        >
                          Remove
                        </button>
                      </div>

                      <div className="inline-flex items-center gap-1 shrink-0 rounded-full bg-[rgb(var(--surface-muted))] p-1">
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.id, -1)}
                          className="w-7 h-7 rounded-full flex items-center justify-center text-ink hover:bg-[rgb(var(--surface-card))] active:scale-90 transition"
                          aria-label={`Decrease quantity of ${item.title}`}
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="text-sm font-semibold w-5 text-center" aria-live="polite">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.id, 1)}
                          className="w-7 h-7 rounded-full flex items-center justify-center text-ink hover:bg-[rgb(var(--surface-card))] active:scale-90 transition"
                          aria-label={`Increase quantity of ${item.title}`}
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            {/* =========================================================================
                ORDER SUMMARY CARD
            ========================================================================= */}
            <div className="rounded-[24px] border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-5 space-y-3 shadow-[var(--shadow-card)]">
              <h3 className="text-xs font-bold uppercase tracking-wider text-ink-500">
                Order Summary
              </h3>

              <div className="flex justify-between text-xs text-ink-500">
                <span>Subtotal ({selectedCount} items)</span>
                <span className="font-bold text-ink">UGX {subtotal.toLocaleString()}</span>
              </div>

              {subtotal === 0 ? (
                <div className="flex justify-between text-xs text-ink-500">
                  <span className="flex items-center gap-1">
                    <Truck className="w-3.5 h-3.5 text-gold" />
                    <span>Delivery Fee</span>
                  </span>
                  <span className="font-bold text-ink">UGX 0</span>
                </div>
              ) : (
                <>
                  <BagDestinationCard
                    place={delivery.place}
                    ready={delivery.ready}
                    onChange={() => setChoosingPlace(true)}
                    disabled={isSubmitting}
                  />
                  <div className="text-xs">
                    <BagDeliveryBreakdown
                      bag={bagQuote}
                      storeCount={storeCount}
                      onModeChange={setDeliveryMode}
                      lastMile={relayLastMile}
                      onLastMileChange={setRelayLastMile}
                      meetStageId={relayMeetStageId}
                      onMeetStageChange={setRelayMeetStageId}
                      onChooseLocation={() => setChoosingPlace(true)}
                      disabled={isSubmitting}
                      indent="pl-5"
                    />
                  </div>
                </>
              )}

              <div className="pt-3 border-t border-[var(--border-faint)] flex justify-between items-baseline">
                <span className="font-bold text-sm text-ink">Total</span>
                <span className="font-bold text-lg text-ink">{subtotal === 0 ? "UGX 0" : total == null ? "—" : `UGX ${total.toLocaleString()}`}</span>
              </div>
            </div>

            {checkoutError && (
              <div role="alert" className="rounded-[18px] bg-red-500/10 border border-red-500/20 p-3 text-xs font-semibold text-red-600 text-center">
                {checkoutError}
              </div>
            )}

            {selectedCount === 0 && (
              <p className="text-center text-xs text-ink-500">Select at least one item to check out.</p>
            )}
          </>
        )}

      </div>
      {choosingPlace && (
        <PlaceFlow
          concept="shopping"
          initial={{ destination: delivery.place }}
          onClose={() => setChoosingPlace(false)}
          onDone={(r) => {
            delivery.choose(r.destination);
            setChoosingPlace(false);
          }}
        />
      )}
    </div>
  );
}
