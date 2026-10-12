"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  Info,
  MapPin,
  Minus,
  Plus,
  ShieldCheck,
  Sparkles,
  WashingMachine,
} from "lucide-react";
import Link from "next/link";

interface LaundryItem {
  id: string;
  name: string;
  category: "wash_fold" | "dry_clean" | "bulky" | "iron";
  description: string;
  priceUgx: number;
  unit: string;
}

const LAUNDRY_CATALOG: LaundryItem[] = [
  { id: "wash_kg", name: "Mixed Everyday Clothes", category: "wash_fold", description: "Washed, tumble dried, and neatly folded", priceUgx: 5000, unit: "kg" },
  { id: "wash_bag", name: "Full Load Laundry Bag (~6kg)", category: "wash_fold", description: "Standard laundry basket wash & fold", priceUgx: 25000, unit: "bag" },
  { id: "suit_2pc", name: "Men's / Women's 2-Piece Suit", category: "dry_clean", description: "Gentle solvent clean and steam press", priceUgx: 18000, unit: "suit" },
  { id: "blazer", name: "Blazer / Jacket", category: "dry_clean", description: "Fabric-safe dry cleaning", priceUgx: 12000, unit: "pc" },
  { id: "dress_delicate", name: "Delicate / Evening Dress", category: "dry_clean", description: "Careful treatment for silk, lace, or beads", priceUgx: 15000, unit: "dress" },
  { id: "duvet_single", name: "Single / Medium Duvet", category: "bulky", description: "Deep wash & sanitized high-heat dry", priceUgx: 20000, unit: "piece" },
  { id: "duvet_king", name: "King / Double Comforter", category: "bulky", description: "Thorough wash, anti-allergen rinse", priceUgx: 28000, unit: "piece" },
  { id: "curtains", name: "Curtains / Drapes (Pair)", category: "bulky", description: "Dust removal and deep restorative wash", priceUgx: 22000, unit: "pair" },
  { id: "shirts_iron", name: "Formal Shirts (Press Only)", category: "iron", description: "Crisp collar & crease steam press", priceUgx: 3000, unit: "pc" },
  { id: "trousers_iron", name: "Slacks / Trousers (Press Only)", category: "iron", description: "Sharp tailored crease finish", priceUgx: 3500, unit: "pc" },
];

export default function LaundryPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"wash_fold" | "dry_clean" | "bulky" | "iron">("wash_fold");
  const [quantities, setQuantities] = useState<Record<string, number>>({ wash_bag: 1 });
  const [pickupAddress, setPickupAddress] = useState("Acacia Mall, Kisementi, Kampala");
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [timeSlot, setTimeSlot] = useState("Morning (8:00 AM - 11:00 AM)");
  const [detergentType, setDetergentType] = useState<"standard" | "hypoallergenic" | "lavender">("standard");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderConfirmed, setOrderConfirmed] = useState(false);

  const updateQuantity = (id: string, delta: number) => {
    setQuantities((prev) => {
      const next = (prev[id] ?? 0) + delta;
      if (next <= 0) {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      }
      return { ...prev, [id]: next };
    });
  };

  const totalItems = Object.values(quantities).reduce((acc, qty) => acc + qty, 0);
  const subtotalUgx = Object.entries(quantities).reduce((sum, [id, qty]) => {
    const item = LAUNDRY_CATALOG.find((catalogItem) => catalogItem.id === id);
    return sum + (item ? item.priceUgx * qty : 0);
  }, 0);

  const pickupFeeUgx = subtotalUgx > 0 ? 3000 : 0;
  const totalUgx = subtotalUgx + pickupFeeUgx;

  const currentItems = LAUNDRY_CATALOG.filter((item) => item.category === activeTab);

  const handleBookPickup = () => {
    if (subtotalUgx <= 0) return;
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setOrderConfirmed(true);
    }, 900);
  };

  return (
    <div className="min-h-screen bg-[rgb(var(--color-bg))] pb-28 pt-4 px-4 max-w-lg mx-auto text-ink">
      {/* Top Header */}
      <div className="flex items-center justify-between mb-4">
        <button
          type="button"
          onClick={() => router.push("/services")}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-[rgb(var(--surface-card))] border border-[var(--border-faint)] text-ink transition-transform active:scale-95"
          aria-label="Back to Services"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="text-center">
          <span className="text-[11px] font-bold uppercase tracking-wider text-gold">Doorstep Care</span>
          <h1 className="text-lg font-bold">Laundry & Dry Clean</h1>
        </div>
        <div className="h-10 w-10" />
      </div>

      {orderConfirmed ? (
        <div className="home-card rounded-3xl border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-6 text-center space-y-4 animate-in fade-in duration-300">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gold/15 text-gold">
            <CheckCircle2 className="h-10 w-10" />
          </div>
          <h2 className="text-xl font-bold">Pickup Scheduled!</h2>
          <p className="text-sm text-ink-500 leading-relaxed">
            A Peebee rider has been scheduled to pick up your laundry during your preferred slot:{" "}
            <span className="font-semibold text-ink">{timeSlot}</span> at <span className="font-semibold text-ink">{pickupAddress}</span>.
          </p>
          <div className="rounded-2xl bg-[rgb(var(--surface-muted))] p-4 text-left space-y-2">
            <div className="flex justify-between text-xs text-ink-500">
              <span>Estimated Return</span>
              <span className="font-bold text-ink">Tomorrow by 5:00 PM</span>
            </div>
            <div className="flex justify-between text-xs text-ink-500">
              <span>Total Estimated</span>
              <span className="font-bold text-gold">UGX {totalUgx.toLocaleString("en-UG")}</span>
            </div>
          </div>
          <div className="pt-2 flex flex-col gap-2">
            <Link
              href="/orders"
              className="flex h-12 w-full items-center justify-center rounded-2xl bg-gold font-bold text-ink-gold shadow-[var(--shadow-glow-gold)] active:scale-95 transition-transform"
            >
              View Order Tracking
            </Link>
            <button
              type="button"
              onClick={() => {
                setOrderConfirmed(false);
                setQuantities({ wash_bag: 1 });
              }}
              className="text-xs font-semibold text-ink-500 underline py-2"
            >
              Book Another Service
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Service Info Banner */}
          <div className="home-card relative overflow-hidden rounded-3xl border border-gold/30 bg-gradient-to-br from-gold/15 via-gold/5 to-transparent p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gold text-ink-gold">
                <WashingMachine className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <h2 className="text-base font-bold text-ink">Fresh Clothes Delivered</h2>
                  <span className="rounded-full bg-gold/20 px-2 py-0.5 text-[10px] font-bold text-gold">24h Turnaround</span>
                </div>
                <p className="text-xs text-ink-500 leading-relaxed">
                  We collect your laundry basket, wash with premium eco-detergent, fold crisply, and deliver back to your door.
                </p>
              </div>
            </div>
          </div>

          {/* Category Tabs */}
          <div className="flex rounded-2xl bg-[rgb(var(--surface-muted))] p-1 text-xs font-bold">
            <button
              type="button"
              onClick={() => setActiveTab("wash_fold")}
              className={`flex-1 rounded-xl py-2.5 transition-all text-center ${
                activeTab === "wash_fold" ? "bg-gold text-ink-gold shadow-sm font-extrabold" : "text-ink-500 hover:text-ink"
              }`}
            >
              Wash & Fold
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("dry_clean")}
              className={`flex-1 rounded-xl py-2.5 transition-all text-center ${
                activeTab === "dry_clean" ? "bg-gold text-ink-gold shadow-sm font-extrabold" : "text-ink-500 hover:text-ink"
              }`}
            >
              Dry Clean
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("bulky")}
              className={`flex-1 rounded-xl py-2.5 transition-all text-center ${
                activeTab === "bulky" ? "bg-gold text-ink-gold shadow-sm font-extrabold" : "text-ink-500 hover:text-ink"
              }`}
            >
              Duvets
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("iron")}
              className={`flex-1 rounded-xl py-2.5 transition-all text-center ${
                activeTab === "iron" ? "bg-gold text-ink-gold shadow-sm font-extrabold" : "text-ink-500 hover:text-ink"
              }`}
            >
              Press Only
            </button>
          </div>

          {/* Items Selector */}
          <div className="space-y-3">
            {currentItems.map((item) => {
              const qty = quantities[item.id] ?? 0;
              return (
                <div
                  key={item.id}
                  className="home-card flex items-center justify-between rounded-2xl border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-4 transition-all"
                >
                  <div className="min-w-0 flex-1 pr-3">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-ink">{item.name}</h3>
                    </div>
                    <p className="text-xs text-ink-500 mt-0.5 line-clamp-1">{item.description}</p>
                    <div className="mt-1.5 flex items-baseline gap-1.5">
                      <span className="text-sm font-extrabold text-gold">UGX {item.priceUgx.toLocaleString("en-UG")}</span>
                      <span className="text-[11px] text-ink-500">/ {item.unit}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.id, -1)}
                      disabled={qty === 0}
                      className={`flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border-faint)] transition-transform active:scale-90 ${
                        qty === 0 ? "opacity-30 cursor-not-allowed" : "bg-[rgb(var(--surface-muted))] text-ink"
                      }`}
                      aria-label="Decrease quantity"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="w-6 text-center text-sm font-bold text-ink">{qty}</span>
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.id, 1)}
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-gold text-ink-gold shadow-sm transition-transform active:scale-90"
                      aria-label="Increase quantity"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Wash Preferences */}
          <div className="home-card rounded-3xl border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-gold" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-ink">Wash Preference</h3>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: "standard", label: "Classic Fresh" },
                { id: "hypoallergenic", label: "Sensitive Skin" },
                { id: "lavender", label: "Lavender Mist" },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setDetergentType(opt.id as typeof detergentType)}
                  className={`rounded-xl border p-2.5 text-center text-xs font-semibold transition-all ${
                    detergentType === opt.id
                      ? "border-gold bg-gold/15 text-gold font-bold"
                      : "border-[var(--border-faint)] bg-[rgb(var(--surface-muted))] text-ink-500"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Pickup Details & Address */}
          <div className="home-card rounded-3xl border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-4 space-y-3">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-gold" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-ink">Pickup Location</h3>
            </div>
            <div className="field-box flex items-center rounded-xl px-3 py-2.5">
              <input
                type="text"
                value={pickupAddress}
                onChange={(e) => setPickupAddress(e.target.value)}
                placeholder="Enter pickup address"
                className="w-full text-sm font-medium outline-none bg-transparent"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <Clock className="h-4 w-4 text-gold" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-ink">Preferred Slot</h3>
            </div>
            <div className="field-box flex items-center rounded-xl px-3 py-2.5">
              <select
                value={timeSlot}
                onChange={(e) => setTimeSlot(e.target.value)}
                className="w-full text-sm font-medium outline-none bg-transparent text-ink"
              >
                <option value="Morning (8:00 AM - 11:00 AM)">Morning (8:00 AM - 11:00 AM)</option>
                <option value="Afternoon (12:00 PM - 3:00 PM)">Afternoon (12:00 PM - 3:00 PM)</option>
                <option value="Evening (4:00 PM - 7:00 PM)">Evening (4:00 PM - 7:00 PM)</option>
              </select>
            </div>

            <div className="pt-1">
              <div className="field-box flex items-center rounded-xl px-3 py-2.5">
                <input
                  type="text"
                  value={deliveryNotes}
                  onChange={(e) => setDeliveryNotes(e.target.value)}
                  placeholder="Special instructions (e.g. gate code, delicate fabrics)"
                  className="w-full text-xs font-medium outline-none bg-transparent"
                />
              </div>
            </div>
          </div>

          {/* Order Summary & Schedule Button */}
          <div className="home-card rounded-3xl border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-4 space-y-3">
            <div className="flex items-center justify-between text-xs text-ink-500">
              <span>Items Subtotal ({totalItems})</span>
              <span className="font-semibold text-ink">UGX {subtotalUgx.toLocaleString("en-UG")}</span>
            </div>
            <div className="flex items-center justify-between text-xs text-ink-500">
              <span>Rider Pickup & Return</span>
              <span className="font-semibold text-ink">UGX {pickupFeeUgx.toLocaleString("en-UG")}</span>
            </div>
            <div className="border-t border-[var(--border-faint)] pt-2.5 flex items-center justify-between">
              <span className="text-sm font-bold text-ink">Total Estimate</span>
              <span className="text-base font-extrabold text-gold">UGX {totalUgx.toLocaleString("en-UG")}</span>
            </div>

            <button
              type="button"
              disabled={subtotalUgx === 0 || isSubmitting}
              onClick={handleBookPickup}
              className={`w-full flex h-12 items-center justify-center gap-2 rounded-2xl bg-gold font-bold text-ink-gold shadow-[var(--shadow-glow-gold)] transition-all active:scale-95 ${
                subtotalUgx === 0 ? "opacity-50 cursor-not-allowed" : ""
              }`}
            >
              {isSubmitting ? (
                <span className="animate-pulse">Confirming Booking...</span>
              ) : (
                <>
                  <Calendar className="h-4 w-4" />
                  <span>Book Laundry Pickup</span>
                </>
              )}
            </button>
            <div className="flex items-center justify-center gap-1.5 text-[11px] text-ink-500">
              <ShieldCheck className="h-3.5 w-3.5 text-gold" />
              <span>Garment damage guarantee up to UGX 500,000</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
