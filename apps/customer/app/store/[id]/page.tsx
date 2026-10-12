"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ChevronRight,
  Flame,
  LayoutGrid,
  Radio,
  Search,
  SlidersHorizontal,
  Sparkles,
  Store,
  X,
} from "lucide-react";
import { api, errorMessage } from "../../../lib/api";
import { LiveStreamChannel, LiveStreamViewer, PinnedProduct } from "../../../components/LiveStreamViewer";
import { ProductCard } from "../../../components/ProductCard";
import { useCart } from "../../../lib/cart";

interface StoreDetail {
  id: string;
  name: string;
  slug: string;
  category: "groceries" | "stores";
  sub_category?: string;
  description: string | null;
  announcement?: string | null;
  logo_url: string | null;
  banner_url: string | null;
  phone: string | null;
  whatsapp_number?: string | null;
  address?: string | null;
  is_open?: number | boolean;
  min_order_amount?: number;
  is_live?: number | boolean;
  live_channel_title?: string | null;
  live_stream_url?: string | null;
  live_viewer_count?: number;
}

interface ProductVariant {
  id: string;
  title: string;
  price: number;
  compare_at_price?: number;
  inventory_quantity?: number;
}

interface StoreProduct {
  id: string;
  store_id: string;
  title: string;
  slug?: string;
  description: string | null;
  price: number;
  compare_at_price: number | null;
  badge?: string | null;
  image_url: string | null;
  category_name?: string | null;
  inventory_quantity?: number;
  has_variants?: number | boolean;
  variants?: ProductVariant[];
}

export default function StoreDetailPage() {
  const params = useParams();
  const router = useRouter();
  const storeId = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [store, setStore] = useState<StoreDetail | null>(null);
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"All" | "Popular" | "Recent" | "Recommended">("All");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [error, setError] = useState("");
  const [showLiveViewer, setShowLiveViewer] = useState(false);
  const [useShapesOnly, setUseShapesOnly] = useState(false);

  const { totalQuantity, total } = useCart();

  useEffect(() => {
    let active = true;

    async function loadData() {
      if (!storeId) return;
      setLoading(true);
      setError("");

      try {
        const [storeRes, productsRes] = await Promise.all([
          api.getMarketplaceStore(storeId).catch(() => null),
          api.getMarketplaceStoreProducts(storeId).catch(() => null),
        ]);

        if (!active) return;

        if (storeRes && storeRes.store) {
          setStore(storeRes.store);
        } else {
          setError("Store not found");
        }

        if (productsRes && productsRes.products) {
          setProducts(productsRes.products);
        }
      } catch (err) {
        if (!active) return;
        setError(errorMessage(err));
      } finally {
        if (active) setLoading(false);
      }
    }

    loadData();
    return () => {
      active = false;
    };
  }, [storeId]);

  // Filter Products by Tab, Search, and Category
  const filteredProducts = products.filter((p) => {
    if (activeTab === "Popular" && !p.badge && (!p.compare_at_price || p.compare_at_price <= p.price)) {
      return false;
    }
    if (activeTab === "Recent" && p.badge !== "New" && p.badge !== "Trending" && p.badge !== "Limited Drop") {
      // allow recent items
    }
    if (activeTab === "Recommended" && !p.badge && !p.has_variants) {
      // allow recommended items
    }

    if (selectedCategory !== "All" && p.category_name !== selectedCategory) {
      return false;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const match =
        p.title.toLowerCase().includes(q) ||
        (p.description && p.description.toLowerCase().includes(q));
      if (!match) return false;
    }

    return true;
  });

  const categories = [
    "All",
    ...Array.from(new Set(products.map((p) => p.category_name).filter(Boolean))),
  ];

  const promoProduct =
    products.find((p) => p.compare_at_price && p.compare_at_price > p.price) ||
    products[0];

  if (loading) {
    return (
      <div className="flex min-h-[75vh] items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="h-9 w-9 animate-spin rounded-full border-3 border-gold border-t-transparent" />
          <p className="text-sm font-semibold text-ink-500">Opening store…</p>
        </div>
      </div>
    );
  }

  if (error || !store) {
    return (
      <div className="mx-auto max-w-md p-6 text-center space-y-4 pt-16">
        <h2 className="text-xl font-bold text-ink">Store Not Found</h2>
        <p className="text-xs text-ink-500">
          {error || "The store you requested is not currently active."}
        </p>
        <Link
          href="/stores"
          className="inline-block rounded-full bg-gold px-6 py-3 text-xs font-bold text-ink-gold"
        >
          Browse Marketplace Stores
        </Link>
      </div>
    );
  }

  const liveChannel: LiveStreamChannel = {
    id: store.id,
    name: store.name,
    slug: store.slug,
    logo_url: store.logo_url,
    banner_url: store.banner_url,
    category: store.category,
    live_channel_title: store.live_channel_title ?? null,
    live_stream_url: store.live_stream_url ?? null,
    live_viewer_count: store.live_viewer_count || 148,
  };

  return (
    <div className="min-h-screen bg-[rgb(var(--color-bg))] pb-32 pt-2 px-4 max-w-md mx-auto text-ink">
      {/* =========================================================================
          SCREEN 1: STOREFRONT HEADER (Inspiration Screen 1)
      ========================================================================= */}
      <header className="flex items-center justify-between py-2">
        {/* Left: 4-square grid button in soft squircle */}
        <button
          type="button"
          onClick={() => router.push("/stores")}
          className="flex h-11 w-11 items-center justify-center rounded-2xl bg-surface-subtle border border-surface-border text-ink transition-transform active:scale-95"
          aria-label="All Stores"
        >
          <LayoutGrid className="h-5 w-5" />
        </button>

        {/* Center: Greeting & Store Name */}
        <div className="text-center min-w-0 px-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-ink-500 truncate">
            {store.address ? store.address.split(",")[0] : "Kampala, UG"}
          </p>
          <h1 className="text-base font-extrabold text-ink truncate leading-tight">
            {store.name}
          </h1>
        </div>

        {/* Right: Store Avatar / Profile */}
        <div className="flex items-center gap-2">
          {store.logo_url ? (
            <img
              src={store.logo_url}
              alt={store.name}
              className="h-11 w-11 rounded-full object-cover border-2 border-gold/40 shadow-xs"
            />
          ) : (
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gold/20 border-2 border-gold/40 font-bold text-gold text-sm">
              {store.name.slice(0, 2).toUpperCase()}
            </div>
          )}
        </div>
      </header>

      {/* =========================================================================
          SEARCH & FILTER BAR (Screen 1 with field-box)
      ========================================================================= */}
      <div className="flex items-center gap-2.5 mt-3">
        <div className="field-box flex-1 flex items-center rounded-2xl px-3.5 py-3 shadow-xs">
          <Search className="h-4 w-4 text-ink-500 mr-2.5 shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Search ${store.name}…`}
            className="w-full text-xs font-semibold outline-none bg-transparent placeholder:text-ink-500/70"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="text-ink-500"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => {
            const nextTab =
              activeTab === "All"
                ? "Popular"
                : activeTab === "Popular"
                ? "Recent"
                : activeTab === "Recent"
                ? "Recommended"
                : "All";
            setActiveTab(nextTab);
          }}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gold/15 text-gold border border-gold/30 transition-transform active:scale-95 shadow-xs"
          aria-label="Filter"
          title={`Filter: ${activeTab}`}
        >
          <SlidersHorizontal className="h-4 w-4" />
        </button>
      </div>

      {/* =========================================================================
          HERO PROMO BANNER: "Big Sale" / Store Feature (Inspiration Screen 1)
      ========================================================================= */}
      {promoProduct && (
        <Link
          href={`/product/${promoProduct.id}`}
          className="block relative overflow-hidden rounded-[28px] border border-gold/30 bg-gradient-to-r from-gold/25 via-gold/10 to-surface-card p-4 mt-4 shadow-sm group transition-transform hover:scale-[1.01]"
        >
          <div className="flex items-center justify-between gap-3">
            {/* Promo Graphic */}
            <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-neutral-900 shadow-md">
              {promoProduct.image_url ? (
                <img
                  src={promoProduct.image_url}
                  alt={promoProduct.title}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-3xl">🛍️</div>
              )}
              <span className="absolute bottom-1 right-1 rounded-full bg-gold px-1.5 py-0.5 text-[9px] font-black text-ink-gold">
                HOT
              </span>
            </div>

            {/* Promo Copy */}
            <div className="flex-1 min-w-0 pr-1">
              <span className="rounded-full bg-gold/25 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-gold">
                Big Sale
              </span>
              <h2 className="text-sm font-extrabold text-ink mt-1 truncate">
                {promoProduct.title}
              </h2>
              <p className="text-[11px] text-ink-500 line-clamp-2 mt-0.5 leading-snug">
                {promoProduct.description || "Discover featured items at up to 40% discount with fast citywide dispatch."}
              </p>
              <div className="mt-2 text-[11px] font-bold text-gold flex items-center gap-1">
                <span>View Product</span>
                <ChevronRight className="h-3 w-3" />
              </div>
            </div>
          </div>
        </Link>
      )}

      {/* Live Stream Alert (if Store is broadcasting Live) */}
      {store.is_live && (
        <button
          type="button"
          onClick={() => setShowLiveViewer(true)}
          className="mt-3 w-full flex items-center justify-between rounded-2xl bg-gradient-to-r from-red-600 to-rose-600 p-3 text-white shadow-md transition-transform active:scale-98"
        >
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 rounded-full bg-white animate-ping" />
            <span className="text-xs font-bold uppercase tracking-wide">
              Live Stream Broadcast Active
            </span>
          </div>
          <span className="rounded-full bg-black/40 px-2.5 py-0.5 text-[10px] font-bold">
            Watch & Buy →
          </span>
        </button>
      )}

      {/* =========================================================================
          SEGMENTED FILTER TABS (Screen 1: All, Popular, Recent, Recommended)
      ========================================================================= */}
      <div className="flex items-center justify-between gap-2 py-3">
        <div className="flex gap-2 overflow-x-auto no-scrollbar scrollbar-none">
          {(["All", "Popular", "Recent", "Recommended"] as const).map((tab) => {
            const active = activeTab === tab;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold transition-all active:scale-95 ${
                  active
                    ? "bg-gold text-ink-gold shadow-sm font-extrabold"
                    : "bg-surface-subtle text-ink-500 border border-surface-border hover:text-ink"
                }`}
              >
                {tab}
              </button>
            );
          })}
        </div>

        {/* Option 2 Shapes Toggle Button */}
        <button
          type="button"
          onClick={() => setUseShapesOnly(!useShapesOnly)}
          title="Toggle Option 2: Colored Geometric Shapes fallback"
          className={`shrink-0 px-2.5 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider border transition-all ${
            useShapesOnly
              ? "bg-gold text-ink-gold border-gold"
              : "bg-surface-subtle text-ink-500 border-surface-border hover:text-ink"
          }`}
        >
          {useShapesOnly ? "Shapes Mode" : "Photos"}
        </button>
      </div>

      {/* Category Pills (Sub-filters) */}
      {categories.length > 2 && (
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-2 scrollbar-none text-[11px]">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat || "All")}
              className={`shrink-0 rounded-xl px-2.5 py-1 font-semibold transition ${
                selectedCategory === cat
                  ? "bg-ink text-cream"
                  : "bg-surface-card text-ink-500 border border-surface-border"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* =========================================================================
          2-COLUMN PRODUCT GRID (Screen 1 using Image 1 ProductCards)
      ========================================================================= */}
      <section className="mt-1 space-y-3">
        <div className="flex items-center justify-between text-xs text-ink-500 font-semibold px-0.5">
          <span>{filteredProducts.length} items found</span>
          <span>Delivery 20-35 mins</span>
        </div>

        {filteredProducts.length === 0 ? (
          <div className="rounded-3xl border border-surface-border bg-surface-card p-8 text-center space-y-2">
            <p className="text-sm font-bold text-ink">No items match your filter</p>
            <p className="text-xs text-ink-500">
              Try switching to the &quot;All&quot; tab or clearing your search keywords.
            </p>
            <button
              type="button"
              onClick={() => {
                setActiveTab("All");
                setSelectedCategory("All");
                setSearchQuery("");
              }}
              className="mt-2 text-xs font-bold text-gold underline"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filteredProducts.map((p) => (
              <ProductCard
                key={p.id}
                product={{
                  ...p,
                  variants: p.variants,
                }}
                storeName={store.name}
                forceShapes={useShapesOnly}
              />
            ))}
          </div>
        )}
      </section>

      {/* =========================================================================
          BOTTOM FLOATING CART CAPSULE
      ========================================================================= */}
      {totalQuantity > 0 && (
        <div className="fixed inset-x-4 bottom-4 z-40 mx-auto max-w-md animate-in slide-in-from-bottom duration-300">
          <Link
            href="/cart"
            className="flex w-full items-center justify-between rounded-full bg-ink px-5 py-3.5 text-cream shadow-2xl transition-transform active:scale-98 hover:bg-ink/90"
          >
            <div className="flex items-center gap-2.5">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gold text-xs font-black text-ink-gold">
                {totalQuantity}
              </span>
              <span className="text-xs font-bold">Review Bag</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-black text-gold">
                UGX {total.toLocaleString()}
              </span>
              <span className="text-xs font-bold text-white/80">View Cart →</span>
            </div>
          </Link>
        </div>
      )}

      {/* Live Stream Viewer Modal */}
      {showLiveViewer && (
        <LiveStreamViewer
          channel={liveChannel}
          onClose={() => setShowLiveViewer(false)}
          pinnedProduct={
            promoProduct
              ? {
                  id: promoProduct.id,
                  title: promoProduct.title,
                  price: promoProduct.price,
                  compare_at_price: promoProduct.compare_at_price || undefined,
                  image_url: promoProduct.image_url || undefined,
                  badge: promoProduct.badge || undefined,
                }
              : null
          }
          onAddToCart={() => {
            // Added via live stream
          }}
        />
      )}
    </div>
  );
}
