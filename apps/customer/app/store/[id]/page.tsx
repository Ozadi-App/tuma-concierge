"use client";

import {
  ArrowLeft,
  Check,
  ChevronRight,
  Flame,
  Heart,
  LayoutGrid,
  MessageCircle,
  Minus,
  Plus,
  Radio,
  Search,
  Share2,
  ShoppingBag,
  SlidersHorizontal,
  Sparkles,
  Store,
  Trash2,
  Truck,
  X,
} from "lucide-react";
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
  tag?: "popular" | "recent" | "recommended";
}

interface CartItem {
  id: string;
  productId: string;
  title: string;
  variantTitle?: string;
  price: number;
  quantity: number;
  image_url?: string;
  selected: boolean;
}

const ugx = (val: number) => `UGX ${Number(val).toLocaleString("en-UG")}`;

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

  // SCREEN 2: Single Product Detail Modal
  const [detailProduct, setDetailProduct] = useState<StoreProduct | null>(null);
  const [selectedSize, setSelectedSize] = useState<string>("M");
  const [selectedColor, setSelectedColor] = useState<string>("Default");
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [detailQuantity, setDetailQuantity] = useState<number>(1);
  const [favorites, setFavorites] = useState<Record<string, boolean>>({});

  // SCREEN 3: In-Store Cart Drawer
  const [showCartDrawer, setShowCartDrawer] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartNotice, setCartNotice] = useState("");
  const [checkoutStep, setCheckoutStep] = useState<"cart" | "address" | "success">("cart");
  const [deliveryAddress, setDeliveryAddress] = useState("Acacia Avenue, Kololo, Kampala");
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);

  // Live Stream modal
  const [showLiveViewer, setShowLiveViewer] = useState(false);

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

  function toggleFavorite(id: string, e?: React.MouseEvent) {
    if (e) e.stopPropagation();
    setFavorites((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function openProductDetail(prod: StoreProduct) {
    setDetailProduct(prod);
    setDetailQuantity(1);
    setSelectedSize("M");
    if (prod.variants && prod.variants.length > 0) {
      setSelectedVariant(prod.variants[0]);
    } else {
      setSelectedVariant(null);
    }
  }

  function addToCart(prod: StoreProduct, variant?: ProductVariant, qty: number = 1, openCartAfter = false) {
    const itemPrice = variant ? variant.price : prod.price;
    const itemKey = variant ? `${prod.id}-${variant.title}` : prod.id;

    setCart((prev) => {
      const existing = prev.find((i) => i.id === itemKey);
      if (existing) {
        return prev.map((i) => (i.id === itemKey ? { ...i, quantity: i.quantity + qty } : i));
      }
      return [
        ...prev,
        {
          id: itemKey,
          productId: prod.id,
          title: prod.title,
          variantTitle: variant?.title || (prod.has_variants ? `Size ${selectedSize}` : undefined),
          price: itemPrice,
          quantity: qty,
          image_url: prod.image_url || undefined,
          selected: true,
        },
      ];
    });

    setCartNotice(`Added ${prod.title} to cart`);
    setTimeout(() => setCartNotice(""), 2200);

    if (openCartAfter) {
      setDetailProduct(null);
      setShowCartDrawer(true);
    }
  }

  function updateCartQuantity(itemKey: string, delta: number) {
    setCart((prev) => {
      return prev
        .map((i) => {
          if (i.id === itemKey) {
            const newQty = i.quantity + delta;
            return newQty > 0 ? { ...i, quantity: newQty } : null;
          }
          return i;
        })
        .filter(Boolean) as CartItem[];
    });
  }

  function toggleItemSelection(itemKey: string) {
    setCart((prev) => prev.map((i) => (i.id === itemKey ? { ...i, selected: !i.selected } : i)));
  }

  function removeCartItem(itemKey: string) {
    setCart((prev) => prev.filter((i) => i.id !== itemKey));
  }

  // Filter Products by Tab, Search, and Category
  const filteredProducts = products.filter((p) => {
    // Tab filter
    if (activeTab === "Popular" && !p.badge && (!p.compare_at_price || p.compare_at_price <= p.price)) {
      return false;
    }
    if (activeTab === "Recent" && p.badge !== "New" && p.badge !== "Trending") {
      // Show newer items or fallback
    }
    if (activeTab === "Recommended" && !p.badge && !p.has_variants) {
      // Show recommended
    }

    // Category filter
    if (selectedCategory !== "All" && p.category_name !== selectedCategory) {
      return false;
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const match = p.title.toLowerCase().includes(q) || (p.description && p.description.toLowerCase().includes(q));
      if (!match) return false;
    }

    return true;
  });

  const categories = ["All", ...Array.from(new Set(products.map((p) => p.category_name).filter(Boolean)))];

  const selectedCartItems = cart.filter((i) => i.selected);
  const cartSubtotal = selectedCartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const deliveryFee = cartSubtotal > 0 ? 3000 : 0;
  const cartTotal = cartSubtotal + deliveryFee;
  const totalItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const handleCheckout = () => {
    if (selectedCartItems.length === 0) return;
    setCheckoutStep("address");
  };

  const handleConfirmPay = () => {
    setIsPlacingOrder(true);
    setTimeout(() => {
      setIsPlacingOrder(false);
      setCheckoutStep("success");
      setCart([]);
    }, 1200);
  };

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="h-9 w-9 animate-spin rounded-full border-3 border-gold border-t-transparent" />
          <p className="text-sm font-semibold text-ink-500">Opening store…</p>
        </div>
      </div>
    );
  }

  if (!store) {
    return (
      <div className="mx-auto max-w-md p-6 text-center space-y-4">
        <h2 className="text-xl font-bold text-ink">Store Not Found</h2>
        <p className="text-xs text-ink-500">The store you requested is not currently active.</p>
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

  // Featured promo item for the "Big Sale" banner (Screen 1 inspiration)
  const promoProduct = products.find((p) => p.compare_at_price && p.compare_at_price > p.price) || products[0];

  return (
    <div className="min-h-screen bg-[rgb(var(--color-bg))] pb-28 pt-2 px-4 max-w-md mx-auto text-ink">
      {/* =========================================================================
          SCREEN 1: STOREFRONT HEADER (Inspiration Screen 1)
      ========================================================================= */}
      <header className="flex items-center justify-between py-2">
        {/* Left: 4-square grid button in soft squircle */}
        <button
          type="button"
          onClick={() => router.push("/stores")}
          className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[rgb(var(--surface-muted))] border border-[var(--border-faint)] text-ink transition-transform active:scale-95"
          aria-label="All Stores"
        >
          <LayoutGrid className="h-5 w-5" />
        </button>

        {/* Center: Greeting & Store Name */}
        <div className="text-center min-w-0 px-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-ink-500 truncate">
            {store.address ? store.address.split(",")[0] : "Kampala, UG"}
          </p>
          <h1 className="text-base font-extrabold text-ink truncate leading-tight">{store.name}</h1>
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
          SEARCH & FILTER BAR (Inspiration Screen 1)
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
            <button type="button" onClick={() => setSearchQuery("")} className="text-ink-500">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => {
            const nextTab = activeTab === "All" ? "Popular" : activeTab === "Popular" ? "Recent" : activeTab === "Recent" ? "Recommended" : "All";
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
      <div className="relative overflow-hidden rounded-[28px] border border-gold/30 bg-gradient-to-r from-gold/25 via-gold/10 to-[rgb(var(--surface-card))] p-4 mt-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          {/* Promo Graphic */}
          <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-neutral-900 shadow-md">
            {promoProduct?.image_url ? (
              <img
                src={promoProduct.image_url}
                alt={promoProduct.title}
                className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
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
              {promoProduct?.title || "Exclusive Store Drop"}
            </h2>
            <p className="text-[11px] text-ink-500 line-clamp-2 mt-0.5 leading-snug">
              Get trending items at a discount of up to 40% with fast citywide delivery.
            </p>
            {promoProduct && (
              <button
                type="button"
                onClick={() => openProductDetail(promoProduct)}
                className="mt-2 text-[11px] font-bold text-gold hover:underline flex items-center gap-1"
              >
                <span>View Offer</span>
                <ChevronRight className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Live Stream Alert (if Store is broadcasting Live) */}
      {store.is_live && (
        <button
          type="button"
          onClick={() => setShowLiveViewer(true)}
          className="mt-3 w-full flex items-center justify-between rounded-2xl bg-gradient-to-r from-red-600 to-rose-600 p-3 text-white shadow-md transition-transform active:scale-98"
        >
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 rounded-full bg-white animate-ping" />
            <span className="text-xs font-bold uppercase tracking-wide">Live Stream Broadcast Active</span>
          </div>
          <span className="rounded-full bg-black/40 px-2.5 py-0.5 text-[10px] font-bold">Watch & Buy →</span>
        </button>
      )}

      {/* =========================================================================
          SEGMENTED FILTER TABS (Inspiration Screen 1: All, Popular, Recent, Recommended)
      ========================================================================= */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar py-3 scrollbar-none">
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
                  : "bg-[rgb(var(--surface-muted))] text-ink-500 border border-[var(--border-faint)] hover:text-ink"
              }`}
            >
              {tab}
            </button>
          );
        })}
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
                  : "bg-[rgb(var(--surface-card))] text-ink-500 border border-[var(--border-faint)]"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Notification Toast */}
      {cartNotice && (
        <div className="fixed top-4 inset-x-4 z-50 mx-auto max-w-sm rounded-2xl bg-gold p-3 text-center text-xs font-bold text-ink-gold shadow-xl animate-in fade-in slide-in-from-top duration-200">
          {cartNotice}
        </div>
      )}

      {/* =========================================================================
          2-COLUMN PRODUCT GRID (Inspiration Screen 1)
      ========================================================================= */}
      <section className="mt-1 space-y-3">
        <div className="flex items-center justify-between text-xs text-ink-500 font-semibold px-0.5">
          <span>{filteredProducts.length} items found</span>
          <span>Delivery 20-35 mins</span>
        </div>

        {filteredProducts.length === 0 ? (
          <div className="rounded-3xl border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-8 text-center space-y-2">
            <p className="text-sm font-bold text-ink">No items match your filter</p>
            <p className="text-xs text-ink-500">Try switching to the "All" tab or searching for another keyword.</p>
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
            {filteredProducts.map((p) => {
              const isFav = Boolean(favorites[p.id]);
              return (
                <div
                  key={p.id}
                  onClick={() => openProductDetail(p)}
                  className="home-card flex flex-col justify-between rounded-[26px] border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-3 shadow-xs hover:shadow-md transition-all cursor-pointer active:scale-[0.98]"
                >
                  <div>
                    {/* Large Vertical Image with Soft Background */}
                    <div className="relative aspect-[4/5] w-full overflow-hidden rounded-[20px] bg-neutral-100 dark:bg-neutral-800">
                      {p.image_url ? (
                        <img
                          src={p.image_url}
                          alt={p.title}
                          className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-4xl">🛍️</div>
                      )}

                      {/* Favorite Heart Button Overlay */}
                      <button
                        type="button"
                        onClick={(e) => toggleFavorite(p.id, e)}
                        className={`absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-full backdrop-blur-md transition-transform active:scale-80 ${
                          isFav ? "bg-red-500 text-white" : "bg-black/40 text-white/90 border border-white/20"
                        }`}
                        aria-label="Favorite"
                      >
                        <Heart className="h-3.5 w-3.5 fill-current" />
                      </button>

                      {/* Badges */}
                      {p.badge && (
                        <span className="absolute top-2 left-2 rounded-full bg-gold px-2 py-0.5 text-[9px] font-black text-ink-gold uppercase">
                          {p.badge}
                        </span>
                      )}
                      {p.compare_at_price && p.compare_at_price > p.price && !p.badge && (
                        <span className="absolute top-2 left-2 rounded-full bg-red-600 px-2 py-0.5 text-[9px] font-bold text-white uppercase">
                          Sale
                        </span>
                      )}
                    </div>

                    {/* Product Title */}
                    <div className="mt-2.5">
                      <h3 className="text-xs font-bold text-ink leading-snug truncate">{p.title}</h3>
                      <p className="text-[10px] text-ink-500 truncate mt-0.5">
                        {p.category_name || store.category}
                      </p>
                    </div>
                  </div>

                  {/* Price Row & Mini Round Action Button (Inspiration Screen 1) */}
                  <div className="mt-2.5 flex items-center justify-between pt-1 border-t border-[var(--border-faint)]">
                    <div>
                      <div className="text-xs font-black text-ink">{ugx(p.price)}</div>
                      {p.compare_at_price && p.compare_at_price > p.price && (
                        <div className="text-[10px] text-ink-500 line-through leading-none">
                          {ugx(p.compare_at_price)}
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        addToCart(p, undefined, 1, false);
                      }}
                      className="flex h-7 w-7 items-center justify-center rounded-full bg-gold/15 text-gold hover:bg-gold hover:text-ink-gold transition-colors active:scale-90"
                      title="Quick Add"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* =========================================================================
          BOTTOM STICKY BAR: In-Store Cart Capsule
      ========================================================================= */}
      {totalItemCount > 0 && (
        <div className="fixed inset-x-4 bottom-4 z-40 mx-auto max-w-md animate-in slide-in-from-bottom duration-300">
          <button
            type="button"
            onClick={() => setShowCartDrawer(true)}
            className="flex w-full items-center justify-between rounded-full bg-ink px-5 py-3.5 text-cream shadow-2xl transition-transform active:scale-98"
          >
            <div className="flex items-center gap-2.5">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gold text-xs font-black text-ink-gold">
                {totalItemCount}
              </span>
              <span className="text-xs font-bold">Review Bag</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-black text-gold">{ugx(cartTotal)}</span>
              <span className="text-xs font-bold text-white/80">View Cart →</span>
            </div>
          </button>
        </div>
      )}

      {/* =========================================================================
          SCREEN 2: PRODUCT DETAIL VIEW (Inspiration Screen 2)
      ========================================================================= */}
      {detailProduct && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 overflow-y-auto">
          <div className="relative w-full max-w-md rounded-t-[36px] sm:rounded-[36px] bg-[rgb(var(--surface-card))] border border-[var(--border-faint)] shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom duration-200">
            {/* Massive Hero Photo with Curved Bottom Edge */}
            <div className="relative h-[360px] sm:h-[400px] w-full bg-neutral-900 rounded-b-[36px] overflow-hidden">
              {detailProduct.image_url ? (
                <img
                  src={detailProduct.image_url}
                  alt={detailProduct.title}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-6xl">🛍️</div>
              )}

              {/* Floating Frosted Back Button (Top-Left) */}
              <button
                type="button"
                onClick={() => setDetailProduct(null)}
                className="absolute top-4 left-4 flex h-11 w-11 items-center justify-center rounded-full bg-black/40 backdrop-blur-md text-white border border-white/20 shadow-md transition-transform active:scale-90"
                aria-label="Back"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>

              {/* Floating Frosted Favorite Button (Top-Right) */}
              <button
                type="button"
                onClick={() => toggleFavorite(detailProduct.id)}
                className={`absolute top-4 right-4 flex h-11 w-11 items-center justify-center rounded-full backdrop-blur-md border border-white/20 shadow-md transition-transform active:scale-90 ${
                  favorites[detailProduct.id] ? "bg-red-500 text-white" : "bg-black/40 text-white"
                }`}
                aria-label="Favorite"
              >
                <Heart className="h-5 w-5 fill-current" />
              </button>

              {/* Badge Overlay */}
              {detailProduct.badge && (
                <div className="absolute bottom-4 left-4">
                  <span className="rounded-full bg-gold px-3 py-1 text-xs font-black text-ink-gold uppercase shadow-md">
                    {detailProduct.badge}
                  </span>
                </div>
              )}
            </div>

            {/* Details Section */}
            <div className="p-5 space-y-4">
              {/* Product Title on Left, Price on Right */}
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h2 className="text-xl font-extrabold text-ink leading-tight truncate">
                    {detailProduct.title}
                  </h2>
                  <p className="text-xs font-semibold text-gold mt-0.5">
                    {detailProduct.category_name || store.name} · Verified Quality
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xl font-black text-gold">
                    {ugx(selectedVariant?.price || detailProduct.price)}
                  </div>
                  {detailProduct.compare_at_price && detailProduct.compare_at_price > detailProduct.price && (
                    <div className="text-xs text-ink-500 line-through">
                      {ugx(detailProduct.compare_at_price)}
                    </div>
                  )}
                </div>
              </div>

              {/* Description */}
              <p className="text-xs text-ink-500 leading-relaxed">
                {detailProduct.description ||
                  "Crafted with premium materials for maximum comfort and durability. Available in multiple sizes with immediate same-day delivery across Kampala."}
              </p>

              {/* Variants Selector (Size Chips) */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-ink block">
                  Select Size / Variant
                </label>
                {detailProduct.variants && detailProduct.variants.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {detailProduct.variants.map((v, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setSelectedVariant(v)}
                        className={`rounded-xl border px-3.5 py-2 text-xs font-bold transition-all ${
                          selectedVariant?.title === v.title
                            ? "border-gold bg-gold text-ink-gold shadow-sm font-extrabold"
                            : "border-[var(--border-faint)] bg-[rgb(var(--surface-muted))] text-ink-500 hover:text-ink"
                        }`}
                      >
                        {v.title}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="flex gap-2">
                    {["S", "M", "L", "XL"].map((size) => (
                      <button
                        key={size}
                        type="button"
                        onClick={() => setSelectedSize(size)}
                        className={`flex h-10 w-12 items-center justify-center rounded-xl border text-xs font-bold transition-all ${
                          selectedSize === size
                            ? "border-gold bg-gold text-ink-gold shadow-sm font-extrabold"
                            : "border-[var(--border-faint)] bg-[rgb(var(--surface-muted))] text-ink-500 hover:text-ink"
                        }`}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Quantity Stepper */}
              <div className="flex items-center justify-between pt-1">
                <span className="text-xs font-bold text-ink uppercase tracking-wider">Quantity</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setDetailQuantity((q) => Math.max(1, q - 1))}
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border-faint)] bg-[rgb(var(--surface-muted))] text-ink active:scale-90"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span className="w-8 text-center text-sm font-extrabold text-ink">{detailQuantity}</span>
                  <button
                    type="button"
                    onClick={() => setDetailQuantity((q) => q + 1)}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-gold text-ink-gold active:scale-90 shadow-sm"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Bottom Sticky Action Bar (Inspiration Screen 2: Buy Now + Round Cart button) */}
              <div className="flex items-center gap-3 pt-3 border-t border-[var(--border-faint)]">
                <button
                  type="button"
                  onClick={() => addToCart(detailProduct, selectedVariant || undefined, detailQuantity, true)}
                  className="flex-1 flex h-13 items-center justify-center rounded-full bg-gold font-extrabold text-sm text-ink-gold shadow-[var(--shadow-glow-gold)] active:scale-95 transition-transform"
                >
                  Buy Now • {ugx((selectedVariant?.price || detailProduct.price) * detailQuantity)}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    addToCart(detailProduct, selectedVariant || undefined, detailQuantity, false);
                    setDetailProduct(null);
                  }}
                  className="flex h-13 w-13 items-center justify-center rounded-full bg-[rgb(var(--surface-muted))] border border-[var(--border-faint)] text-ink transition-transform active:scale-90 shadow-xs relative"
                  title="Add to Bag"
                >
                  <ShoppingBag className="h-5 w-5" />
                  {totalItemCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-gold text-[10px] font-black text-ink-gold">
                      {totalItemCount}
                    </span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          SCREEN 3: IN-STORE CART & CHECKOUT DRAWER (Inspiration Screen 3)
      ========================================================================= */}
      {showCartDrawer && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4">
          <div className="w-full max-w-md rounded-t-[36px] sm:rounded-[36px] bg-[rgb(var(--surface-card))] border border-[var(--border-faint)] shadow-2xl p-5 space-y-4 animate-in fade-in slide-in-from-bottom duration-200 max-h-[90vh] flex flex-col">
            {/* Cart Top Bar (Inspiration Screen 3: Grid menu, "Cart", Profile) */}
            <div className="flex items-center justify-between border-b border-[var(--border-faint)] pb-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[rgb(var(--surface-muted))] text-ink">
                <ShoppingBag className="h-4.5 w-4.5 text-gold" />
              </div>
              <h2 className="text-base font-extrabold text-ink">
                Your Bag ({cart.length} items)
              </h2>
              <button
                type="button"
                onClick={() => {
                  setShowCartDrawer(false);
                  setCheckoutStep("cart");
                }}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-[rgb(var(--surface-muted))] text-ink hover:text-ink-500"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content Switcher */}
            {checkoutStep === "cart" ? (
              <>
                {/* Cart Items List */}
                <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                  {cart.length === 0 ? (
                    <div className="py-12 text-center space-y-2">
                      <p className="text-sm font-bold text-ink">Your bag is empty</p>
                      <p className="text-xs text-ink-500">Pick items from the catalog to start checkout.</p>
                    </div>
                  ) : (
                    cart.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-2xl border border-[var(--border-faint)] bg-[rgb(var(--surface-muted))] p-3 flex items-center justify-between gap-3 shadow-xs"
                      >
                        {/* Rounded Thumbnail */}
                        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-neutral-900 border border-[var(--border-faint)]">
                          {item.image_url ? (
                            <img src={item.image_url} alt={item.title} className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-xl">🛍️</div>
                          )}
                        </div>

                        {/* Title, Subtitle, Price */}
                        <div className="flex-1 min-w-0">
                          <h4 className="text-xs font-bold text-ink truncate">{item.title}</h4>
                          {item.variantTitle && (
                            <p className="text-[10px] text-ink-500 truncate">{item.variantTitle}</p>
                          )}
                          <div className="text-xs font-black text-gold mt-1">{ugx(item.price)}</div>

                          {/* Stepper `- 1 +` */}
                          <div className="flex items-center gap-2 mt-2">
                            <button
                              type="button"
                              onClick={() => updateCartQuantity(item.id, -1)}
                              className="flex h-6 w-6 items-center justify-center rounded-full bg-[rgb(var(--surface-card))] border border-[var(--border-faint)] text-ink active:scale-90"
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                            <span className="text-xs font-bold text-ink min-w-[16px] text-center">
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => updateCartQuantity(item.id, 1)}
                              className="flex h-6 w-6 items-center justify-center rounded-full bg-gold text-ink-gold active:scale-90"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>
                        </div>

                        {/* Rounded Checkbox (Inspiration Screen 3) */}
                        <div className="flex flex-col items-center gap-3 shrink-0">
                          <button
                            type="button"
                            onClick={() => toggleItemSelection(item.id)}
                            className={`flex h-6 w-6 items-center justify-center rounded-lg transition-colors ${
                              item.selected ? "bg-gold text-ink-gold" : "border border-[var(--border-faint)] bg-transparent"
                            }`}
                            aria-label="Select item for checkout"
                          >
                            {item.selected && <Check className="h-4 w-4 stroke-[3]" />}
                          </button>

                          <button
                            type="button"
                            onClick={() => removeCartItem(item.id)}
                            className="text-ink-500 hover:text-red-500 transition-colors p-1"
                            title="Remove"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Bottom Checkout Summary Bar (Inspiration Screen 3: Total on left, Pay Now on right) */}
                {cart.length > 0 && (
                  <div className="pt-3 border-t border-[var(--border-faint)] space-y-3">
                    <div className="flex items-center justify-between text-xs text-ink-500">
                      <span>Items Subtotal</span>
                      <span className="font-bold text-ink">{ugx(cartSubtotal)}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-ink-500">
                      <span>Doorstep Delivery</span>
                      <span className="font-bold text-ink">{ugx(deliveryFee)}</span>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <div>
                        <span className="text-[11px] font-bold uppercase text-ink-500 block">Total</span>
                        <span className="text-lg font-black text-gold">{ugx(cartTotal)}</span>
                      </div>

                      <button
                        type="button"
                        onClick={handleCheckout}
                        disabled={selectedCartItems.length === 0}
                        className={`rounded-full bg-gold px-8 py-3.5 text-sm font-extrabold text-ink-gold shadow-[var(--shadow-glow-gold)] active:scale-95 transition-transform ${
                          selectedCartItems.length === 0 ? "opacity-50 cursor-not-allowed" : ""
                        }`}
                      >
                        Pay Now
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : checkoutStep === "address" ? (
              <div className="space-y-4 py-2">
                <div className="flex items-center gap-2">
                  <Truck className="h-4 w-4 text-gold" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-ink">Delivery Location</h3>
                </div>

                <div className="field-box flex items-center rounded-2xl px-3 py-2.5">
                  <input
                    type="text"
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    placeholder="Physical delivery address / room"
                    className="w-full text-xs font-medium outline-none bg-transparent"
                  />
                </div>

                <div className="field-box flex items-center rounded-2xl px-3 py-2.5">
                  <input
                    type="text"
                    value={deliveryNotes}
                    onChange={(e) => setDeliveryNotes(e.target.value)}
                    placeholder="Rider instructions (e.g. call upon arrival)"
                    className="w-full text-xs font-medium outline-none bg-transparent"
                  />
                </div>

                <div className="rounded-2xl bg-[rgb(var(--surface-muted))] p-3 space-y-1.5 text-xs">
                  <div className="flex justify-between text-ink-500">
                    <span>Store items ({selectedCartItems.length})</span>
                    <span className="font-semibold text-ink">{ugx(cartSubtotal)}</span>
                  </div>
                  <div className="flex justify-between text-ink-500">
                    <span>Delivery fee</span>
                    <span className="font-semibold text-ink">{ugx(deliveryFee)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-ink pt-1 border-t border-[var(--border-faint)]">
                    <span>Total Payment</span>
                    <span className="text-gold font-extrabold">{ugx(cartTotal)}</span>
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setCheckoutStep("cart")}
                    className="flex-1 rounded-2xl border border-[var(--border-faint)] bg-[rgb(var(--surface-muted))] py-3 text-xs font-bold text-ink"
                  >
                    Back to Bag
                  </button>
                  <button
                    type="button"
                    disabled={isPlacingOrder}
                    onClick={handleConfirmPay}
                    className="flex-1 rounded-2xl bg-gold py-3 text-xs font-extrabold text-ink-gold shadow-[var(--shadow-glow-gold)] active:scale-95 transition-transform"
                  >
                    {isPlacingOrder ? "Processing..." : `Confirm & Pay ${ugx(cartTotal)}`}
                  </button>
                </div>
              </div>
            ) : (
              <div className="py-6 text-center space-y-3 animate-in fade-in duration-200">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gold/20 text-gold">
                  <Check className="h-8 w-8 stroke-[3]" />
                </div>
                <h3 className="text-lg font-bold text-ink">Order Placed Successfully!</h3>
                <p className="text-xs text-ink-500 leading-relaxed max-w-xs mx-auto">
                  {store.name} has received your order and is packing your items for swift courier pickup.
                </p>
                <div className="pt-3 flex flex-col gap-2">
                  <Link
                    href="/orders"
                    className="flex h-12 w-full items-center justify-center rounded-2xl bg-gold font-bold text-ink-gold shadow-[var(--shadow-glow-gold)]"
                  >
                    Track Live Order
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCartDrawer(false);
                      setCheckoutStep("cart");
                    }}
                    className="text-xs font-semibold text-ink-500 underline py-2"
                  >
                    Continue Shopping
                  </button>
                </div>
              </div>
            )}
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
          onAddToCart={(p) =>
            addToCart(
              {
                id: p.id,
                store_id: store.id,
                title: p.title,
                price: p.price,
                compare_at_price: p.compare_at_price || null,
                image_url: p.image_url || null,
                description: null,
              },
              undefined,
              1,
              false
            )
          }
        />
      )}
    </div>
  );
}
