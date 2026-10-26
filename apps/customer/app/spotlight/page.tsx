"use client";

import type { PostView } from "@peebee/shared";
import { ArrowLeft, Plus, Volume2, VolumeX } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, errorMessage } from "../../lib/api";
import { useCart } from "../../lib/cart";
import { addSpotlightItemToCart } from "../../lib/spotlight-cart";
import { CartDrawer } from "../../components/CartDrawer";
import { SpotlightCard, type SpotlightItem } from "../../components/spotlight/SpotlightCard";
import { PostSpotlightCard } from "../../components/channels/PostSpotlightCard";
import { useAuth } from "../../lib/auth-context";
import { useChannelsConfig } from "../../lib/channels";
import "../../components/spotlight/spotlight.css";

const ugx = (val: number) => `UGX ${Number(val).toLocaleString()}`;

const FILTERS = [
  { id: "all", label: "All" },
  { id: "following", label: "Following" },
  { id: "live", label: "Live" },
  { id: "groceries", label: "Groceries" },
  { id: "stores", label: "Stores" },
] as const;

type Filter = (typeof FILTERS)[number]["id"];

/** One thing in the feed: a store's post (with a product to buy) or a post from anyone else on Peebee. */
type FeedEntry = { kind: "store"; item: SpotlightItem } | { kind: "post"; post: PostView };

/** Shows creators' posts and store posts one after the other, so neither crowds out the other. */
function interleave(posts: PostView[], stores: SpotlightItem[]): FeedEntry[] {
  const out: FeedEntry[] = [];
  const max = Math.max(posts.length, stores.length);
  for (let i = 0; i < max; i++) {
    if (posts[i]) out.push({ kind: "post", post: posts[i]! });
    if (stores[i]) out.push({ kind: "store", item: stores[i]! });
  }
  return out;
}

export default function SpotlightPage() {
  const router = useRouter();
  const [items, setItems] = useState<SpotlightItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<Filter>("all");
  const { user } = useAuth();
  const { config: channelsConfig } = useChannelsConfig();
  const channelsOn = channelsConfig?.enabled === true;
  const [posts, setPosts] = useState<PostView[]>([]);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [followed, setFollowed] = useState<Set<string>>(new Set());
  const loadingMore = useRef(false);
  const [isMuted, setIsMuted] = useState(true);

  // Likes and comments state per item
  const [likedMap, setLikedMap] = useState<Record<string, boolean>>({});
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
  // Item whose comments drawer is open (VOD / images only; live shows comments inline).
  const [activeCommentsId, setActiveCommentsId] = useState<string | null>(null);
  const [itemComments, setItemComments] = useState<Record<string, Array<{ user: string; text: string }>>>({});

  // Quick buy writes to the shared marketplace cart (lib/cart.ts), the same
  // one the cart drawer and /cart read. It used to be local page state.
  const { totalQuantity: cartItemCount, total: cartTotal } = useCart();
  const [cartOpen, setCartOpen] = useState(false);
  const [quickBuyNotice, setQuickBuyNotice] = useState("");

  // Carousel current indexes per item
  const [carouselIndices, setCarouselIndices] = useState<Record<string, number>>({});

  useEffect(() => {
    loadSpotlight();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryFilter, channelsOn]);

  // Who the viewer already follows, so the follow button only shows for new channels.
  useEffect(() => {
    if (!channelsOn || !user) return;
    api.followingChannels().then((r) => setFollowed(new Set(r.channels.map((c) => c.id)))).catch(() => undefined);
  }, [channelsOn, user]);

  const loadMorePosts = useCallback(async () => {
    if (nextCursor === null || loadingMore.current) return;
    loadingMore.current = true;
    try {
      const feed = await api.spotlightFeed(categoryFilter === "following" ? "following" : "all", nextCursor);
      setPosts((prev) => [...prev, ...feed.posts.filter((p) => !prev.some((x) => x.id === p.id))]);
      setNextCursor(feed.nextCursor);
    } finally {
      loadingMore.current = false;
    }
  }, [nextCursor, categoryFilter]);

  async function loadSpotlight() {
    setLoading(true);
    setError("");
    try {
      // Posts from creators and every other publisher come from the shared feed; stores keep their own.
      const wantsPosts = channelsOn && (categoryFilter === "all" || categoryFilter === "following" || categoryFilter === "live");
      const feedPromise = wantsPosts ? api.spotlightFeed(categoryFilter === "following" ? "following" : categoryFilter === "live" ? "video" : "all").catch(() => null) : Promise.resolve(null);
      const res = categoryFilter === "following" ? { spotlight: [] as SpotlightItem[] } : await api.getMarketplaceSpotlight(categoryFilter);
      const feed = await feedPromise;
      setPosts(feed ? (categoryFilter === "live" ? feed.posts.filter((p) => p.type === "live") : feed.posts) : []);
      setNextCursor(feed ? feed.nextCursor : null);
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

  function handleAddComment(itemId: string, text: string) {
    if (!text.trim()) return;
    setItemComments((prev) => ({
      ...prev,
      [itemId]: [...(prev[itemId] || []), { user: "You", text: text.trim() }],
    }));
  }

  async function handleQuickBuy(item: SpotlightItem) {
    await addSpotlightItemToCart(item, (id) => api.getMarketplaceProduct(id));
    setQuickBuyNotice(`Added "${item.product.title}" to cart`);
    setTimeout(() => setQuickBuyNotice(""), 2400);
  }

  function handleCarouselNav(itemId: string, direction: "prev" | "next", total: number) {
    setCarouselIndices((prev) => {
      const current = prev[itemId] || 0;
      const nextIndex = direction === "next" ? (current + 1) % total : (current - 1 + total) % total;
      return { ...prev, [itemId]: nextIndex };
    });
  }

  // Room reserved at the bottom of each card for the floating cart pill.
  const bottomPad = cartItemCount > 0 ? 72 : 0;

  function leave() {
    if (window.history.length > 1) router.back();
    else router.push("/shopping");
  }

  const entries: FeedEntry[] =
    categoryFilter === "following" ? posts.map((post) => ({ kind: "post" as const, post }))
    : categoryFilter === "groceries" || categoryFilter === "stores" ? items.map((item) => ({ kind: "store" as const, item }))
    : categoryFilter === "live" ? [...posts.map((post) => ({ kind: "post" as const, post })), ...items.map((item) => ({ kind: "store" as const, item }))]
    : interleave(posts, items);

  const topControls = (
    <div className="flex items-center justify-between gap-3 px-4">
      <button
        type="button"
        onClick={leave}
        aria-label="Leave Spotlight"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-md transition active:scale-95"
      >
        <ArrowLeft className="h-5 w-5" aria-hidden />
      </button>
      <div role="tablist" aria-label="Spotlight filter" className="flex items-center gap-0.5 rounded-full bg-black/30 p-1 backdrop-blur-md">
        {FILTERS.filter((f) => f.id !== "following" || channelsOn).map((f) => (
          <button
            key={f.id}
            type="button"
            role="tab"
            aria-selected={categoryFilter === f.id}
            onClick={() => { setActiveCommentsId(null); setCategoryFilter(f.id); }}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
              categoryFilter === f.id ? "bg-gold text-ink-gold" : "text-white/75 hover:text-white"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>
      {channelsOn && (
        <Link href="/studio/new" aria-label="Create a post" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gold text-ink-gold transition active:scale-95">
          <Plus className="h-5 w-5" aria-hidden />
        </Link>
      )}
      <button
        type="button"
        onClick={() => setIsMuted((prev) => !prev)}
        aria-label={isMuted ? "Unmute" : "Mute"}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-md transition active:scale-95"
      >
        {isMuted ? <VolumeX className="h-[18px] w-[18px]" aria-hidden /> : <Volume2 className="h-[18px] w-[18px] text-gold" aria-hidden />}
      </button>
    </div>
  );

  return (
    <div className="sl-root relative h-dvh w-full overflow-hidden bg-black text-white">
      {quickBuyNotice && (
        <div role="status" className="absolute inset-x-4 top-20 z-40 mx-auto max-w-sm rounded-full bg-gold px-4 py-2.5 text-center text-xs font-semibold text-ink-gold shadow-[var(--shadow-glow-gold)] animate-fade-in">
          {quickBuyNotice}
        </div>
      )}

      {loading ? (
        <div className="flex h-full w-full items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="h-9 w-9 animate-spin rounded-full border-2 border-gold border-t-transparent" />
            <p className="text-xs text-white/60">Loading Spotlight…</p>
          </div>
        </div>
      ) : entries.length === 0 ? (
        <div className="flex h-full w-full flex-col">
          <div className="pt-3">{topControls}</div>
          <div className="flex flex-1 flex-col items-center justify-center space-y-3 p-6 text-center">
            <h2 className="text-base font-semibold">Nothing in Spotlight yet</h2>
            <p className="max-w-xs text-xs text-white/60">
              {error || "Try another filter or check back shortly for new videos and live streams."}
            </p>
            <button type="button" onClick={() => setCategoryFilter("all")} className="rounded-full bg-gold px-5 py-2.5 text-xs font-semibold text-ink-gold">
              Show everything
            </button>
          </div>
        </div>
      ) : (
        <div
          className={`no-scrollbar h-full w-full snap-y snap-mandatory ${activeCommentsId ? "overflow-hidden" : "overflow-y-scroll"}`}
          onScroll={(e) => {
            const el = e.currentTarget;
            if (el.scrollTop + el.clientHeight * 2.5 >= el.scrollHeight) void loadMorePosts();
          }}
        >
          {entries.map((entry) =>
            entry.kind === "post" ? (
              <PostSpotlightCard
                key={`post-${entry.post.id}`}
                post={entry.post}
                muted={isMuted}
                topInset={topControls}
                following={entry.post.publisher?.type === "channel" && followed.has(entry.post.publisher.id)}
                onFollowChange={(id, now) => setFollowed((prev) => { const next = new Set(prev); if (now) next.add(id); else next.delete(id); return next; })}
              />
            ) : (
              <SpotlightCard
                key={entry.item.id}
                item={entry.item}
                isMuted={isMuted}
                liked={!!likedMap[entry.item.id]}
                likeCount={likeCounts[entry.item.id] || 0}
                comments={itemComments[entry.item.id] || []}
                carouselIdx={carouselIndices[entry.item.id] || 0}
                drawerOpen={activeCommentsId === entry.item.id}
                topInset={topControls}
                bottomPad={bottomPad}
                onToggleLike={() => handleToggleLike(entry.item.id)}
                onCarouselNav={(dir, total) => handleCarouselNav(entry.item.id, dir, total)}
                onQuickBuy={() => void handleQuickBuy(entry.item)}
                onAddComment={(text) => handleAddComment(entry.item.id, text)}
                onDrawerChange={(open) => setActiveCommentsId(open ? entry.item.id : null)}
              />
            ),
          )}
        </div>
      )}

      {cartItemCount > 0 && !activeCommentsId && (
        <div className="absolute inset-x-4 z-40 mx-auto max-w-md animate-slide-up" style={{ bottom: "max(1rem, env(safe-area-inset-bottom))" }}>
          <button
            type="button"
            onClick={() => setCartOpen(true)}
            aria-label={`View cart, ${cartItemCount} items`}
            className="flex h-14 w-full items-center justify-between rounded-full bg-[rgb(var(--surface-card))] pl-2 pr-5 text-ink shadow-[var(--shadow-float-capsule)] transition active:scale-[0.98]"
          >
            <span className="flex items-center gap-2.5">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gold text-sm font-bold text-ink-gold">{cartItemCount}</span>
              <span className="text-sm font-semibold">View cart</span>
            </span>
            <span className="text-sm font-bold">{ugx(cartTotal)}</span>
          </button>
        </div>
      )}

      <CartDrawer isOpen={cartOpen} onClose={() => setCartOpen(false)} />
    </div>
  );
}
