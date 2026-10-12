"use client";

import {
  ArrowLeft,
  ChevronRight,
  Flame,
  MessageCircle,
  Phone,
  Plus,
  Radio,
  Search,
  Share2,
  ShoppingBag,
  Sparkles,
  Store,
  Truck,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, errorMessage } from "../../../lib/api";
import { LiveStreamChannel, LiveStreamViewer, PinnedProduct } from "../../../components/LiveStreamViewer";

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
  id?: string;
  title: string;
  price: number;
  compare_at_price?: number;
  sku?: string;
  inventory_quantity?: number;
}

interface StoreProduct {
  id: string;
  store_id: string;
  title: string;
  description: string | null;
  price: number;
  compare_at_price: number | null;
  badge?: string | null;
  image_url: string | null;
  category_name?: string | null;
  has_variants?: number | boolean;
  variants?: ProductVariant[];
}

interface CartItem {
  id: string;
  productId: string;
  title: string;
  variantTitle?: string;
  price: number;
  quantity: number;
  image_url?: string;
}

const ugx = (val: number) => `UGX ${Number(val).toLocaleString()}`;

export default function StoreDetailPage() {
  const params = useParams();
  const router = useRouter();
  const storeId = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [store, setStore] = useState<StoreDetail | null>(null);
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState("");

  // Live Stream modal
  const [showLiveViewer, setShowLiveViewer] = useState(false);

  // Variant drawer modal
  const [activeVariantProduct, setActiveVariantProduct] = useState<StoreProduct | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);

  // Cart state
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartNotice, setCartNotice] = useState("");

  useEffect(() => {
    if (!storeId) return;
    loadStore();
  }, [storeId]);

  async function loadStore() {
    setLoading(true);
    setError("");
    try {
      const [storeRes, prodRes] = await Promise.all([
        api.getMarketplaceStore(storeId),
        api.getMarketplaceStoreProducts(storeId),
      ]);

      if (storeRes.store) {
        setStore(storeRes.store);
      }
      if (prodRes.products) {
        setProducts(prodRes.products);
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  function handleProductClick(prod: StoreProduct) {
    if (prod.variants && prod.variants.length > 0) {
      setActiveVariantProduct(prod);
      setSelectedVariant(prod.variants[0]);
    } else {
      addToCartDirect(prod);
    }
  }

  function addToCartDirect(prod: StoreProduct, variant?: ProductVariant) {
    const itemPrice = variant ? variant.price : prod.price;
    const itemKey = variant ? `${prod.id}-${variant.title}` : prod.id;

    setCart((prev) => {
      const existing = prev.find((i) => i.id === itemKey);
      if (existing) {
        return prev.map((i) => (i.id === itemKey ? { ...i, quantity: i.quantity + 1 } : i));
      }
      return [
        ...prev,
        {
          id: itemKey,
          productId: prod.id,
          title: prod.title,
          variantTitle: variant?.title,
          price: itemPrice,
          quantity: 1,
          image_url: prod.image_url || undefined,
        },
      ];
    });

    setCartNotice(`Added ${prod.title}${variant ? ` (${variant.title})` : ""} to cart!`);
    setTimeout(() => setCartNotice(""), 2500);
    setActiveVariantProduct(null);
  }

  const categories = ["All", ...Array.from(new Set(products.map((p) => p.category_name).filter(Boolean)))];

  const filteredProducts = products.filter((p) => {
    const matchesCat = selectedCategory === "All" || p.category_name === selectedCategory;
    const matchesQuery = `${p.title} ${p.description || ""}`.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesQuery;
  });

  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="h-9 w-9 animate-spin rounded-full border-3 border-gold border-t-transparent" />
          <p className="text-sm font-semibold text-ink-500">Loading storefront…</p>
        </div>
      </div>
    );
  }

  if (!store) {
    return (
      <div className="mx-auto max-w-md p-6 text-center space-y-3">
        <h2 className="text-lg font-bold text-ink">Store Not Found</h2>
        <p className="text-xs text-ink-500">The store you requested does not exist or has been paused.</p>
        <Link
          href="/groceries"
          className="inline-block rounded-full bg-gold px-5 py-2.5 text-xs font-bold text-ink-gold"
        >
          Return to Marketplace
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
    <div className="mx-auto max-w-xl space-y-4 px-4 pb-28 pt-2">
      {/* Top Navigation */}
      <div className="flex items-center justify-between py-1">
        <button
          onClick={() => router.back()}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-[rgb(var(--surface-muted))] text-ink transition hover:bg-neutral-200 active:scale-95"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>

        <span className="font-serif text-lg font-black text-ink">{store.name}</span>

        <button
          onClick={() => {
            if (navigator.share) {
              navigator.share({ title: store.name, url: window.location.href }).catch(() => {});
            }
          }}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-[rgb(var(--surface-muted))] text-ink transition hover:bg-neutral-200 active:scale-95"
        >
          <Share2 className="h-4.5 w-4.5" />
        </button>
      </div>

      {/* Store Banner & Identity (Shopify style) */}
      <div className="relative overflow-hidden rounded-[28px] border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] shadow-sm">
        <div className="relative h-36 w-full bg-neutral-900">
          {store.banner_url ? (
            <img src={store.banner_url} alt={store.name} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-r from-neutral-800 to-black text-4xl">
              🛍️
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        </div>

        {/* Store Profile Info */}
        <div className="relative px-4 pb-4 pt-2">
          {/* Logo overlapping banner */}
          <div className="absolute -top-10 left-4 h-18 w-18 overflow-hidden rounded-2xl border-4 border-[rgb(var(--surface-card))] bg-neutral-900 shadow-md">
            {store.logo_url ? (
              <img src={store.logo_url} alt={store.name} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center font-bold text-gold text-2xl">
                {store.name.slice(0, 1)}
              </div>
            )}
          </div>

          <div className="pt-9">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="font-serif text-xl font-black text-ink">{store.name}</h1>
                <p className="text-xs text-ink-500 font-medium">
                  {store.sub_category || store.category} · {store.address || "Kampala"}
                </p>
              </div>

              {store.whatsapp_number && (
                <a
                  href={`https://wa.me/${store.whatsapp_number.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 rounded-full bg-green-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-green-700 active:scale-95"
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                  <span>WhatsApp</span>
                </a>
              )}
            </div>

            {store.description && (
              <p className="mt-2 text-xs text-ink-500 leading-relaxed">{store.description}</p>
            )}

            {/* Delivery Info */}
            <div className="mt-3 flex items-center gap-4 text-xs font-semibold text-ink-500 border-t border-[var(--border-faint)] pt-2.5">
              <span className="flex items-center gap-1 text-gold">
                <Truck className="h-3.5 w-3.5" /> 20-35 mins
              </span>
              <span>Min order {ugx(store.min_order_amount || 5000)}</span>
              <span className="rounded-full bg-green-500/15 px-2 py-0.5 text-[10px] font-bold text-green-600">
                {store.is_open ? "OPEN NOW" : "CLOSED"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Live Stream Banner (TikTok Live Shopping) */}
      {store.is_live && (
        <button
          onClick={() => setShowLiveViewer(true)}
          className="flex w-full items-center justify-between rounded-2xl bg-gradient-to-r from-red-600 via-rose-600 to-pink-600 p-3.5 text-white shadow-md transition active:scale-98"
        >
          <div className="flex items-center gap-2.5">
            <span className="flex h-3 w-3 rounded-full bg-white animate-ping" />
            <div className="text-left">
              <p className="text-xs font-black uppercase tracking-wider">
                Store Live Broadcast Active!
              </p>
              <p className="text-[11px] text-white/90 truncate max-w-xs">
                {store.live_channel_title || "Watch & buy pinned items on camera"}
              </p>
            </div>
          </div>
          <span className="rounded-full bg-black/40 px-3 py-1 text-xs font-bold text-white backdrop-blur-sm">
            Watch Live →
          </span>
        </button>
      )}

      {/* Announcement Bar */}
      {store.announcement && (
        <div className="rounded-2xl bg-gold/15 p-3 text-xs font-semibold text-ink flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-gold shrink-0" />
          <span>{store.announcement}</span>
        </div>
      )}

      {/* Search Input */}
      <div className="relative">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={`Search ${store.name} products…`}
          className="w-full rounded-2xl border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] pl-10 pr-4 py-2.5 text-sm text-ink placeholder:text-ink-500/60 shadow-sm focus:border-gold focus:outline-none"
        />
        <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-ink-500" />
      </div>

      {/* Category Filter Pills */}
      {categories.length > 2 && (
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat || "All")}
              className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-bold transition active:scale-95 ${
                selectedCategory === cat
                  ? "bg-gold text-ink-gold shadow-sm"
                  : "bg-[rgb(var(--surface-card))] text-ink-500 border border-[var(--border-faint)] hover:text-ink"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Cart Notice */}
      {cartNotice && (
        <div className="flex items-center justify-between rounded-2xl bg-gold/15 p-3 text-xs font-bold text-ink animate-fade-in">
          <span>{cartNotice}</span>
          <span className="text-gold font-mono">{cartItemCount} items</span>
        </div>
      )}

      {/* Product Catalog Grid */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-ink">Catalog ({filteredProducts.length} items)</h2>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {filteredProducts.map((p) => (
            <div
              key={p.id}
              className="flex flex-col justify-between rounded-[22px] border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-3 shadow-sm transition hover:shadow-md"
            >
              <div>
                <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-neutral-100 dark:bg-neutral-800">
                  {p.image_url ? (
                    <img
                      src={p.image_url}
                      alt={p.title}
                      className="h-full w-full object-cover transition duration-300 hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-3xl">🛍️</div>
                  )}
                  {p.badge && (
                    <span className="absolute top-2 left-2 rounded-full bg-gold px-2 py-0.5 text-[9px] font-black text-ink-gold uppercase">
                      {p.badge}
                    </span>
                  )}
                  {p.compare_at_price && p.compare_at_price > p.price && (
                    <span className="absolute top-2 right-2 rounded-full bg-red-600 px-2 py-0.5 text-[9px] font-bold text-white">
                      Sale
                    </span>
                  )}
                </div>

                <div className="mt-2.5">
                  <h3 className="font-bold text-xs leading-snug text-ink line-clamp-1">{p.title}</h3>
                  {p.description && (
                    <p className="mt-0.5 text-[11px] text-ink-500 line-clamp-1">{p.description}</p>
                  )}
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between border-t border-[var(--border-faint)] pt-2">
                <div>
                  <span className="font-mono font-black text-xs text-ink">{ugx(p.price)}</span>
                  {p.compare_at_price && (
                    <span className="ml-1 font-mono text-[10px] text-ink-500 line-through">
                      {ugx(p.compare_at_price)}
                    </span>
                  )}
                </div>

                <button
                  onClick={() => handleProductClick(p)}
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-gold text-ink-gold shadow transition active:scale-90"
                  title="Add to Cart"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Floating Cart Button */}
      {cartItemCount > 0 && (
        <div className="fixed inset-x-4 bottom-6 z-40 mx-auto max-w-md animate-slide-up">
          <Link
            href="/shopping"
            className="flex items-center justify-between rounded-full bg-ink px-5 py-3.5 text-cream shadow-2xl transition active:scale-98"
          >
            <div className="flex items-center gap-2.5">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gold text-xs font-black text-ink-gold">
                {cartItemCount}
              </span>
              <span className="text-xs font-bold">Review Order</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-black text-gold">{ugx(cartTotal)}</span>
              <span className="text-xs font-bold text-white/80">Checkout →</span>
            </div>
          </Link>
        </div>
      )}

      {/* Variant Selection Modal */}
      {activeVariantProduct && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-t-[28px] sm:rounded-[28px] border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--border-faint)] pb-3">
              <h3 className="font-bold text-base text-ink">{activeVariantProduct.title}</h3>
              <button
                onClick={() => setActiveVariantProduct(null)}
                className="rounded-full p-1.5 text-ink-500 hover:text-ink"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div>
              <label className="text-xs font-bold text-ink">Choose Variant (Size, Color, Weight):</label>
              <div className="mt-2 space-y-2">
                {activeVariantProduct.variants?.map((v, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedVariant(v)}
                    className={`flex w-full items-center justify-between rounded-2xl border p-3 text-xs font-semibold transition ${
                      selectedVariant?.title === v.title
                        ? "border-gold bg-gold/10 text-ink"
                        : "border-[var(--border-faint)] bg-[rgb(var(--surface-input))] text-ink-500"
                    }`}
                  >
                    <span>{v.title}</span>
                    <span className="font-mono font-bold text-ink">{ugx(v.price)}</span>
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => addToCartDirect(activeVariantProduct, selectedVariant || undefined)}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-gold py-3.5 text-sm font-bold text-ink-gold shadow transition active:scale-98"
            >
              <span>Add to Cart ({ugx(selectedVariant?.price || activeVariantProduct.price)})</span>
            </button>
          </div>
        </div>
      )}

      {/* Live Stream Viewer Modal */}
      {showLiveViewer && (
        <LiveStreamViewer
          channel={liveChannel}
          pinnedProduct={
            products[0]
              ? {
                  id: products[0].id,
                  title: products[0].title,
                  price: products[0].price,
                  compare_at_price: products[0].compare_at_price || undefined,
                  image_url: products[0].image_url || undefined,
                  badge: products[0].badge || undefined,
                }
              : null
          }
          onClose={() => setShowLiveViewer(false)}
          onAddToCart={(p) => addToCartDirect({ id: p.id, store_id: store.id, title: p.title, price: p.price, compare_at_price: p.compare_at_price || null, image_url: p.image_url || null, description: null })}
        />
      )}
    </div>
  );
}
