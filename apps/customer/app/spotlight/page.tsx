"use client";

import {
  Check,
  ChevronLeft,
  ChevronRight,
  Flame,
  Heart,
  MessageCircle,
  Radio,
  Share2,
  ShoppingBag,
  Sparkles,
  Store,
  Tag,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { api, errorMessage } from "../../lib/api";

interface SpotlightItem {
  id: string;
  store_id: string;
  store_name: string;
  store_slug: string;
  store_logo: string;
  store_category: "groceries" | "stores";
  type: "live" | "video" | "image" | "carousel";
  media_url: string;
  carousel_images?: string[];
  title: string;
  description: string;
  product: {
    id: string;
    title: string;
    price: number;
    compare_at_price?: number;
    image_url: string;
    badge?: string;
  };
  viewer_count?: number;
  likes_count: number;
  comments_count: number;
}

const ugx = (val: number) => `UGX ${Number(val).toLocaleString()}`;

export default function SpotlightPage() {
  const [items, setItems] = useState<SpotlightItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<"all" | "live" | "groceries" | "stores">("all");
  const [isMuted, setIsMuted] = useState(true);

  // Likes and comments state per item
  const [likedMap, setLikedMap] = useState<Record<string, boolean>>({});
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
  const [activeCommentsItem, setActiveCommentsItem] = useState<SpotlightItem | null>(null);
  const [itemComments, setItemComments] = useState<Record<string, Array<{ user: string; text: string }>>>({});
  const [newCommentText, setNewCommentText] = useState("");

  // Quick Cart state
  const [cart, setCart] = useState<Array<{ id: string; title: string; price: number; quantity: number }>>([]);
  const [quickBuyNotice, setQuickBuyNotice] = useState("");

  // Carousel current indexes per item
  const [carouselIndices, setCarouselIndices] = useState<Record<string, number>>({});

  useEffect(() => {
    loadSpotlight();
  }, [categoryFilter]);

  async function loadSpotlight() {
    setLoading(true);
    setError("");
    try {
      const res = await api.getMarketplaceSpotlight(categoryFilter);
      const list: SpotlightItem[] = res.spotlight || [];
      setItems(list);

      // Initialize like counts
      const counts: Record<string, number> = {};
      const comments: Record<string, Array<{ user: string; text: string }>> = {};
      list.forEach((item) => {
        counts[item.id] = item.likes_count || 120;
        comments[item.id] = [
          { user: item.store_name, text: "Welcome! Tap the product card to buy with same-day dispatch ⚡" },
          { user: "Amina K.", text: "Is this currently in stock in Kampala?" },
          { user: "Kato P.", text: "Love the quality of this! Super clean." },
        ];
      });
      setLikeCounts(counts);
      setItemComments(comments);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  function handleToggleLike(id: string) {
    const isCurrentlyLiked = likedMap[id];
    setLikedMap((prev) => ({ ...prev, [id]: !isCurrentlyLiked }));
    setLikeCounts((prev) => ({
      ...prev,
      [id]: (prev[id] || 0) + (isCurrentlyLiked ? -1 : 1),
    }));
  }

  function handleAddComment() {
    if (!activeCommentsItem || !newCommentText.trim()) return;
    const itemId = activeCommentsItem.id;
    setItemComments((prev) => ({
      ...prev,
      [itemId]: [...(prev[itemId] || []), { user: "You", text: newCommentText.trim() }],
    }));
    setNewCommentText("");
  }

  function handleQuickBuy(prod: SpotlightItem["product"]) {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === prod.id);
      if (existing) {
        return prev.map((i) => (i.id === prod.id ? { ...i, quantity: i.quantity + 1 } : i));
      }
      return [...prev, { id: prod.id, title: prod.title, price: prod.price, quantity: 1 }];
    });
    setQuickBuyNotice(`Added "${prod.title}" to cart!`);
    setTimeout(() => setQuickBuyNotice(""), 2400);
  }

  function handleCarouselNav(itemId: string, direction: "prev" | "next", total: number) {
    setCarouselIndices((prev) => {
      const current = prev[itemId] || 0;
      const nextIndex = direction === "next" ? (current + 1) % total : (current - 1 + total) % total;
      return { ...prev, [itemId]: nextIndex };
    });
  }

  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="relative h-[calc(100vh-80px)] w-full overflow-hidden bg-black text-white">
      {/* Top Floating Bar */}
      <header className="absolute top-0 inset-x-0 z-30 flex items-center justify-between p-4 pt-3 bg-gradient-to-b from-black/80 via-black/40 to-transparent backdrop-blur-[2px]">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-gold/25 text-gold font-bold">
            <Sparkles className="h-4 w-4" />
          </span>
          <h1 className="font-serif text-lg font-black tracking-tight text-white drop-shadow">
            Spotlight
          </h1>
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-1.5 rounded-full bg-black/50 p-1 backdrop-blur-md border border-white/15">
          {(["all", "live", "groceries", "stores"] as const).map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase transition ${
                categoryFilter === cat
                  ? "bg-gold text-ink-gold shadow-sm"
                  : "text-white/70 hover:text-white"
              }`}
            >
              {cat === "all" ? "All" : cat === "live" ? "🔴 Live" : cat === "groceries" ? "Groceries" : "Stores"}
            </button>
          ))}
        </div>

        {/* Mute Toggle */}
        <button
          onClick={() => setIsMuted((prev) => !prev)}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white/90 backdrop-blur-md transition hover:bg-black/75 active:scale-95"
          title={isMuted ? "Unmute audio" : "Mute audio"}
        >
          {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4 text-gold" />}
        </button>
      </header>

      {/* Quick Add Notice */}
      {quickBuyNotice && (
        <div className="absolute top-16 inset-x-4 z-40 mx-auto max-w-sm rounded-2xl bg-gold/90 px-4 py-2.5 text-center text-xs font-black text-ink-gold shadow-2xl backdrop-blur-md animate-fade-in">
          {quickBuyNotice}
        </div>
      )}

      {/* Endless Vertical Feed Container */}
      {loading ? (
        <div className="flex h-full w-full items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="h-10 w-10 animate-spin rounded-full border-3 border-gold border-t-transparent" />
            <p className="text-xs font-semibold text-neutral-400">Loading Spotlight feed…</p>
          </div>
        </div>
      ) : items.length === 0 ? (
        <div className="flex h-full w-full flex-col items-center justify-center p-6 text-center space-y-3">
          <div className="text-4xl">✨</div>
          <h2 className="text-base font-bold text-white">No spotlight items found</h2>
          <p className="text-xs text-neutral-400 max-w-xs">
            Try switching category filters or check back shortly for new video drops and live broadcasts.
          </p>
          <button
            onClick={() => setCategoryFilter("all")}
            className="rounded-full bg-gold px-5 py-2 text-xs font-bold text-ink-gold"
          >
            Show All Feeds
          </button>
        </div>
      ) : (
        <div className="h-full w-full overflow-y-scroll snap-y snap-mandatory no-scrollbar">
          {items.map((item) => {
            const isLiked = likedMap[item.id];
            const currentLikeCount = likeCounts[item.id] || 0;
            const carouselIdx = carouselIndices[item.id] || 0;
            const carouselList = item.carousel_images && item.carousel_images.length > 0
              ? item.carousel_images
              : [item.media_url];

            return (
              <section
                key={item.id}
                className="relative h-full w-full snap-start flex flex-col justify-between overflow-hidden bg-black"
              >
                {/* Media Background */}
                <div className="absolute inset-0">
                  {item.type === "live" || item.type === "video" ? (
                    <video
                      src={item.media_url}
                      autoPlay
                      loop
                      muted={isMuted}
                      playsInline
                      className="h-full w-full object-cover"
                    />
                  ) : item.type === "carousel" ? (
                    <div className="relative h-full w-full">
                      <img
                        src={carouselList[carouselIdx]}
                        alt={item.title}
                        className="h-full w-full object-cover transition duration-300"
                      />
                      {carouselList.length > 1 && (
                        <>
                          <button
                            onClick={() => handleCarouselNav(item.id, "prev", carouselList.length)}
                            className="absolute left-2 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-md"
                          >
                            <ChevronLeft className="h-5 w-5" />
                          </button>
                          <button
                            onClick={() => handleCarouselNav(item.id, "next", carouselList.length)}
                            className="absolute right-14 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-md"
                          >
                            <ChevronRight className="h-5 w-5" />
                          </button>
                          <div className="absolute bottom-48 inset-x-0 flex justify-center gap-1.5">
                            {carouselList.map((_, dotIdx) => (
                              <div
                                key={dotIdx}
                                className={`h-1.5 rounded-full transition-all ${
                                  dotIdx === carouselIdx ? "w-4 bg-gold" : "w-1.5 bg-white/40"
                                }`}
                              />
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  ) : (
                    <img
                      src={item.media_url}
                      alt={item.title}
                      className="h-full w-full object-cover"
                    />
                  )}

                  {/* Gradient vignettes for readable text */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/20 to-black/50" />
                </div>

                {/* Top Badge Overlay */}
                <div className="relative z-10 pt-16 px-4">
                  {item.type === "live" ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-red-600 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-white shadow animate-pulse">
                      <Radio className="h-3 w-3" /> LIVE · {item.viewer_count || 142} watching
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-black/40 px-2.5 py-0.5 text-[10px] font-bold text-white/90 backdrop-blur-md border border-white/10">
                      {item.type === "video" ? "📹 Reel" : item.type === "carousel" ? "🖼️ Lookbook" : "✨ Featured"}
                    </span>
                  )}
                </div>

                {/* Right Action Rail (TikTok / Shorts style) */}
                <aside className="absolute right-3 bottom-24 z-20 flex flex-col items-center gap-4">
                  {/* Store Avatar */}
                  <Link
                    href={`/store/${item.store_id}`}
                    className="relative group flex flex-col items-center active:scale-95 transition"
                  >
                    <div className="h-11 w-11 overflow-hidden rounded-full border-2 border-gold bg-neutral-900 shadow-md">
                      <img src={item.store_logo} alt={item.store_name} className="h-full w-full object-cover" />
                    </div>
                    <span className="absolute -bottom-1 rounded-full bg-gold p-0.5 text-[8px] font-bold text-ink">
                      +
                    </span>
                  </Link>

                  {/* Heart / Like Button */}
                  <button
                    onClick={() => handleToggleLike(item.id)}
                    className="flex flex-col items-center gap-1 active:scale-80 transition"
                  >
                    <div
                      className={`flex h-11 w-11 items-center justify-center rounded-full backdrop-blur-md transition ${
                        isLiked ? "bg-red-600 text-white" : "bg-black/50 text-white/90"
                      }`}
                    >
                      <Heart className={`h-5 w-5 ${isLiked ? "fill-current" : ""}`} />
                    </div>
                    <span className="text-[11px] font-bold drop-shadow">{currentLikeCount}</span>
                  </button>

                  {/* Comments Button */}
                  <button
                    onClick={() => setActiveCommentsItem(item)}
                    className="flex flex-col items-center gap-1 active:scale-90 transition"
                  >
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-black/50 text-white/90 backdrop-blur-md">
                      <MessageCircle className="h-5 w-5" />
                    </div>
                    <span className="text-[11px] font-bold drop-shadow">
                      {itemComments[item.id]?.length || item.comments_count || 12}
                    </span>
                  </button>

                  {/* Share Button */}
                  <button
                    onClick={() => {
                      if (navigator.share) {
                        navigator.share({ title: item.title, url: window.location.href }).catch(() => {});
                      }
                    }}
                    className="flex flex-col items-center gap-1 active:scale-90 transition"
                  >
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-black/50 text-white/90 backdrop-blur-md">
                      <Share2 className="h-4.5 w-4.5" />
                    </div>
                    <span className="text-[10px] font-bold drop-shadow">Share</span>
                  </button>
                </aside>

                {/* Bottom Left Content Info & Pinned Product Pill */}
                <div className="relative z-10 p-4 pb-20 pr-16 space-y-2.5">
                  {/* Store Name & Follow */}
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/store/${item.store_id}`}
                      className="font-bold text-sm text-white drop-shadow hover:text-gold transition truncate max-w-[180px]"
                    >
                      @{item.store_name}
                    </Link>
                    <span className="rounded-full bg-white/20 px-2 py-0.5 text-[9px] font-bold text-white/90">
                      {item.store_category === "groceries" ? "Groceries" : "Store"}
                    </span>
                  </div>

                  {/* Caption & Description */}
                  <div>
                    <h2 className="font-bold text-sm leading-snug drop-shadow line-clamp-2">
                      {item.title}
                    </h2>
                    {item.description && (
                      <p className="mt-1 text-xs text-white/80 line-clamp-2 leading-relaxed drop-shadow">
                        {item.description}
                      </p>
                    )}
                  </div>

                  {/* Interactive Product Shelf Card with 1-Tap Buy */}
                  {item.product && (
                    <div className="flex items-center justify-between gap-3 rounded-2xl bg-neutral-900/90 p-2.5 backdrop-blur-lg border border-gold/40 shadow-2xl">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl bg-neutral-800">
                          {item.product.image_url ? (
                            <img
                              src={item.product.image_url}
                              alt={item.product.title}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-base">🛍️</div>
                          )}
                          {item.product.badge && (
                            <span className="absolute top-0 left-0 rounded-br-lg bg-gold px-1.5 py-0.2 text-[8px] font-black text-ink-gold uppercase">
                              {item.product.badge}
                            </span>
                          )}
                        </div>

                        <div className="min-w-0">
                          <h4 className="font-bold text-xs leading-tight text-white truncate">
                            {item.product.title}
                          </h4>
                          <div className="flex items-baseline gap-1.5 mt-0.5">
                            <span className="font-mono text-xs font-black text-gold">
                              {ugx(item.product.price)}
                            </span>
                            {item.product.compare_at_price && (
                              <span className="font-mono text-[10px] text-white/50 line-through">
                                {ugx(item.product.compare_at_price)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => handleQuickBuy(item.product)}
                        className="flex items-center gap-1 rounded-full bg-gold px-3.5 py-2 text-xs font-black text-ink-gold shadow-md transition active:scale-95 shrink-0"
                      >
                        <ShoppingBag className="h-3.5 w-3.5" />
                        <span>Buy 1-Tap</span>
                      </button>
                    </div>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {/* Floating Cart Button */}
      {cartItemCount > 0 && (
        <div className="fixed inset-x-4 bottom-6 z-40 mx-auto max-w-md animate-slide-up">
          <Link
            href="/shopping"
            className="flex items-center justify-between rounded-full bg-ink px-5 py-3.5 text-cream shadow-2xl transition active:scale-98 border border-white/20"
          >
            <div className="flex items-center gap-2.5">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gold text-xs font-black text-ink-gold">
                {cartItemCount}
              </span>
              <span className="text-xs font-bold">Review Spotlight Order</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-black text-gold">{ugx(cartTotal)}</span>
              <span className="text-xs font-bold text-white/80">Checkout →</span>
            </div>
          </Link>
        </div>
      )}

      {/* Slide-Up Comments Drawer */}
      {activeCommentsItem && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-t-[28px] border-t border-white/15 bg-neutral-900 p-4 pb-8 text-white shadow-2xl space-y-3 max-h-[70vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <h3 className="font-bold text-sm">
                Comments ({itemComments[activeCommentsItem.id]?.length || 0})
              </h3>
              <button
                onClick={() => setActiveCommentsItem(null)}
                className="rounded-full p-1 text-white/70 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Comments List */}
            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 py-1">
              {itemComments[activeCommentsItem.id]?.map((c, i) => (
                <div key={i} className="rounded-xl bg-white/5 p-2.5 text-xs">
                  <span className="font-bold text-gold">{c.user}: </span>
                  <span className="text-white/90">{c.text}</span>
                </div>
              ))}
            </div>

            {/* New Comment Input */}
            <div className="flex items-center gap-2 pt-2 border-t border-white/10">
              <input
                type="text"
                value={newCommentText}
                onChange={(e) => setNewCommentText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddComment()}
                placeholder="Add a comment…"
                className="flex-1 rounded-full bg-white/10 px-4 py-2 text-xs text-white placeholder:text-white/40 focus:outline-none focus:border-gold"
              />
              <button
                onClick={handleAddComment}
                disabled={!newCommentText.trim()}
                className="rounded-full bg-gold px-3.5 py-2 text-xs font-bold text-ink-gold disabled:opacity-50"
              >
                Post
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
