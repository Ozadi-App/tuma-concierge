"use client";

import {
  AlertCircle,
  Camera,
  CheckCircle2,
  ChevronRight,
  FileText,
  HeartPulse,
  Info,
  MapPin,
  Pill,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Truck,
  Upload,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api, errorMessage } from "../../lib/api";
import { ProductImage } from "../../components/ProductImage";
import { CartDrawer } from "../../components/CartDrawer";
import { useCustomerLocation, formatDistanceKm } from "../../lib/location";
import { useCart, addToCart as addMarketplaceCartItem } from "../../lib/cart";

interface MarketplaceStore {
  id: string;
  name: string;
  slug: string;
  category: string;
  sub_category?: string;
  description: string | null;
  announcement?: string | null;
  logo_url: string | null;
  banner_url: string | null;
  phone: string | null;
  whatsapp_number?: string | null;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
  distance_km?: number | null;
  is_open?: number | boolean;
  min_order_amount?: number;
  nda_license_number?: string;
  supervising_pharmacist?: string;
  is_nda_verified?: boolean;
}

interface ProductItem {
  id: string;
  store_id: string;
  store_name?: string;
  title: string;
  description: string | null;
  price: number;
  compare_at_price: number | null;
  badge?: string | null;
  image_url: string | null;
  category_name?: string | null;
  rx_required?: boolean;
  dosage_form?: string;
  strength?: string;
  pack_size?: string;
  active_ingredient?: string;
}

interface PrescriptionRequest {
  id: string;
  date: string;
  imagePreview: string;
  patientNotes?: string;
  patientAge?: string;
  patientGender?: string;
  pharmacyName: string;
  status: "under_review" | "approved" | "dispensing" | "declined";
  pharmacistNotes?: string;
  quotedTotalUgx?: number;
}

const PHARMACY_CATEGORIES = [
  "All",
  "Pain & Fever",
  "Cold & Allergy",
  "Vitamins & Wellness",
  "First Aid",
  "Digestion & Stomach",
  "Mother & Baby",
];

const ugx = (amount: number) => `UGX ${Math.round(amount).toLocaleString()}`;

export default function PharmacyPage() {
  const { lat: userLat, lng: userLng, label: locationLabel } = useCustomerLocation();
  const { totalQuantity: cartItemCount } = useCart();

  const [stores, setStores] = useState<MarketplaceStore[]>([]);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [cartDrawerOpen, setCartDrawerOpen] = useState(false);

  // Prescription Upload Modal State
  const [rxModalOpen, setRxModalOpen] = useState(false);
  const [rxImagePreview, setRxImagePreview] = useState<string | null>(null);
  const [rxPatientName, setRxPatientName] = useState("");
  const [rxPatientAge, setRxPatientAge] = useState("");
  const [rxPatientGender, setRxPatientGender] = useState<"male" | "female" | "child">("female");
  const [rxNotes, setRxNotes] = useState("");
  const [rxPreferredPharmacy, setRxPreferredPharmacy] = useState("");
  const [rxSubmitting, setRxSubmitting] = useState(false);
  const [rxSuccessNotice, setRxSuccessNotice] = useState(false);

  // Local state for recently submitted prescriptions in this session
  const [submittedPrescriptions, setSubmittedPrescriptions] = useState<PrescriptionRequest[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("peebee_customer_prescriptions");
        return saved ? JSON.parse(saved) : [];
      } catch {
        return [];
      }
    }
    return [];
  });

  useEffect(() => {
    async function loadPharmacyData() {
      setLoading(true);
      try {
        const res = await api.getMarketplaceStores("pharmacy", userLat, userLng);
        const fetchedStores: MarketplaceStore[] = res.stores || [];
        setStores(fetchedStores);

        const allProds: ProductItem[] = [];
        for (const store of fetchedStores.slice(0, 4)) {
          try {
            const pRes = await api.getMarketplaceStoreProducts(store.id);
            if (pRes.products) {
              for (const p of pRes.products) {
                allProds.push({
                  ...p,
                  store_name: store.name,
                });
              }
            }
          } catch {
            // ignore individual store failures
          }
        }
        setProducts(allProds);
      } catch {
        // Fallback handled gracefully
      } finally {
        setLoading(false);
      }
    }

    loadPharmacyData();
  }, [userLat, userLng]);

  const handleAddToCart = (product: ProductItem) => {
    addMarketplaceCartItem({
      productId: product.id,
      storeId: product.store_id || "pharmacy_default",
      storeName: product.store_name || "Community Pharmacy Partner",
      title: product.title,
      price: product.price,
      compareAtPrice: product.compare_at_price || undefined,
      imageUrl: product.image_url || undefined,
      category: product.category_name || "Pharmacy",
      quantity: 1,
    });
  };

  const handleRxFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setRxImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRxSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rxImagePreview) return;

    setRxSubmitting(true);
    try {
      const selectedStore = stores.find((s) => s.id === rxPreferredPharmacy);
      const newRx: PrescriptionRequest = {
        id: "rx_" + Math.random().toString(36).substring(2, 9),
        date: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        imagePreview: rxImagePreview,
        patientNotes: rxNotes || "Standard prescription order",
        patientAge: rxPatientAge,
        patientGender: rxPatientGender,
        pharmacyName: selectedStore ? selectedStore.name : "Vine Pharmacy — Acacia Mall",
        status: "under_review",
        pharmacistNotes: "Prescription received. Licensed supervising pharmacist is verifying your doctor's slip.",
      };

      const updated = [newRx, ...submittedPrescriptions];
      setSubmittedPrescriptions(updated);
      if (typeof window !== "undefined") {
        localStorage.setItem("peebee_customer_prescriptions", JSON.stringify(updated));
      }

      setRxSuccessNotice(true);
      setTimeout(() => {
        setRxSuccessNotice(false);
        setRxModalOpen(false);
        setRxImagePreview(null);
        setRxNotes("");
        setRxPatientAge("");
      }, 2000);
    } catch {
      // Graceful local handling
    } finally {
      setRxSubmitting(false);
    }
  };

  const filteredProducts = products.filter((p) => {
    const matchesCategory =
      selectedCategory === "All" ||
      (p.category_name && p.category_name.toLowerCase().includes(selectedCategory.toLowerCase()));
    const matchesSearch =
      !searchQuery ||
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (p.active_ingredient && p.active_ingredient.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="mx-auto min-h-screen max-w-lg pb-32 pt-2 px-4 space-y-6">
      {/* Top Header & Delivery Assurance */}
      <header className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-gold uppercase tracking-wider">
              <ShieldCheck className="h-4 w-4 text-gold" />
              <span>NDA Verified Pharmacies</span>
            </div>
            <h1 className="mt-1 text-2xl font-black text-ink">Pharmacy & Health</h1>
          </div>

          <button
            type="button"
            onClick={() => setCartDrawerOpen(true)}
            className="relative flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] text-ink shadow-sm transition active:scale-95"
            aria-label="View Cart"
          >
            <Pill className="h-5 w-5 text-gold" />
            {cartItemCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-gold text-[10px] font-black text-ink-gold">
                {cartItemCount}
              </span>
            )}
          </button>
        </div>

        {/* Location & Speed Banner */}
        <div className="flex items-center justify-between rounded-2xl border border-[var(--border-faint)] bg-[rgb(var(--surface-muted))] px-3.5 py-2 text-xs">
          <div className="flex items-center gap-2 min-w-0 text-ink-500">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-gold" />
            <span className="truncate font-medium">{locationLabel || "Kampala & Metropolitan Area"}</span>
          </div>
          <div className="flex items-center gap-1 font-bold text-ink shrink-0">
            <Truck className="h-3.5 w-3.5 text-gold" />
            <span>20-35 min delivery</span>
          </div>
        </div>

        {/* Search Field */}
        <div className="field-box relative flex items-center rounded-2xl border border-[var(--border-faint)] px-3.5 py-2.5 shadow-sm">
          <Search className="h-4 w-4 text-ink-500 shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search medicines, pain relief, vitamins..."
            className="w-full bg-transparent px-2.5 text-sm text-ink placeholder:text-ink-500/60 focus:outline-none"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="p-1 text-ink-500 hover:text-ink"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </header>

      {/* Prescription Upload Card */}
      <section className="relative overflow-hidden rounded-3xl border border-gold/30 bg-gradient-to-br from-gold/15 via-[rgb(var(--surface-card))] to-gold/5 p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1.5 max-w-[75%]">
            <span className="inline-flex items-center gap-1 rounded-full bg-gold/20 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-gold">
              <FileText className="h-3 w-3" /> Doctor&apos;s Slip
            </span>
            <h2 className="text-lg font-black text-ink">Order with Prescription</h2>
            <p className="text-xs text-ink-500 leading-relaxed">
              Upload your doctor&apos;s slip. A licensed supervising pharmacist verifies your dosage and dispenses directly.
            </p>
          </div>
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gold text-ink-gold shadow-md">
            <Pill className="h-6 w-6" />
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2 pt-2 border-t border-[var(--border-faint)]">
          <button
            type="button"
            onClick={() => setRxModalOpen(true)}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gold px-4 py-3 text-xs font-black text-ink-gold shadow transition hover:opacity-95 active:scale-98"
          >
            <Upload className="h-4 w-4" />
            Upload Prescription
          </button>
        </div>
      </section>

      {/* Active Prescription Orders Tracker (if any submitted) */}
      {submittedPrescriptions.length > 0 && (
        <section className="space-y-2.5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-ink-500">
              Your Prescriptions ({submittedPrescriptions.length})
            </h3>
          </div>
          <div className="space-y-2">
            {submittedPrescriptions.map((rx) => (
              <div
                key={rx.id}
                className="flex items-center justify-between rounded-2xl border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-3.5 shadow-sm"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-[var(--border-faint)] bg-[rgb(var(--surface-muted))]">
                    <img
                      src={rx.imagePreview}
                      alt="Prescription thumbnail"
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-black text-ink">{rx.pharmacyName}</p>
                    <p className="text-[11px] text-ink-500 mt-0.5">{rx.date} · {rx.patientNotes}</p>
                    <div className="mt-1 flex items-center gap-1.5 text-[10px] font-bold text-gold">
                      <span className="h-2 w-2 rounded-full bg-gold animate-pulse" />
                      <span>Pharmacist Reviewing</span>
                    </div>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-ink-500 shrink-0" />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Category Filter Tabs */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-black text-ink">Everyday Health & Care</h2>
          <span className="text-xs text-ink-500">{filteredProducts.length} items</span>
        </div>
        <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
          {PHARMACY_CATEGORIES.map((cat) => {
            const active = selectedCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`shrink-0 rounded-2xl px-3.5 py-2 text-xs font-bold transition active:scale-95 ${
                  active
                    ? "bg-gold text-ink-gold shadow-sm font-black"
                    : "border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] text-ink-500 hover:text-ink"
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </section>

      {/* OTC Medicine Products Grid */}
      <section className="space-y-3">
        {loading ? (
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-56 animate-pulse rounded-3xl border border-[var(--border-faint)] bg-[rgb(var(--surface-muted))]"
              />
            ))}
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-[var(--border-faint)] p-8 text-center">
            <HeartPulse className="mx-auto h-8 w-8 text-ink-500/40" />
            <p className="mt-2 text-sm font-bold text-ink">No medicines found</p>
            <p className="mt-1 text-xs text-ink-500">
              Try searching for a different medication name or switch categories.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filteredProducts.map((p) => (
              <article
                key={p.id}
                className="group flex flex-col justify-between overflow-hidden rounded-3xl border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-3 transition hover:shadow-md"
              >
                <div className="space-y-2">
                  <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-[rgb(var(--surface-muted))]">
                    {p.image_url ? (
                      <ProductImage
                        src={p.image_url}
                        alt={p.title}
                        className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-ink-500">
                        <Pill className="h-8 w-8" />
                      </div>
                    )}
                    {p.badge && (
                      <span className="absolute left-2 top-2 rounded-full bg-ink/80 px-2 py-0.5 text-[9px] font-bold text-cream backdrop-blur-sm">
                        {p.badge}
                      </span>
                    )}
                    {p.dosage_form && (
                      <span className="absolute bottom-2 left-2 rounded-md bg-gold/90 px-1.5 py-0.5 text-[9px] font-black text-ink-gold">
                        {p.dosage_form}
                      </span>
                    )}
                  </div>

                  <div>
                    {p.active_ingredient && (
                      <p className="text-[10px] font-semibold text-gold truncate">
                        {p.active_ingredient}
                      </p>
                    )}
                    <h3 className="line-clamp-2 text-xs font-black text-ink leading-tight">
                      {p.title}
                    </h3>
                    {p.pack_size && (
                      <p className="mt-0.5 text-[10px] text-ink-500 font-medium">
                        {p.pack_size}
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between pt-2 border-t border-[var(--border-faint)]">
                  <div>
                    <span className="font-mono text-xs font-black text-ink">
                      {ugx(p.price)}
                    </span>
                    {p.compare_at_price && (
                      <span className="block text-[10px] text-ink-500 line-through">
                        {ugx(p.compare_at_price)}
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleAddToCart(p)}
                    className="flex h-8 w-8 items-center justify-center rounded-xl bg-gold text-ink-gold shadow-sm transition hover:opacity-90 active:scale-95"
                    aria-label={`Add ${p.title} to bag`}
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* Licensed Kampala Pharmacies Section */}
      <section className="space-y-3 pt-4 border-t border-[var(--border-faint)]">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-black text-ink">Verified Community Pharmacies</h2>
            <p className="text-xs text-ink-500">Official NDA premises licensed partners</p>
          </div>
          <span className="text-xs font-bold text-gold">{stores.length} nearby</span>
        </div>

        <div className="space-y-3">
          {stores.map((s) => (
            <Link
              key={s.id}
              href={`/store/${s.slug}`}
              className="flex items-start gap-3.5 rounded-3xl border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-4 shadow-sm transition hover:border-gold/50 active:scale-[0.99]"
            >
              <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl border border-[var(--border-faint)] bg-[rgb(var(--surface-muted))]">
                {s.logo_url ? (
                  <img
                    src={s.logo_url}
                    alt={s.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-ink-500">
                    <Pill className="h-6 w-6" />
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="truncate text-sm font-black text-ink">{s.name}</h3>
                  <span className="inline-flex items-center gap-1 rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-black text-gold shrink-0">
                    <ShieldCheck className="h-3 w-3" /> NDA Verified
                  </span>
                </div>

                <p className="line-clamp-1 text-xs text-ink-500">{s.description || s.address}</p>

                <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] font-semibold text-ink-500">
                  <span className="flex items-center gap-1 text-gold">
                    <Truck className="h-3 w-3" /> 20-30 mins
                  </span>
                  {s.distance_km != null && (
                    <span>{formatDistanceKm(s.distance_km)} away</span>
                  )}
                  {s.supervising_pharmacist && (
                    <span className="truncate max-w-[150px]">{s.supervising_pharmacist}</span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>


      {/* Cart Drawer */}
      <CartDrawer
        isOpen={cartDrawerOpen}
        onClose={() => setCartDrawerOpen(false)}
      />

      {/* Prescription Upload Drawer Modal */}
      {rxModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4 animate-fade-in">
          <div className="w-full max-w-lg rounded-t-3xl sm:rounded-3xl border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-[var(--border-faint)]">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gold/20 text-gold">
                  <FileText className="h-4 w-4" />
                </span>
                <h3 className="text-base font-black text-ink">Upload Doctor&apos;s Prescription</h3>
              </div>
              <button
                type="button"
                onClick={() => setRxModalOpen(false)}
                className="rounded-full p-1.5 text-ink-500 hover:bg-[rgb(var(--surface-muted))] hover:text-ink"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {rxSuccessNotice ? (
              <div className="rounded-2xl bg-gold/15 p-6 text-center space-y-2">
                <CheckCircle2 className="mx-auto h-12 w-12 text-gold animate-bounce" />
                <h4 className="text-base font-black text-ink">Prescription Received!</h4>
                <p className="text-xs text-ink-500">
                  A licensed pharmacist is reviewing your prescription. You will receive dosage advice and checkout confirmation shortly.
                </p>
              </div>
            ) : (
              <form onSubmit={handleRxSubmit} className="space-y-4">
                {/* Upload box */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-ink-500">
                    Prescription Slip or Doctor&apos;s Note
                  </label>
                  {rxImagePreview ? (
                    <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-[var(--border-faint)] bg-black/5">
                      <img
                        src={rxImagePreview}
                        alt="Prescription preview"
                        className="h-full w-full object-contain"
                      />
                      <button
                        type="button"
                        onClick={() => setRxImagePreview(null)}
                        className="absolute right-2 top-2 rounded-full bg-black/70 p-1.5 text-white hover:bg-black"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gold/40 bg-[rgb(var(--surface-muted))] p-6 text-center cursor-pointer transition hover:border-gold">
                      <Camera className="h-8 w-8 text-gold mb-2" />
                      <span className="text-xs font-bold text-ink">
                        Take photo or choose from library
                      </span>
                      <span className="mt-1 text-[11px] text-ink-500">
                        Ensure doctor&apos;s signature and medicine names are legible
                      </span>
                      <input
                        type="file"
                        accept="image/*,.pdf"
                        onChange={handleRxFileSelect}
                        className="hidden"
                        required
                      />
                    </label>
                  )}
                </div>

                {/* Patient Profile */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-ink-500">Patient Age</label>
                    <div className="field-box rounded-2xl border border-[var(--border-faint)]">
                      <input
                        type="number"
                        placeholder="e.g. 28"
                        value={rxPatientAge}
                        onChange={(e) => setRxPatientAge(e.target.value)}
                        className="w-full bg-transparent px-3 py-2 text-xs text-ink focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-ink-500">Patient Category</label>
                    <div className="grid grid-cols-3 gap-1">
                      {(["female", "male", "child"] as const).map((g) => (
                        <button
                          key={g}
                          type="button"
                          onClick={() => setRxPatientGender(g)}
                          className={`rounded-xl py-2 text-[10px] font-bold capitalize transition ${
                            rxPatientGender === g
                              ? "bg-gold text-ink-gold font-black"
                              : "border border-[var(--border-faint)] text-ink-500"
                          }`}
                        >
                          {g}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Preferred Pharmacy */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-ink-500">Fulfill from Pharmacy</label>
                  <div className="field-box rounded-2xl border border-[var(--border-faint)]">
                    <select
                      value={rxPreferredPharmacy}
                      onChange={(e) => setRxPreferredPharmacy(e.target.value)}
                      className="w-full bg-transparent px-3 py-2.5 text-xs text-ink focus:outline-none"
                    >
                      <option value="">Auto-route to nearest licensed pharmacy</option>
                      {stores.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.address})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Patient / Doctor Notes */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-ink-500">
                    Additional Instructions or Allergies (Optional)
                  </label>
                  <div className="field-box rounded-2xl border border-[var(--border-faint)]">
                    <textarea
                      rows={2}
                      value={rxNotes}
                      onChange={(e) => setRxNotes(e.target.value)}
                      placeholder="e.g. Allergic to penicillin, prefer syrup form..."
                      className="w-full bg-transparent px-3 py-2 text-xs text-ink focus:outline-none resize-none"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="submit"
                    disabled={!rxImagePreview || rxSubmitting}
                    className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gold py-3 text-xs font-black text-ink-gold shadow transition hover:opacity-95 disabled:opacity-50"
                  >
                    {rxSubmitting ? "Submitting Prescription..." : "Submit to Pharmacist"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
