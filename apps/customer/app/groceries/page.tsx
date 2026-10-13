"use client";

import {
  Flame,
  Plus,
  Radio,
  Search,
  ShoppingBag,
  Sparkles,
  Store,
  Tag,
  Truck,
  Users,
  X,
  Zap,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api, errorMessage } from "../../lib/api";
import { LiveStreamChannel, LiveStreamViewer, PinnedProduct } from "../../components/LiveStreamViewer";
import { ProductImage } from "../../components/ProductImage";

interface MarketplaceStore {
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
}

const GROCERY_CATEGORIES = [
  "All",
  "Fresh Produce",
  "Dairy & Eggs",
  "Bakery",
  "Pantry Staples",
  "Beverages",
];

const ugx = (val: number) => `UGX ${Number(val).toLocaleString()}`;

export default function GroceriesPage() {
  const [loading, setLoading] = useState(true);
  const [stores, setStores] = useState<MarketplaceStore[]>([]);
  const [liveChannels, setLiveChannels] = useState<LiveStreamChannel[]>([]);
  const [featuredProducts, setFeaturedProducts] = useState<ProductItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState("");

  // Live Stream modal state
  const [activeLiveChannel, setActiveLiveChannel] = useState<LiveStreamChannel | null>(null);
  const [pinnedProduct, setPinnedProduct] = useState<PinnedProduct | null>(null);

  // Cart state
  const [cart, setCart] = useState<Array<{ id: string; title: string; price: number; quantity: number }>>([]);
  const [cartNotice, setCartNotice] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const [storesRes, liveRes] = await Promise.all([
        api.getMarketplaceStores("groceries").catch(() => ({ stores: [] })),
        api.getMarketplaceLiveChannels().catch(() => ({ liveChannels: [] })),
      ]);

      const groceryStores: MarketplaceStore[] = storesRes.stores || [];
      setStores(groceryStores);

      // Filter live channels for groceries
      const live: LiveStreamChannel[] = (liveRes.liveChannels || [])
        .filter((c: any) => c.category === "groceries" || !c.category)
        .map((c: any) => ({
          id: c.id,
          name: c.name,
          slug: c.slug,
          logo_url: c.logo_url,
          banner_url: c.banner_url,
          category: c.category || "groceries",
          live_channel_title: c.live_channel_title,
          live_stream_url: c.live_stream_url,
          live_viewer_count: c.live_viewer_count || 120,
        }));
      setLiveChannels(live);

      // Load products from primary grocery stores
      if (groceryStores.length > 0) {
        const primaryStore = groceryStores[0];
        const prodRes = await api.getMarketplaceStoreProducts(primaryStore.id).catch(() => ({ products: [] }));
        const prods: ProductItem[] = (prodRes.products || []).map((p: any) => ({
          id: p.id,
          store_id: primaryStore.id,
          store_name: primaryStore.name,
          title: p.title,
          description: p.description,
          price: Number(p.price) || 0,
          compare_at_price: p.compare_at_price ? Number(p.compare_at_price) : null,
          badge: p.badge,
          image_url: p.image_url,
          category_name: p.category_name,
        }));
        setFeaturedProducts(prods);
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  function handleOpenLive(channel: LiveStreamChannel) {
    setActiveLiveChannel(channel);
    // Find an item to pin
    const samplePinned = featuredProducts.find((p) => p.store_id === channel.id) || featuredProducts[0];
    if (samplePinned) {
      setPinnedProduct({
        id: samplePinned.id,
        title: samplePinned.title,
        price: samplePinned.price,
        compare_at_price: samplePinned.compare_at_price || undefined,
        image_url: samplePinned.image_url || undefined,
        badge: samplePinned.badge || undefined,
      });
    }
  }

  function handleAddToCart(item: { id: string; title: string; price: number }) {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === item.id);
      if (existing) {
        return prev.map((i) => (i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i));
      }
      return [...prev, { id: item.id, title: item.title, price: item.price, quantity: 1 }];
    });
    setCartNotice(`Added "${item.title}" to cart!`);
    setTimeout(() => setCartNotice(""), 2500);
  }

  const filteredStores = stores.filter((s) =>
    `${s.name} ${s.description || ""} ${s.address || ""}`.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredProducts = featuredProducts.filter((p) => {
    const matchesCat = selectedCategory === "All" || p.category_name === selectedCategory;
    const matchesQuery = `${p.title} ${p.description || ""}`.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesQuery;
  });

  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="mx-auto max-w-xl space-y-5 px-4 pb-28 pt-4">
      {/* Top Header */}
      <header className="flex items-center justify-between">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-gold">Fast Delivery</span>
          <h1 className="font-serif text-2xl font-black text-ink">Groceries & Supermarkets</h1>
        </div>
        <Link
          href="/shoplist"
          className="flex items-center gap-1.5 rounded-full bg-[rgb(var(--surface-muted))] px-3.5 py-1.5 text-xs font-bold text-ink hover:text-gold transition"
        >
          <span>Quick List</span>
          <Sparkles className="h-3.5 w-3.5 text-gold" />
        </Link>
      </header>

      {/* Search Input */}
      <div className="relative">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search fresh produce, milk, eggs, pantry staples…"
          className="w-full rounded-2xl border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] pl-10 pr-4 py-3 text-sm text-ink placeholder:text-ink-500/60 shadow-sm focus:border-gold focus:outline-none"
        />
        <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-ink-500" />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            className="absolute right-3.5 top-3.5 text-ink-500 hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* "LIVE NOW" Story Rail (TikTok Live Shopping) */}
      {liveChannels.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-red-600">
              <Radio className="h-3.5 w-3.5 animate-pulse" />
              <span>Live Selling Now</span>
            </span>
            <span className="text-[11px] font-semibold text-ink-500">Tap to watch & shop</span>
          </div>

          <div className="flex items-center gap-3.5 overflow-x-auto no-scrollbar py-1">
            {liveChannels.map((c) => (
              <button
                key={c.id}
                onClick={() => handleOpenLive(c)}
                className="group flex flex-col items-center gap-1.5 shrink-0 transition active:scale-95"
              >
                <div className="relative rounded-full p-[2.5px] bg-gradient-to-tr from-amber-500 via-red-500 to-pink-500 shadow-md">
                  <div className="relative h-15 w-15 overflow-hidden rounded-full border-2 border-[rgb(var(--color-cream))] bg-neutral-900">
                    {c.logo_url ? (
                      <img
                        src={c.logo_url}
                        alt={c.name}
                        className="h-full w-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                          const fb = e.currentTarget.nextElementSibling as HTMLElement | null;
                          if (fb) fb.style.display = "flex";
                        }}
                      />
                    ) : null}
                    <div
                      style={{ display: c.logo_url ? "none" : "flex" }}
                      className="h-full w-full items-center justify-center font-bold text-gold text-xs"
                    >
                      {c.name.slice(0, 2).toUpperCase()}
                    </div>
                  </div>
                  <span className="absolute -bottom-1 inset-x-0 mx-auto w-fit rounded-full bg-red-600 px-2 py-0.2 text-[8px] font-black uppercase tracking-wider text-white shadow">
                    LIVE
                  </span>
                </div>
                <span className="max-w-[72px] truncate text-center text-[11px] font-bold text-ink">
                  {c.name}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Category Pills */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
        {GROCERY_CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold transition active:scale-95 ${
              selectedCategory === cat
                ? "bg-gold text-ink-gold shadow-sm"
                : "bg-[rgb(var(--surface-card))] text-ink-500 border border-[var(--border-faint)] hover:text-ink"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Notice Banner */}
      {cartNotice && (
        <div className="flex items-center justify-between rounded-2xl bg-gold/15 p-3 text-xs font-bold text-ink animate-fade-in">
          <span>{cartNotice}</span>
          <span className="text-gold font-mono">{cartItemCount} items</span>
        </div>
      )}

      {/* Featured Groceries Catalog Grid */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-ink">
            {selectedCategory === "All" ? "Fresh & Trending Today" : selectedCategory}
          </h2>
          <span className="text-xs font-medium text-ink-500">{filteredProducts.length} items</span>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((n) => (
              <div
                key={n}
                className="h-48 animate-pulse rounded-[22px] bg-[rgb(var(--surface-muted))]"
              />
            ))}
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="rounded-[24px] border border-dashed border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-8 text-center text-xs text-ink-500">
            No items matching your filter in this category.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filteredProducts.map((p) => (
              <div
                key={p.id}
                className="flex flex-col justify-between rounded-[22px] border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-3 shadow-sm transition hover:shadow-md"
              >
                <div>
                  <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-neutral-100 dark:bg-neutral-800">
                    <ProductImage
                      src={p.image_url}
                      alt={p.title}
                      category={p.category_name || "Groceries"}
                      className="h-full w-full object-cover transition duration-300 hover:scale-105"
                      aspectRatio="square"
                    />
                    {p.badge && (
                      <span className="absolute top-2 left-2 z-10 rounded-full bg-gold px-2 py-0.5 text-[9px] font-black text-ink-gold uppercase">
                        {p.badge}
                      </span>
                    )}
                    {p.compare_at_price && p.compare_at_price > p.price && (
                      <span className="absolute top-2 right-2 z-10 rounded-full bg-red-600 px-2 py-0.5 text-[9px] font-bold text-white">
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
                    onClick={() => handleAddToCart(p)}
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-gold text-ink-gold shadow transition active:scale-90"
                    title="Add to Cart"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Supermarkets / Grocery Stores List */}
      <section className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-ink">Supermarkets & Produce Hubs</h2>
          <span className="text-xs font-medium text-ink-500">{filteredStores.length} stores</span>
        </div>

        <div className="space-y-3">
          {filteredStores.map((s) => (
            <Link
              key={s.id}
              href={`/store/${s.id}`}
              className="flex items-center gap-3.5 rounded-[24px] border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-3.5 shadow-sm transition hover:shadow-md active:scale-98"
            >
              <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-neutral-100 dark:bg-neutral-800">
                {s.logo_url ? (
                  <img
                    src={s.logo_url}
                    alt={s.name}
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                      const fb = e.currentTarget.nextElementSibling as HTMLElement | null;
                      if (fb) fb.style.display = "flex";
                    }}
                  />
                ) : null}
                <div
                  style={{ display: s.logo_url ? "none" : "flex" }}
                  className="h-full w-full items-center justify-center bg-gold/20 font-bold text-gold text-lg"
                >
                  {s.name.slice(0, 2).toUpperCase()}
                </div>
                {s.is_live ? (
                  <span className="absolute bottom-1 inset-x-1 rounded-full bg-red-600 text-center text-[7px] font-black uppercase text-white animate-pulse">
                    LIVE
                  </span>
                ) : null}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm text-ink truncate">{s.name}</h3>
                </div>
                <p className="mt-0.5 text-xs text-ink-500 line-clamp-1">
                  {s.description || s.address || "Fresh organic produce and pantry items"}
                </p>
                <div className="mt-2 flex items-center gap-3 text-[11px] font-semibold text-ink-500">
                  <span className="flex items-center gap-1 text-gold">
                    <Truck className="h-3 w-3" /> 20-30 mins
                  </span>
                  <span>Min {ugx(s.min_order_amount || 5000)}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Floating Cart Button */}
      {cartItemCount > 0 && (
        <div className="fixed inset-x-4 bottom-20 z-40 mx-auto max-w-md animate-slide-up">
          <Link
            href="/shopping"
            className="flex items-center justify-between rounded-full bg-ink px-5 py-3.5 text-cream shadow-xl transition active:scale-98"
          >
            <div className="flex items-center gap-2.5">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gold text-xs font-black text-ink-gold">
                {cartItemCount}
              </span>
              <span className="text-xs font-bold">Review Groceries Order</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-black text-gold">{ugx(cartTotal)}</span>
              <span className="text-xs font-bold text-white/80">Checkout →</span>
            </div>
          </Link>
        </div>
      )}

      {/* Live Stream Viewer Modal */}
      {activeLiveChannel && (
        <LiveStreamViewer
          channel={activeLiveChannel}
          pinnedProduct={pinnedProduct}
          onClose={() => setActiveLiveChannel(null)}
          onAddToCart={(p) => handleAddToCart({ id: p.id, title: p.title, price: p.price })}
        />
      )}
    </div>
  );
}
